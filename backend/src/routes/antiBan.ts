import { Router } from 'express'
import { supabase } from '../lib/supabase.js'
import { authenticate, AuthRequest, requireRole } from '../lib/authenticate.js'
import { auditMutation, normalizeIdParam, respondData } from '../lib/http.js'
import { validate } from '../lib/validate.js'
import { idParamsSchema } from '../schemas/common.js'
import { computeHealthScore } from '../modules/fleet/healthScorer.js'
import { classifyBanRisk, predictBanProbability } from '../modules/health/banPredictor.js'

const router = Router()

function uniqueStrings(values: string[]) {
  return [...new Set(values.filter(Boolean))]
}

function buildTopFactors(health: Awaited<ReturnType<typeof computeHealthScore>>, metrics: {
  optOuts24h: number
  sentToday: number
  banSignals24h: number
}) {
  const factors: string[] = []

  if (metrics.banSignals24h > 0) {
    factors.push(`${metrics.banSignals24h} ban signal(s) logged in the last 24 hours`)
  }

  if (metrics.optOuts24h > 0) {
    const optOutRate = Math.round((metrics.optOuts24h / Math.max(metrics.sentToday || 1, 1)) * 100)
    factors.push(`${optOutRate}% opt-out rate over the last 24 hours`)
  }

  if (metrics.sentToday >= 400) {
    factors.push(`${metrics.sentToday} outbound messages sent in the last 24 hours`)
  }

  factors.push(
    ...health.breakdown
      .filter((rule) => !rule.passed)
      .slice(0, 5)
      .map((rule) => `${rule.category}: ${rule.rule}`),
  )

  return uniqueStrings(factors).slice(0, 3)
}

async function getDeviceRisk(orgId: string, deviceId: string) {
  const health = await computeHealthScore(deviceId)
  const { count: sentToday } = await supabase
    .from('messages')
    .select('*', { count: 'exact', head: true })
    .eq('device_id', deviceId)
    .eq('direction', 'outbound')
    .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())

  const { count: optOuts } = await supabase
    .from('health_events')
    .select('*', { count: 'exact', head: true })
    .eq('org_id', orgId)
    .eq('device_id', deviceId)
    .eq('event_type', 'opt_out')
    .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())

  const { count: banSignals } = await supabase
    .from('health_events')
    .select('*', { count: 'exact', head: true })
    .eq('org_id', orgId)
    .eq('device_id', deviceId)
    .eq('event_type', 'ban_signal')
    .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())

  const probability = predictBanProbability({
    healthScore: health.score,
    optOutRate: (optOuts ?? 0) / Math.max(sentToday ?? 1, 1),
    replyRate: health.score / 100,
    banSignals24h: banSignals ?? 0,
    sentToday: sentToday ?? 0,
  })

  return {
    ...health,
    banProbability: probability,
    riskLevel: classifyBanRisk(probability),
    optOuts24h: optOuts ?? 0,
    sentToday: sentToday ?? 0,
    banSignals24h: banSignals ?? 0,
    topFactors: buildTopFactors(health, {
      optOuts24h: optOuts ?? 0,
      sentToday: sentToday ?? 0,
      banSignals24h: banSignals ?? 0,
    }),
  }
}

router.get('/scores', authenticate, async (req: AuthRequest, res) => {
  const { data: devices } = await supabase
    .from('whatsapp_devices')
    .select('id, name, status, health_score, ban_probability, messages_sent_today, daily_limit')
    .eq('org_id', req.user!.orgId)
    .neq('status', 'deleted')

  const scored = await Promise.all((devices || []).map(async (device) => ({
    ...device,
    ...(await getDeviceRisk(req.user!.orgId, device.id)),
  })))

  return respondData(res, {
    devices: scored,
    overallHealth: scored.length
      ? Math.round(scored.reduce((sum, device) => sum + device.score, 0) / scored.length)
      : 0,
  })
})

router.get('/scores/:id', authenticate, validate(idParamsSchema, 'params'), async (req: AuthRequest, res) => {
  const deviceId = normalizeIdParam(req.params.id)
  const { data: device } = await supabase
    .from('whatsapp_devices')
    .select('id, name, status, health_score, ban_probability, messages_sent_today, daily_limit')
    .eq('id', deviceId)
    .eq('org_id', req.user!.orgId)
    .single()

  if (!device) return res.status(404).json({ error: 'Device not found' })
  return respondData(res, {
    ...device,
    ...(await getDeviceRisk(req.user!.orgId, deviceId)),
  })
})

router.get('/rules', authenticate, async (req: AuthRequest, res) => {
  const { data: devices } = await supabase
    .from('whatsapp_devices')
    .select('id, name')
    .eq('org_id', req.user!.orgId)
    .neq('status', 'deleted')

  const rules = await Promise.all((devices || []).map(async (device) => ({
    deviceId: device.id,
    deviceName: device.name,
    ...(await computeHealthScore(device.id)),
  })))

  return respondData(res, rules)
})

router.post('/rescore/:id', authenticate, requireRole('operator'), validate(idParamsSchema, 'params'), async (req: AuthRequest, res) => {
  const deviceId = normalizeIdParam(req.params.id)
  const { data: device } = await supabase
    .from('whatsapp_devices')
    .select('id')
    .eq('id', deviceId)
    .eq('org_id', req.user!.orgId)
    .single()

  if (!device) return res.status(404).json({ error: 'Device not found' })

  const result = await getDeviceRisk(req.user!.orgId, deviceId)
  await supabase
    .from('whatsapp_devices')
    .update({
      health_score: result.score,
      ban_probability: result.banProbability,
      updated_at: new Date().toISOString(),
    })
    .eq('id', deviceId)
    .eq('org_id', req.user!.orgId)

  await auditMutation(req, 'anti-ban.rescore', 'device', deviceId, null, result)
  return respondData(res, result)
})

router.get('/events', authenticate, async (req: AuthRequest, res) => {
  const { data, error } = await supabase
    .from('health_events')
    .select('*, whatsapp_devices(name)')
    .eq('org_id', req.user!.orgId)
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) return res.status(500).json({ error: error.message })
  return respondData(res, data || [])
})

export default router
