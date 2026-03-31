import { Router } from 'express'
import { z } from 'zod'
import { supabase } from '../lib/supabase.js'
import { authenticate, AuthRequest, requireRole } from '../lib/authenticate.js'
import { enqueueCampaignMessages } from '../modules/queue/campaignProcessor.js'
import { auditMutation, decodeCursor, encodeCursor, normalizeIdParam, respondData, respondPaginated } from '../lib/http.js'
import { validate } from '../lib/validate.js'
import { idParamsSchema, paginationQuerySchema } from '../schemas/common.js'

import { logger } from '../lib/logger.js'

const router = Router()

const createCampaignSchema = z.object({
  name: z.string().trim().min(1),
  description: z.string().trim().optional(),
  type: z.enum(['bulk', 'sequence', 'ab_test', 'trigger']).default('bulk'),
  templateId: z.string().uuid(),
  templateBId: z.string().uuid().optional(),
  contactListIds: z.array(z.string().uuid()).default([]),
  contactIds: z.array(z.string().uuid()).default([]),
  deviceIds: z.array(z.string().uuid()).default([]),
  scheduledAt: z.string().datetime().optional(),
  sendWindowStart: z.string().default('09:00'),
  sendWindowEnd: z.string().default('20:00'),
  minDelaySeconds: z.coerce.number().min(10).default(30),
  maxDelaySeconds: z.coerce.number().min(10).default(120),
  abSplitPct: z.coerce.number().min(1).max(99).default(50),
})

const updateCampaignSchema = createCampaignSchema.partial()

const listCampaignsQuerySchema = paginationQuerySchema.extend({
  status: z.string().optional(),
})

router.get('/', authenticate, validate(listCampaignsQuerySchema, 'query'), async (req: AuthRequest, res) => {
  const { status, cursor, limit } = req.query as unknown as z.infer<typeof listCampaignsQuerySchema>

  let query = supabase
    .from('campaigns')
    .select('*')
    .eq('org_id', req.user!.orgId)
    .is('deleted_at', null)
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

  const { data: campaigns, error } = await query
  if (error) return res.status(500).json({ error: error.message })

  const nextCursor = campaigns && campaigns.length === limit
    ? encodeCursor({ created_at: campaigns[campaigns.length - 1].created_at, id: campaigns[campaigns.length - 1].id })
    : null

  return respondPaginated(res, campaigns || [], {
    nextCursor,
    hasMore: !!nextCursor,
  })
})

router.get('/:id', authenticate, validate(idParamsSchema, 'params'), async (req: AuthRequest, res) => {
  const campaignId = normalizeIdParam(req.params.id)

  const [{ data: campaign, error }, { data: messageStats }] = await Promise.all([
    supabase
      .from('campaigns')
      .select('*, message_templates(id, name, body)')
      .eq('id', campaignId)
      .eq('org_id', req.user!.orgId)
      .is('deleted_at', null)
      .single(),
    supabase
      .from('messages')
      .select('status')
      .eq('org_id', req.user!.orgId)
      .eq('campaign_id', campaignId),
  ])

  if (error || !campaign) return res.status(404).json({ error: 'Campaign not found' })

  const liveStats = (messageStats || []).reduce<Record<string, number>>((acc, message) => {
    acc[message.status] = (acc[message.status] || 0) + 1
    return acc
  }, {})

  return respondData(res, {
    ...campaign,
    liveStats: {
      sent: liveStats.sent || 0,
      delivered: liveStats.delivered || 0,
      read: liveStats.read || 0,
      replied: campaign.replied_count || 0,
      failed: liveStats.failed || 0,
    },
  })
})

router.post('/', authenticate, requireRole('operator'), validate(createCampaignSchema), async (req: AuthRequest, res) => {
  const orgId = (Array.isArray(req.user!.orgId) ? req.user!.orgId[0] : req.user!.orgId) as string
  const payload = req.body as z.infer<typeof createCampaignSchema>
  const isScheduled = payload.scheduledAt && new Date(payload.scheduledAt).getTime() > Date.now()

  const { data: campaign, error } = await supabase
    .from('campaigns')
    .insert({
      org_id: orgId,
      name: payload.name,
      description: payload.description,
      type: payload.type,
      template_id: payload.templateId,
      template_b_id: payload.templateBId,
      contact_list_ids: payload.contactListIds,
      contact_ids: payload.contactIds,
      device_ids: payload.deviceIds,
      scheduled_at: payload.scheduledAt,
      status: isScheduled ? 'scheduled' : 'draft',
      send_window_start: payload.sendWindowStart,
      send_window_end: payload.sendWindowEnd,
      min_delay_seconds: payload.minDelaySeconds,
      max_delay_seconds: payload.maxDelaySeconds,
      ab_split_pct: payload.abSplitPct,
      created_by: req.user!.id,
    })
    .select()
    .single()

  if (error || !campaign) return res.status(500).json({ error: error?.message || 'Unable to create campaign' })

  await auditMutation(req, 'campaign.create', 'campaign', campaign.id, null, campaign)
  return respondData(res, campaign, 201)
})

router.patch('/:id', authenticate, requireRole('operator'), validate(idParamsSchema, 'params'), validate(updateCampaignSchema), async (req: AuthRequest, res) => {
  const campaignId = normalizeIdParam(req.params.id)
  const payload = req.body as z.infer<typeof updateCampaignSchema>

  const { data: before } = await supabase
    .from('campaigns')
    .select('*')
    .eq('id', campaignId)
    .eq('org_id', req.user!.orgId)
    .is('deleted_at', null)
    .single()

  if (!before) return res.status(404).json({ error: 'Campaign not found' })
  if (before.status !== 'draft') {
    return res.status(400).json({ error: 'Only draft campaigns can be updated' })
  }

  const nextScheduledAt = payload.scheduledAt ?? before.scheduled_at
  const isScheduled = nextScheduledAt && new Date(nextScheduledAt).getTime() > Date.now()

  const { data: campaign, error } = await supabase
    .from('campaigns')
    .update({
      name: payload.name ?? before.name,
      description: payload.description ?? before.description,
      type: payload.type ?? before.type,
      template_id: payload.templateId ?? before.template_id,
      template_b_id: payload.templateBId ?? before.template_b_id,
      contact_list_ids: payload.contactListIds ?? before.contact_list_ids,
      contact_ids: payload.contactIds ?? before.contact_ids,
      device_ids: payload.deviceIds ?? before.device_ids,
      scheduled_at: nextScheduledAt,
      status: isScheduled ? 'scheduled' : 'draft',
      send_window_start: payload.sendWindowStart ?? before.send_window_start,
      send_window_end: payload.sendWindowEnd ?? before.send_window_end,
      min_delay_seconds: payload.minDelaySeconds ?? before.min_delay_seconds,
      max_delay_seconds: payload.maxDelaySeconds ?? before.max_delay_seconds,
      ab_split_pct: payload.abSplitPct ?? before.ab_split_pct,
      updated_at: new Date().toISOString(),
    })
    .eq('id', campaignId)
    .eq('org_id', req.user!.orgId)
    .select()
    .single()

  if (error || !campaign) return res.status(500).json({ error: error?.message || 'Unable to update campaign' })

  await auditMutation(req, 'campaign.update', 'campaign', campaign.id, before, campaign)
  return respondData(res, campaign)
})

router.delete('/:id', authenticate, requireRole('admin'), validate(idParamsSchema, 'params'), async (req: AuthRequest, res) => {
  const campaignId = normalizeIdParam(req.params.id)

  const { data: before } = await supabase
    .from('campaigns')
    .select('*')
    .eq('id', campaignId)
    .eq('org_id', req.user!.orgId)
    .is('deleted_at', null)
    .single()

  if (!before) return res.status(404).json({ error: 'Campaign not found' })

  const { data: campaign, error } = await supabase
    .from('campaigns')
    .update({
      deleted_at: new Date().toISOString(),
      status: before.status === 'draft' ? 'draft' : 'stopped',
      updated_at: new Date().toISOString(),
    } as any)
    .eq('id', campaignId)
    .eq('org_id', req.user!.orgId)
    .select()
    .single()

  if (error || !campaign) return res.status(500).json({ error: error?.message || 'Unable to delete campaign' })

  await auditMutation(req, 'campaign.delete', 'campaign', campaign.id, before, campaign)
  return respondData(res, { success: true })
})

router.post('/:id/launch', authenticate, async (req: AuthRequest, res) => {
  const id = normalizeIdParam(req.params.id)
  console.log(`[LAUNCH] 🚀 Launch requested for campaign ${id}`)

  const { data: campaign } = await supabase
    .from('campaigns')
    .select('*')
    .eq('id', id)
    .eq('org_id', req.user!.orgId)
    .single()

  if (!campaign) return res.status(404).json({ error: 'Campaign not found' })
  if (campaign.status === 'running') return res.status(400).json({ error: 'Campaign already running' })

  // ── Validate devices ──────────────────────────────────────────────────────
  const deviceIds: string[] = campaign.device_ids || []
  if (!deviceIds.length) return res.status(400).json({ error: 'No devices assigned' })

  const { getSession, waitForSession } = await import('../modules/session/sessionManager.js')
  const connectedDeviceIds: string[] = []

  for (const deviceId of deviceIds) {
    let sock = getSession(deviceId) ?? null
    if (!sock) {
      console.log(`[LAUNCH] ⚠️ No session for device ${deviceId} — trying reconnect...`)
      const { data: dev } = await supabase.from('whatsapp_devices').select('org_id, name, status').eq('id', deviceId).single()
      if (dev?.status !== 'banned') {
        sock = await waitForSession(deviceId, req.user!.orgId, 15_000)
      }
    }
    if (sock) {
      connectedDeviceIds.push(deviceId)
      console.log(`[LAUNCH] ✅ Device ${deviceId} ready`)
    } else {
      console.warn(`[LAUNCH] ❌ Device ${deviceId} unavailable`)
    }
  }

  if (!connectedDeviceIds.length) {
    return res.status(400).json({
      error: 'No connected devices available. Go to Devices page → QR Code tab → Connect Device.',
      tip: 'If device shows Connected but fails, run: npm run dev:stable (no hot-reload)',
    })
  }

  // ── Gather contacts ───────────────────────────────────────────────────────
  let contacts: any[] = []

  if (campaign.contact_list_ids?.length) {
    const { data: lm } = await supabase
      .from('contact_list_members')
      .select('contacts(*)')
      .in('list_id', campaign.contact_list_ids)
    contacts = (lm || []).map((m: any) => m.contacts).filter(Boolean)
  }

  if (campaign.contact_ids?.length) {
    const { data: dc } = await supabase
      .from('contacts')
      .select('*')
      .in('id', campaign.contact_ids)
    contacts = [...contacts, ...(dc || [])]
  }

  // ── Filter valid contacts ─────────────────────────────────────────────────
  const validContacts = contacts.filter(c => {
    if (!c || c.status !== 'active' || !c.phone) return false
    const digits = c.phone.replace(/[^\d]/g, '')
    return digits.length >= 7 && digits.length <= 15
  })

  // Deduplicate by phone
  const seen = new Set<string>()
  const uniqueContacts = validContacts.filter(c => {
    if (seen.has(c.phone)) return false
    seen.add(c.phone)
    return true
  })

  console.log(`[LAUNCH] 👥 Contacts: ${uniqueContacts.length} valid (filtered from ${contacts.length} total)`)

  if (!uniqueContacts.length) {
    return res.status(400).json({
      error: 'No valid contacts. Ensure contacts have valid phone numbers and Active status.',
      totalContacts: contacts.length,
    })
  }

  // ── Get template ──────────────────────────────────────────────────────────
  const { data: template } = await supabase
    .from('message_templates')
    .select('body, name')
    .eq('id', campaign.template_id)
    .single()

  if (!template) return res.status(400).json({ error: 'Template not found' })

  // ── Update status ─────────────────────────────────────────────────────────
  await supabase.from('campaigns').update({
    total_contacts: uniqueContacts.length,
    status: 'running',
    started_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).eq('id', id)

  // ── Queue jobs ────────────────────────────────────────────────────────────
  const { campaignQueue, scheduleCampaignWithCron } = await import('../modules/queue/campaignProcessor.js')

  if (campaignQueue) {
    const jobs = uniqueContacts.map((c: any, i: number) => ({
      name: 'send',
      data: {
        deviceId: connectedDeviceIds[i % connectedDeviceIds.length],
        contactId: c.id,
        orgId: req.user!.orgId,
        campaignId: id,
        content: template.body,
        minDelay: (campaign.min_delay_seconds || 30) * 1000,
        maxDelay: (campaign.max_delay_seconds || 120) * 1000,
      },
    }))
    await campaignQueue.addBulk(jobs)
    console.log(`[LAUNCH] ✅ ${jobs.length} BullMQ jobs queued`)
  } else {
    console.log(`[LAUNCH] ⚠️ Redis not available — using node-cron fallback`)
    scheduleCampaignWithCron(
      id,
      uniqueContacts,
      connectedDeviceIds,
      req.user!.orgId,
      template.body,
      { min: campaign.min_delay_seconds || 30, max: campaign.max_delay_seconds || 120 }
    ).catch(err => console.error('[LAUNCH] ❌ Cron scheduler error:', err))
  }

  console.log(`[LAUNCH] ✅ Campaign ${id} launched — ${uniqueContacts.length} contacts, ${connectedDeviceIds.length} devices, engine: ${campaignQueue ? 'BullMQ' : 'cron'}`)

  return respondData(res, {
    message: 'Campaign launched',
    totalContacts: uniqueContacts.length,
    devices: connectedDeviceIds.length,
    engine: campaignQueue ? 'bullmq' : 'node-cron',
  })
})

router.post('/:id/pause', authenticate, requireRole('operator'), validate(idParamsSchema, 'params'), async (req: AuthRequest, res) => {
  const campaignId = normalizeIdParam(req.params.id)

  const { data: existing } = await supabase
    .from('campaigns')
    .select('id, status')
    .eq('id', campaignId)
    .eq('org_id', req.user!.orgId)
    .single()

  if (!existing) return res.status(404).json({ error: 'Campaign not found' })
  if (existing.status !== 'running') {
    return res.status(400).json({ error: `Cannot pause a campaign in status: ${existing.status}` })
  }

  const { data: campaign, error } = await supabase
    .from('campaigns')
    .update({ status: 'paused', updated_at: new Date().toISOString() })
    .eq('id', campaignId)
    .eq('org_id', req.user!.orgId)
    .select()
    .single()

  if (error || !campaign) return res.status(500).json({ error: error?.message || 'Unable to pause campaign' })

  await auditMutation(req, 'campaign.pause', 'campaign', campaign.id, existing, campaign)
  return respondData(res, campaign)
})

router.post('/:id/resume', authenticate, requireRole('operator'), validate(idParamsSchema, 'params'), async (req: AuthRequest, res) => {
  const campaignId = normalizeIdParam(req.params.id)

  const { data: existing } = await supabase
    .from('campaigns')
    .select('id, status')
    .eq('id', campaignId)
    .eq('org_id', req.user!.orgId)
    .single()

  if (!existing) return res.status(404).json({ error: 'Campaign not found' })
  if (existing.status !== 'paused') {
    return res.status(400).json({ error: `Cannot resume a campaign in status: ${existing.status}` })
  }

  const { data: campaign, error } = await supabase
    .from('campaigns')
    .update({ status: 'running', updated_at: new Date().toISOString() })
    .eq('id', campaignId)
    .eq('org_id', req.user!.orgId)
    .select()
    .single()

  if (error || !campaign) return res.status(500).json({ error: error?.message || 'Unable to resume campaign' })

  await auditMutation(req, 'campaign.resume', 'campaign', campaign.id, existing, campaign)
  return respondData(res, campaign)
})

router.post('/:id/stop', authenticate, requireRole('operator'), validate(idParamsSchema, 'params'), async (req: AuthRequest, res) => {
  const campaignId = normalizeIdParam(req.params.id)

  const { data: existing } = await supabase
    .from('campaigns')
    .select('id, status')
    .eq('id', campaignId)
    .eq('org_id', req.user!.orgId)
    .single()

  if (!existing) return res.status(404).json({ error: 'Campaign not found' })
  if (!['running', 'paused'].includes(existing.status)) {
    return res.status(400).json({ error: `Cannot stop a campaign in status: ${existing.status}` })
  }

  const { data: campaign, error } = await supabase
    .from('campaigns')
    .update({ status: 'stopped', updated_at: new Date().toISOString() })
    .eq('id', campaignId)
    .eq('org_id', req.user!.orgId)
    .select()
    .single()

  if (error || !campaign) return res.status(500).json({ error: error?.message || 'Unable to stop campaign' })

  await auditMutation(req, 'campaign.stop', 'campaign', campaign.id, existing, campaign)
  return respondData(res, campaign)
})

export default router
