import { Router } from 'express'
import { z } from 'zod'
import { supabase } from '../lib/supabase.js'
import { authenticate, AuthRequest, requireRole } from '../lib/authenticate.js'
import { connectDevice, disconnectDevice } from '../modules/session/sessionManager.js'
import { logger } from '../lib/logger.js'
import { computeHealthScore } from '../modules/fleet/healthScorer.js'
import { warmupEngine } from '../modules/fleet/warmupEngine.js'
import { auditMutation, decodeCursor, encodeCursor, normalizeIdParam, respondData, respondPaginated } from '../lib/http.js'
import { validate } from '../lib/validate.js'
import { idParamsSchema, paginationQuerySchema } from '../schemas/common.js'

const router = Router()

const createDeviceSchema = z.object({
  name: z.string().trim().min(1),
  phoneNumber: z.string().trim().optional(),
  dailyLimit: z.coerce.number().int().min(50).max(1000).default(200),
  proxyUrl: z.string().trim().optional(),
  webhookUrl: z.string().trim().optional(),
  notes: z.string().trim().optional(),
})

const updateDeviceSchema = createDeviceSchema.partial()

const listDevicesQuerySchema = paginationQuerySchema.extend({
  status: z.string().optional(),
})

router.get('/', authenticate, validate(listDevicesQuerySchema, 'query'), async (req: AuthRequest, res) => {
  const { cursor, limit, status } = req.query as unknown as z.infer<typeof listDevicesQuerySchema>

  let query = supabase
    .from('whatsapp_devices')
    .select('*')
    .eq('org_id', req.user!.orgId)
    .neq('status', 'deleted')
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(limit)

  if (cursor) {
    try {
      const decoded = decodeCursor<{ created_at: string; id: string }>(cursor)
      query = query.or(`created_at.lt.${decoded.created_at},and(created_at.eq.${decoded.created_at},id.lt.${decoded.id})`)
    } catch {
      query = query.lt('id', cursor)
    }
  }

  if (status) {
    query = query.eq('status', status)
  }

  const { data: devices, error } = await query
  if (error) return res.status(500).json({ error: error.message })

  const nextCursor = devices && devices.length === limit
    ? encodeCursor({ created_at: devices[devices.length - 1].created_at, id: devices[devices.length - 1].id })
    : null

  return respondPaginated(res, devices || [], {
    nextCursor,
    hasMore: !!nextCursor,
  })
})

router.get('/:id', authenticate, validate(idParamsSchema, 'params'), async (req: AuthRequest, res) => {
  const deviceId = normalizeIdParam(req.params.id)

  const { data: device, error } = await supabase
    .from('whatsapp_devices')
    .select('*')
    .eq('id', deviceId)
    .eq('org_id', req.user!.orgId)
    .single()

  if (error || !device || device.status === 'deleted') {
    return res.status(404).json({ error: 'Device not found' })
  }

  const [health, eventsResult] = await Promise.all([
    computeHealthScore(deviceId).catch(() => null),
    supabase
      .from('health_events')
      .select('*')
      .eq('org_id', req.user!.orgId)
      .eq('device_id', deviceId)
      .order('created_at', { ascending: false })
      .limit(25),
  ])

  return respondData(res, {
    ...device,
    healthBreakdown: health,
    recentHealthEvents: eventsResult.data || [],
  })
})

router.get('/:id/qr', authenticate, validate(idParamsSchema, 'params'), async (req: AuthRequest, res) => {
  const deviceId = normalizeIdParam(req.params.id)
  const { data: device, error } = await supabase
    .from('whatsapp_devices')
    .select('id, qr_code, status, updated_at')
    .eq('id', deviceId)
    .eq('org_id', req.user!.orgId)
    .single()

  if (error || !device) {
    return res.status(404).json({ error: 'Device not found' })
  }

  return respondData(res, {
    id: device.id,
    qrCode: device.qr_code,
    status: device.status,
    updatedAt: device.updated_at,
  })
})

router.post('/', authenticate, requireRole('operator'), validate(createDeviceSchema), async (req: AuthRequest, res) => {
  const payload = req.body as z.infer<typeof createDeviceSchema>

  const { data: device, error } = await supabase
    .from('whatsapp_devices')
    .insert({
      org_id: req.user!.orgId,
      name: payload.name,
      phone_number: payload.phoneNumber,
      daily_limit: payload.dailyLimit,
      proxy_url: payload.proxyUrl,
      webhook_url: payload.webhookUrl,
      notes: payload.notes,
    })
    .select()
    .single()

  if (error || !device) return res.status(500).json({ error: error?.message || 'Unable to create device' })

  await auditMutation(req, 'device.create', 'device', device.id, null, device)
  return respondData(res, device, 201)
})

router.patch('/:id', authenticate, requireRole('operator'), validate(idParamsSchema, 'params'), validate(updateDeviceSchema), async (req: AuthRequest, res) => {
  const deviceId = normalizeIdParam(req.params.id)
  const updates = req.body as z.infer<typeof updateDeviceSchema>

  const { data: before } = await supabase
    .from('whatsapp_devices')
    .select('*')
    .eq('id', deviceId)
    .eq('org_id', req.user!.orgId)
    .single()

  if (!before || before.status === 'deleted') {
    return res.status(404).json({ error: 'Device not found' })
  }

  const { data: device, error } = await supabase
    .from('whatsapp_devices')
    .update({
      name: updates.name ?? before.name,
      phone_number: updates.phoneNumber ?? before.phone_number,
      daily_limit: updates.dailyLimit ?? before.daily_limit,
      proxy_url: updates.proxyUrl ?? before.proxy_url,
      webhook_url: updates.webhookUrl ?? before.webhook_url,
      notes: updates.notes ?? before.notes,
      updated_at: new Date().toISOString(),
    })
    .eq('id', deviceId)
    .eq('org_id', req.user!.orgId)
    .select()
    .single()

  if (error || !device) return res.status(500).json({ error: error?.message || 'Unable to update device' })

  await auditMutation(req, 'device.update', 'device', device.id, before, device)
  return respondData(res, device)
})

router.delete('/:id', authenticate, requireRole('admin'), validate(idParamsSchema, 'params'), async (req: AuthRequest, res) => {
  const deviceId = normalizeIdParam(req.params.id)
  await disconnectDevice(deviceId)

  const { data: before } = await supabase
    .from('whatsapp_devices')
    .select('*')
    .eq('id', deviceId)
    .eq('org_id', req.user!.orgId)
    .single()

  if (!before) {
    return res.status(404).json({ error: 'Device not found' })
  }

  const { data: device, error } = await supabase
    .from('whatsapp_devices')
    .update({
      status: 'deleted',
      qr_code: null,
      updated_at: new Date().toISOString(),
    } as any)
    .eq('id', deviceId)
    .eq('org_id', req.user!.orgId)
    .select()
    .single()

  if (error || !device) return res.status(500).json({ error: error?.message || 'Unable to delete device' })

  await auditMutation(req, 'device.delete', 'device', device.id, before, device)
  return respondData(res, { success: true })
})

router.post('/:id/connect', authenticate, requireRole('operator'), validate(idParamsSchema, 'params'), async (req: AuthRequest, res) => {
  const deviceId = normalizeIdParam(req.params.id)

  const { data: device } = await supabase
    .from('whatsapp_devices')
    .select('*')
    .eq('id', deviceId)
    .eq('org_id', req.user!.orgId)
    .neq('status', 'deleted')
    .single()

  if (!device) return res.status(404).json({ error: 'Device not found' })

  await supabase
    .from('whatsapp_devices')
    .update({
      status: 'connecting',
      updated_at: new Date().toISOString(),
    })
    .eq('id', deviceId)
    .eq('org_id', req.user!.orgId)

  void connectDevice(deviceId, req.user!.orgId).catch((err) => {
    logger.error({ err, deviceId }, 'connectDevice failed after POST /connect')
  })
  await auditMutation(req, 'device.connect', 'device', deviceId, device, { ...device, status: 'connecting' })
  return respondData(res, { status: 'connecting' })
})

router.post('/:id/disconnect', authenticate, requireRole('operator'), validate(idParamsSchema, 'params'), async (req: AuthRequest, res) => {
  const deviceId = normalizeIdParam(req.params.id)
  const { data: before } = await supabase
    .from('whatsapp_devices')
    .select('*')
    .eq('id', deviceId)
    .eq('org_id', req.user!.orgId)
    .single()

  if (!before) {
    return res.status(404).json({ error: 'Device not found' })
  }

  await disconnectDevice(deviceId)
  await auditMutation(req, 'device.disconnect', 'device', deviceId, before, { ...before, status: 'disconnected' })
  return respondData(res, { status: 'disconnected' })
})

router.post('/:id/warmup', authenticate, requireRole('operator'), validate(idParamsSchema, 'params'), async (req: AuthRequest, res) => {
  const deviceId = normalizeIdParam(req.params.id)
  const { data: before } = await supabase
    .from('whatsapp_devices')
    .select('*')
    .eq('id', deviceId)
    .eq('org_id', req.user!.orgId)
    .single()

  if (!before) {
    return res.status(404).json({ error: 'Device not found' })
  }

  const device = await warmupEngine.start(deviceId)
  await auditMutation(req, 'device.warmup.start', 'device', deviceId, before, device)
  return respondData(res, device)
})

export default router
