import { Router } from 'express'
import { supabase } from '../lib/supabase.js'
import { authenticate, AuthRequest } from '../lib/authenticate.js'
import { respondData } from '../lib/http.js'

const router = Router()

function getRange(req: AuthRequest, defaultDays: number) {
  const start = req.query.start as string | undefined
  const end = req.query.end as string | undefined
  const startDate = start ? new Date(start) : new Date(Date.now() - defaultDays * 24 * 60 * 60 * 1000)
  const endDate = end ? new Date(end) : new Date()
  return { startDate, endDate }
}

async function fetchMessages(orgId: string, startDate: Date, endDate: Date) {
  const { data, error } = await supabase
    .from('messages')
    .select('id, created_at, status, campaign_id, device_id, contact_id, direction')
    .eq('org_id', orgId)
    .gte('created_at', startDate.toISOString())
    .lte('created_at', endDate.toISOString())
    .order('created_at', { ascending: true })

  if (error) throw error
  return data || []
}

router.get('/overview', authenticate, async (req: AuthRequest, res) => {
  const { startDate, endDate } = getRange(req, 30)
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()
  const [messages, devicesResult, contactsResult, campaignsResult, usageResult] = await Promise.all([
    fetchMessages(req.user!.orgId, startDate, endDate),
    supabase
      .from('whatsapp_devices')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', req.user!.orgId)
      .in('status', ['connected', 'connecting', 'warming']),
    supabase.from('contacts').select('id', { count: 'exact', head: true }).eq('org_id', req.user!.orgId).is('deleted_at', null),
    supabase
      .from('campaigns')
      .select('id', { count: 'exact', head: true })
      .eq('org_id', req.user!.orgId)
      .is('deleted_at', null)
      .in('status', ['running', 'scheduled', 'paused']),
    supabase
      .from('billing_usage')
      .select('ai_calls')
      .eq('org_id', req.user!.orgId)
      .gte('period_start', monthStart)
      .single(),
  ])

  if (usageResult.error && usageResult.error.code !== 'PGRST116') {
    return res.status(500).json({ error: usageResult.error.message })
  }

  const delivered = messages.filter((message) => ['delivered', 'read'].includes(message.status)).length
  const read = messages.filter((message) => message.status === 'read').length
  const repliedContacts = new Set(messages.filter((message) => message.direction !== 'outbound').map((message: any) => message.contact_id).filter(Boolean)).size
  const activeDevices = devicesResult.count || 0
  const messagesSent = messages.length

  return respondData(res, {
    activeDevices,
    connectedDevices: activeDevices,
    totalContacts: contactsResult.count || 0,
    activeCampaigns: campaignsResult.count || 0,
    totalMessages: messagesSent,
    messagesSent,
    delivered,
    read,
    replied: repliedContacts,
    aiCallsThisMonth: usageResult.data?.ai_calls || 0,
  })
})

router.get('/volume', authenticate, async (req: AuthRequest, res) => {
  const orgId = (Array.isArray(req.user!.orgId) ? req.user!.orgId[0] : req.user!.orgId) as string
  const { startDate, endDate } = getRange(req, 30)
  const messages = await fetchMessages(orgId, startDate, endDate)
  const volumeByDay = new Map<string, { sent: number; delivered: number; read: number }>()

  for (const message of messages) {
    const day = message.created_at.split('T')[0]
    if (!volumeByDay.has(day)) {
      volumeByDay.set(day, { sent: 0, delivered: 0, read: 0 })
    }
    const bucket = volumeByDay.get(day)!
    bucket.sent += 1
    if (['delivered', 'read'].includes(message.status)) bucket.delivered += 1
    if (message.status === 'read') bucket.read += 1
  }

  return respondData(res, Array.from(volumeByDay.entries()).map(([date, stats]) => ({ date, ...stats })))
})

router.get('/funnel', authenticate, async (req: AuthRequest, res) => {
  const { startDate, endDate } = getRange(req, 30)
  const messages = await fetchMessages(req.user!.orgId, startDate, endDate)
  const sent = messages.length
  const delivered = messages.filter((message) => ['delivered', 'read'].includes(message.status)).length
  const read = messages.filter((message) => message.status === 'read').length

  const { count: replied } = await supabase
    .from('messages')
    .select('*', { count: 'exact', head: true })
    .eq('org_id', req.user!.orgId)
    .eq('direction', 'inbound')
    .gte('created_at', startDate.toISOString())
    .lte('created_at', endDate.toISOString())

  return respondData(res, { sent, delivered, read, replied: replied || 0 })
})

router.get('/devices', authenticate, async (req: AuthRequest, res) => {
  const { startDate, endDate } = getRange(req, 30)
  const [messages, devicesResult] = await Promise.all([
    fetchMessages(req.user!.orgId, startDate, endDate),
    supabase
      .from('whatsapp_devices')
      .select('id, name, status, health_score, ban_probability, messages_sent_today, daily_limit')
      .eq('org_id', req.user!.orgId)
      .neq('status', 'deleted'),
  ])

  const devices = devicesResult.data || []
  const stats = devices.map((device) => {
    const deviceMessages = messages.filter((message) => message.device_id === device.id)
    const delivered = deviceMessages.filter((message) => ['delivered', 'read'].includes(message.status)).length
    const read = deviceMessages.filter((message) => message.status === 'read').length
    return {
      ...device,
      sent: deviceMessages.length,
      delivered,
      read,
    }
  })

  return respondData(res, stats)
})

router.get('/campaigns', authenticate, async (req: AuthRequest, res) => {
  const { startDate, endDate } = getRange(req, 30)
  const { data, error } = await supabase
    .from('campaigns')
    .select('id, name, status, sent_count, delivered_count, read_count, replied_count, failed_count, total_contacts, created_at')
    .eq('org_id', req.user!.orgId)
    .is('deleted_at', null)
    .gte('created_at', startDate.toISOString())
    .lte('created_at', endDate.toISOString())
    .order('created_at', { ascending: false })

  if (error) return res.status(500).json({ error: error.message })
  return respondData(res, data || [])
})

router.get('/export', authenticate, async (req: AuthRequest, res) => {
  const { startDate, endDate } = getRange(req, 30)
  const { data, error } = await supabase
    .from('messages')
    .select('created_at, direction, status, content, campaign_id, device_id, contact_id')
    .eq('org_id', req.user!.orgId)
    .gte('created_at', startDate.toISOString())
    .lte('created_at', endDate.toISOString())
    .order('created_at', { ascending: false })

  if (error) return res.status(500).json({ error: error.message })

  const rows = [
    ['created_at', 'direction', 'status', 'content', 'campaign_id', 'device_id', 'contact_id'].join(','),
    ...(data || []).map((message) => [
      message.created_at,
      message.direction,
      message.status,
      `"${(message.content || '').replace(/"/g, '""')}"`,
      message.campaign_id || '',
      message.device_id || '',
      message.contact_id || '',
    ].join(',')),
  ]

  res.setHeader('Content-Type', 'text/csv')
  res.setHeader('Content-Disposition', 'attachment; filename="message-logs.csv"')
  return res.send(rows.join('\n'))
})

router.get('/summary', authenticate, async (req: AuthRequest, res) => {
  const { startDate, endDate } = getRange(req, 14)
  const [messages, campaignsResult, devicesResult] = await Promise.all([
    fetchMessages(req.user!.orgId, startDate, endDate),
    supabase
      .from('campaigns')
      .select('id, name, status, sent_count, delivered_count, read_count, replied_count, failed_count, created_at')
      .eq('org_id', req.user!.orgId)
      .is('deleted_at', null)
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString()),
    supabase
      .from('whatsapp_devices')
      .select('id, name, status, health_score, ban_probability, messages_sent_today, daily_limit')
      .eq('org_id', req.user!.orgId)
      .neq('status', 'deleted'),
  ])

  const volumeByDay = new Map<string, { sent: number; delivered: number; read: number }>()
  messages.forEach((message) => {
    const day = message.created_at.split('T')[0]
    if (!volumeByDay.has(day)) {
      volumeByDay.set(day, { sent: 0, delivered: 0, read: 0 })
    }
    const stats = volumeByDay.get(day)!
    stats.sent += 1
    if (['delivered', 'read'].includes(message.status)) stats.delivered += 1
    if (message.status === 'read') stats.read += 1
  })

  const devicePerformance = (devicesResult.data || []).map((device) => {
    const deviceMessages = messages.filter((message) => message.device_id === device.id)
    return {
      id: device.id,
      name: device.name,
      sent: deviceMessages.length,
      delivered: deviceMessages.filter((message) => ['delivered', 'read'].includes(message.status)).length,
      read: deviceMessages.filter((message) => message.status === 'read').length,
    }
  })

  return respondData(res, {
    totals: {
      sent: messages.length,
      delivered: messages.filter((message) => ['delivered', 'read'].includes(message.status)).length,
      read: messages.filter((message) => message.status === 'read').length,
      campaigns: campaignsResult.data?.length || 0,
    },
    volumeByDay: Array.from(volumeByDay.entries()).map(([date, stats]) => ({ date, ...stats })),
    devicePerformance,
    campaigns: (campaignsResult.data || []).map((campaign) => ({
      id: campaign.id,
      name: campaign.name,
      sent: campaign.sent_count,
      delivered: campaign.delivered_count,
      read: campaign.read_count,
      replied: campaign.replied_count,
      failed: campaign.failed_count,
      status: campaign.status,
    })),
  })
})

export default router
