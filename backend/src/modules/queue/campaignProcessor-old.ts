import { Worker, Queue } from 'bullmq'
import { getSession } from '../session/sessionManager.js'
import { supabase } from '../../lib/supabase.js'
import { healthBatchWriter } from '../../lib/batchWriter.js'
import { presenceSimulator } from '../presence/presenceSimulator.js'
import { config } from '../../lib/config.js'
import { redis, isRedisReady } from '../../lib/redis.js'
import { logger } from '../../lib/logger.js'

const SEND_QUEUE = 'campaign-send'
const DEVICE_MANAGEMENT_QUEUE = 'device-management'

/** Separate connections for BullMQ (blocking vs pub/sub). */
const queueConnection = config.redis.ready && redis ? redis.duplicate({ maxRetriesPerRequest: null }) : null
const workerConnection = config.redis.ready && redis ? redis.duplicate({ maxRetriesPerRequest: null }) : null

export const campaignQueue = queueConnection
  ? new Queue(SEND_QUEUE, {
      connection: queueConnection,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: 100,
        removeOnFail: 1000,
      },
    })
  : null

export const managementQueue = queueConnection
  ? new Queue(DEVICE_MANAGEMENT_QUEUE, {
      connection: queueConnection,
      defaultJobOptions: {
        removeOnComplete: 100,
        removeOnFail: 1000,
      },
    })
  : null

export interface CampaignSendJobData {
  messageId: string
  deviceId: string
  contactId: string
  orgId: string
  campaignId: string
  content: string
  mediaUrl?: string | null
  minDelayMs: number
  maxDelayMs: number
}

// ─── Gaussian delay (human-like) ─────────────────────────────────────────────
function gaussianDelay(minMs: number, maxMs: number): number {
  const mean = (minMs + maxMs) / 2
  const std = (maxMs - minMs) / 6
  let u = 0, v = 0
  while (u === 0) u = Math.random()
  while (v === 0) v = Math.random()
  const normal = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v)
  return Math.max(minMs, Math.min(maxMs, mean + std * normal))
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// ─── Redis-backed rate limiter (3 msg/min hard cap per device) ────────────────
const deviceRateLimits = new Map<string, number[]>()  // in-memory fallback

async function enforceRateLimit(deviceId: string): Promise<void> {
  if (redis && isRedisReady()) {
    const key = `ratelimit:device:${deviceId}` 
    const now = Date.now()
    const pipeline = redis.pipeline()
    pipeline.zremrangebyscore(key, '-inf', now - 60000)
    pipeline.zadd(key, now, `${now}-${Math.random()}`)
    pipeline.zcard(key)
    pipeline.expire(key, 120)
    const results = await pipeline.exec()
    const count = (results?.[2]?.[1] as number) ?? 0
    if (count > 3) {
      logger.warn({ deviceId, count }, 'Rate limit hit — waiting 20s')
      await sleep(20000)
    }
    return
  }
  // In-memory fallback
  const now = Date.now()
  const timestamps = deviceRateLimits.get(deviceId) ?? []
  const recent = timestamps.filter(t => now - t < 60000)
  if (recent.length >= 3) {
    const waitMs = 60000 - (now - recent[0]) + 1000
    logger.warn({ deviceId, waitMs }, 'Rate limit (in-memory) — waiting')
    await sleep(waitMs)
  }
  recent.push(now)
  deviceRateLimits.set(deviceId, recent.slice(-100))
}

// ─── Template variable substitution ──────────────────────────────────────────
function substituteVariables(template: string, contact: Record<string, any>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    // Map template variables to contact fields
    const fieldMap: Record<string, string> = {
      name: contact.name || contact.phone || 'Friend',
      first_name: (contact.name || '').split(' ')[0] || 'Friend',
      last_name: (contact.name || '').split(' ').slice(1).join(' ') || '',
      phone: contact.phone || '',
      email: contact.email || '',
      company: contact.custom_fields?.company || '',
    }
    return fieldMap[key] ?? match  // Return original {{variable}} if not found
  })
}

// ─── Validate JID format ──────────────────────────────────────────────────────
function buildJid(phone: string): string | null {
  const cleaned = phone.replace('+', '').replace(/\D/g, '')
  if (!cleaned || cleaned.length < 7 || cleaned.length > 15) return null
  // Must be all digits, no alpha characters
  if (!/^\d+$/.test(cleaned)) {
    logger.error({ phone, cleaned }, 'Phone contains non-digit characters — invalid E.164')
    return null
  }
  return `${cleaned}@s.whatsapp.net` 
}

/**
 * Single send attempt for a queued campaign message (BullMQ worker or cron fallback)
 */
export async function processCampaignSendJob(data: CampaignSendJobData): Promise<void> {
  const {
    messageId,
    deviceId,
    contactId,
    orgId,
    campaignId,
    content,
    mediaUrl,
    minDelayMs,
    maxDelayMs,
  } = data

  // 1. Get session — FAIL LOUDLY if not available
  const sock = getSession(deviceId)
  if (!sock) {
    logger.error({ deviceId, campaignId, contactId }, 'No active session for device — message NOT sent. Device may need reconnection.')

    // Mark as failed in campaign so operator can see the problem
    await supabase.rpc('increment_campaign_failed', { campaign_id: campaignId })

    healthBatchWriter.add({
      org_id: orgId,
      campaign_id: campaignId,
      device_id: deviceId,
      contact_id: contactId,
      direction: 'outbound',
      type: 'text',
      content,
      status: 'failed',
      error_message: 'Device session not active — reconnect device and retry campaign',
      created_at: new Date().toISOString(),
    })

    throw new Error(`Device ${deviceId} has no active session. Reconnect the device.`)
  }

  // 2. Get campaign to ensure it's still running
  const { data: campaign } = await supabase
    .from('campaigns')
    .select('status')
    .eq('id', campaignId)
    .eq('org_id', orgId)
    .single()

  if (!campaign || campaign.status !== 'running') {
    logger.info({ campaignId, status: campaign?.status }, 'Campaign not running, skipping send')
    return
  }

  // 3. Get message to ensure it's still queued
  const { data: msg } = await supabase
    .from('messages')
    .select('status')
    .eq('id', messageId)
    .single()

  if (!msg || msg.status !== 'queued') {
    logger.debug({ messageId, status: msg?.status }, 'Message not queued, skipping')
    return
  }

  // 4. Get contact (need phone + data for variable substitution)
  const { data: contact, error: contactError } = await supabase
    .from('contacts')
    .select('phone, name, email, custom_fields')
    .eq('id', contactId)
    .single()

  if (contactError || !contact) {
    logger.error({ contactId, error: contactError }, 'Contact not found')
    throw new Error(`Contact ${contactId} not found`)
  }

  // 5. Validate JID
  const jid = buildJid(contact.phone)
  if (!jid) {
    logger.error({ phone: contact.phone, contactId }, 'Invalid phone number format — cannot build JID')
    await supabase.rpc('increment_campaign_failed', { campaign_id: campaignId })
    healthBatchWriter.add({
      org_id: orgId,
      campaign_id: campaignId,
      device_id: deviceId,
      contact_id: contactId,
      direction: 'outbound',
      type: 'text',
      content,
      status: 'failed',
      error_message: `Invalid phone number: ${contact.phone}`,
      created_at: new Date().toISOString(),
    })
    return  // Don't retry — this is a data error
  }

  // 6. Substitute template variables with contact data
  const personalizedContent = substituteVariables(content, {
    name: contact.name,
    phone: contact.phone,
    email: contact.email,
    custom_fields: contact.custom_fields,
  })

  // 7. Anti-ban: enforce rate limit
  // Anti-ban: Human-like delay and presence simulation before sending
  await enforceRateLimit(deviceId)

  // 8. Anti-ban: human-like delay
  const delay = gaussianDelay(minDelayMs, maxDelayMs)
  logger.debug({ deviceId, delay: Math.round(delay / 1000) + 's' }, 'Waiting before send')
  await sleep(delay)

  // 9. Anti-ban: presence simulation
  await presenceSimulator.simulateBeforeSend(sock, jid)

  // 10. Send message
  try {
    const result = await sock.sendMessage(jid, mediaUrl
      ? { image: { url: mediaUrl }, caption: personalizedContent }
      : { text: personalizedContent }
    )

    const waMessageId = result?.key?.id ?? null
    logger.info({ contactId, jid, waMessageId, campaignId }, 'Message sent successfully')

    healthBatchWriter.add({
      org_id: orgId,
      campaign_id: campaignId,
      device_id: deviceId,
      contact_id: contactId,
      direction: 'outbound',
      type: mediaUrl ? 'image' : 'text',
      content: personalizedContent,
      media_url: mediaUrl,
      wa_message_id: waMessageId,
      status: 'sent',
      sent_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    })

    await supabase.rpc('increment_campaign_sent', { campaign_id: campaignId })
    await supabase.rpc('increment_billing_usage', { org_id: orgId, field: 'messages_sent' })

  } catch (error: any) {
    logger.error({ error: error.message, jid, deviceId, campaignId }, 'Send failed')

    // Detect ban signals
    if (error.message?.includes('428') || error.message?.includes('Forbidden') || error.message?.includes('rate-overlimit')) {
      await supabase.from('health_events').insert({
        org_id: orgId,
        device_id: deviceId,
        event_type: 'ban_signal',
        severity: 'critical',
        details: { error: error.message, jid },
      })
    }

    healthBatchWriter.add({
      org_id: orgId,
      campaign_id: campaignId,
      device_id: deviceId,
      contact_id: contactId,
      direction: 'outbound',
      type: 'text',
      content: personalizedContent,
      status: 'failed',
      error_message: error.message,
      created_at: new Date().toISOString(),
    })

    await supabase.rpc('increment_campaign_failed', { campaign_id: campaignId })
    throw error  // Re-throw for BullMQ retry
  }
}

// ─── BullMQ worker ────────────────────────────────────────────────────────────
export const campaignWorker = workerConnection
  ? new Worker(SEND_QUEUE, async (job) => {
      await processCampaignSendJob(job.data)
    }, {
      connection: workerConnection,
      concurrency: config.worker.concurrency,
    })
  : null

export interface EnqueueCampaignParams {
  campaignId: string
  orgId: string
  contacts: { id: string }[]
  templateBody: string
  deviceIds: string[]
  minDelaySeconds: number
  maxDelaySeconds: number
  mediaUrl?: string | null
}

/**
 * Inserts `messages` rows with status `queued`, then enqueues BullMQ jobs or relies on cron when Redis is down.
 */
export async function enqueueCampaignMessages(params: EnqueueCampaignParams): Promise<void> {
  const {
    campaignId,
    orgId,
    contacts,
    templateBody,
    deviceIds,
    minDelaySeconds,
    maxDelaySeconds,
    mediaUrl,
  } = params

  const minDelayMs = minDelaySeconds * 1000
  const maxDelayMs = maxDelaySeconds * 1000

  for (let index = 0; index < contacts.length; index++) {
    const deviceId = deviceIds[index % deviceIds.length]
    const contact = contacts[index]

    const { data: message } = await supabase
      .from('messages')
      .insert({
        org_id: orgId,
        campaign_id: campaignId,
        device_id: deviceId,
        contact_id: contact.id,
        direction: 'outbound',
        type: mediaUrl ? 'image' : 'text',
        content: templateBody,
        media_url: mediaUrl,
        status: 'queued',
        created_at: new Date().toISOString(),
      })
      .select('id')
      .single()

    if (!message) {
      logger.error({ campaignId, contactId: contact.id }, 'Failed to create message row')
      continue
    }

    if (campaignQueue) {
      await campaignQueue.add('send', {
        messageId: message.id,
        deviceId,
        contactId: contact.id,
        orgId,
        campaignId,
        content: templateBody,
        mediaUrl,
        minDelayMs,
        maxDelayMs,
      })
    }
    // When Redis is down, cron fallback will pick up queued messages, 
  }
}
