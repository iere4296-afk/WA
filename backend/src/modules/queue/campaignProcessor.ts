import { Worker, Queue } from 'bullmq'
import { getSession, waitForSession } from '../session/sessionManager.js'
import { supabase } from '../../lib/supabase.js'
import { batchWriter } from '../../lib/batchWriter.js'
import { config } from '../../lib/config.js'
import Redis from 'ioredis'

const SEND_QUEUE = 'campaign-send'

// ── Redis connection (optional — falls back to cron) ─────────────────────────
export const redisConnection = config.redis.ready
  ? new Redis(config.redis.url, { maxRetriesPerRequest: null, enableReadyCheck: false })
  : null

if (redisConnection) {
  redisConnection.on('connect', () => console.log('[QUEUE] ✅ Redis connected'))
  redisConnection.on('error', (err) => console.error('[QUEUE] ❌ Redis error:', err.message))
}

export const campaignQueue = redisConnection
  ? new Queue(SEND_QUEUE, {
      connection: redisConnection,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 10_000 },
        removeOnComplete: 100,
        removeOnFail: 500,
      },
    })
  : null

// Management queue for device operations
export const managementQueue = redisConnection
  ? new Queue('device-management', {
      connection: redisConnection,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5_000 },
        removeOnComplete: 50,
        removeOnFail: 200,
      },
    })
  : null

// ── Helpers ───────────────────────────────────────────────────────────────────
function gaussianDelay(minMs: number, maxMs: number): number {
  const mean = (minMs + maxMs) / 2
  const std = (maxMs - minMs) / 6
  let u = 0, v = 0
  while (u === 0) u = Math.random()
  while (v === 0) v = Math.random()
  const n = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v)
  return Math.max(minMs, Math.min(maxMs, mean + std * n))
}

function sleep(ms: number) {
  return new Promise<void>(r => setTimeout(r, ms))
}

function substituteVariables(template: string, contact: Record<string, any>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    const map: Record<string, string> = {
      name:       contact.name || 'Friend',
      first_name: (contact.name || '').split(' ')[0] || 'Friend',
      phone:      contact.phone || '',
      email:      contact.email || '',
    }
    return map[key] ?? match
  })
}

function buildJid(phone: string): string | null {
  const cleaned = phone.replace(/[^\d]/g, '')
  if (!cleaned || cleaned.length < 7 || cleaned.length > 15) return null
  return `${cleaned}@s.whatsapp.net` 
}

const deviceRateLimits = new Map<string, number[]>()
async function enforceRateLimit(deviceId: string) {
  const now = Date.now()
  const ts = (deviceRateLimits.get(deviceId) ?? []).filter(t => now - t < 60_000)
  if (ts.length >= 3) {
    const wait = 60_000 - (now - ts[0]) + 1_000
    console.log(`[SEND] ⏳ Rate limit — waiting ${Math.round(wait/1000)}s for device ${deviceId}`)
    await sleep(wait)
  }
  ts.push(Date.now())
  deviceRateLimits.set(deviceId, ts.slice(-100))
}

// ── Core send function ────────────────────────────────────────────────────────
export async function sendCampaignMessage(job: {
  deviceId: string
  contactId: string
  orgId: string
  campaignId: string
  content: string
  mediaUrl?: string
  minDelay?: number
  maxDelay?: number
}): Promise<void> {
  const { deviceId, contactId, orgId, campaignId, content, mediaUrl, minDelay = 30_000, maxDelay = 120_000 } = job

  console.log(`[SEND] 📤 Starting send — campaign:${campaignId} contact:${contactId} device:${deviceId}`)

  // 1. Get OR reconnect session
  let sock = getSession(deviceId)

  if (!sock) {
    console.warn(`[SEND] ⚠️ No session for device ${deviceId} — attempting auto-reconnect...`)
    const { data: device } = await supabase
      .from('whatsapp_devices')
      .select('org_id, status')
      .eq('id', deviceId)
      .single()

    if (!device) {
      console.error(`[SEND] ❌ Device ${deviceId} not found in DB`)
      await recordFailure(job, 'Device not found in database')
      return
    }

    if (device.status === 'banned') {
      console.error(`[SEND] 🚫 Device ${deviceId} is BANNED — cannot reconnect`)
      await recordFailure(job, 'Device is banned')
      return
    }

    const reconnectedSock = await waitForSession(deviceId, orgId, 30_000)
    if (reconnectedSock) {
      sock = reconnectedSock
    }

    if (!sock) {
      console.error(`[SEND] ❌ Auto-reconnect FAILED for device ${deviceId} — marking as failed`)
      await recordFailure(job, 'Device session could not be established — please reconnect device via QR')
      throw new Error(`Device ${deviceId} reconnection failed`)
    }
    console.log(`[SEND] ✅ Auto-reconnect SUCCESS for device ${deviceId}`)
  }

  // 2. Get contact
  const { data: contact, error: contactErr } = await supabase
    .from('contacts')
    .select('phone, name, email, custom_fields')
    .eq('id', contactId)
    .single()

  if (contactErr || !contact) {
    console.error(`[SEND] ❌ Contact ${contactId} not found`)
    await recordFailure(job, `Contact not found: ${contactId}`)
    return
  }

  // 3. Build and validate JID
  const jid = buildJid(contact.phone)
  if (!jid) {
    console.error(`[SEND] ❌ Invalid phone number: "${contact.phone}" for contact ${contactId}`)
    await recordFailure(job, `Invalid phone number: ${contact.phone}`)
    return  // Don't throw — this contact is bad data, don't retry
  }

  console.log(`[SEND] 📱 Sending to JID: ${jid} (${contact.name || 'Unknown'})`)

  // 4. Substitute variables
  const personalizedContent = substituteVariables(content, contact)

  // 5. Anti-ban: rate limit
  await enforceRateLimit(deviceId)

  // 6. Anti-ban: human delay
  const delay = gaussianDelay(minDelay, maxDelay)
  console.log(`[SEND] ⏳ Waiting ${Math.round(delay/1000)}s before send (anti-ban delay)`)
  await sleep(delay)

  // 7. Anti-ban: typing simulation
  try {
    await sock.sendPresenceUpdate('available', jid)
    await sleep(500 + Math.random() * 1500)
    await sock.sendPresenceUpdate('composing', jid)
    await sleep(1500 + Math.random() * 2500)
    await sock.sendPresenceUpdate('paused', jid)
    await sleep(200 + Math.random() * 600)
  } catch (presenceErr) {
    console.warn(`[SEND] ⚠️ Presence simulation failed (non-fatal):`, presenceErr)
  }

  // 8. Send
  try {
    const result = await sock.sendMessage(jid, mediaUrl
      ? { image: { url: mediaUrl }, caption: personalizedContent }
      : { text: personalizedContent }
    )
    const waMessageId = result?.key?.id ?? null
    console.log(`[SEND] ✅ Message sent! wa_id:${waMessageId} → ${jid}`)

    batchWriter.add({
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

    await supabase.rpc('increment_campaign_sent', { campaign_id: campaignId }).then(() => {})
    await supabase.rpc('increment_billing_usage', { org_id: orgId, field: 'messages_sent' }).then(() => {})

  } catch (err: any) {
    console.error(`[SEND] ❌ Send failed for ${jid}:`, err.message)

    // Detect ban signal
    if (err.message?.includes('428') || err.message?.includes('rate-overlimit') || err.message?.includes('Forbidden')) {
      await supabase.from('health_events').insert({
        org_id: orgId,
        device_id: deviceId,
        event_type: 'ban_signal',
        severity: 'critical',
        details: { error: err.message, jid },
      }).then(() => {})
    }

    await recordFailure(job, err.message)
    throw err  // Let BullMQ retry
  }
}

async function recordFailure(job: { orgId: string; campaignId: string; deviceId: string; contactId: string; content: string }, reason: string) {
  batchWriter.add({
    org_id: job.orgId,
    campaign_id: job.campaignId,
    device_id: job.deviceId,
    contact_id: job.contactId,
    direction: 'outbound',
    type: 'text',
    content: job.content,
    status: 'failed',
    error_message: reason,
    created_at: new Date().toISOString(),
  })
  await supabase.rpc('increment_campaign_failed', { campaign_id: job.campaignId }).then(() => {})
}

// ── BullMQ worker ─────────────────────────────────────────────────────────────
export const campaignWorker = redisConnection
  ? new Worker(SEND_QUEUE, async (job) => {
      await sendCampaignMessage(job.data)
    }, {
      connection: redisConnection,
      concurrency: config.worker.concurrency,
    })
  : null

if (campaignWorker) {
  campaignWorker.on('completed', (job) => console.log(`[QUEUE] ✅ Job ${job.id} completed`))
  campaignWorker.on('failed', (job, err) => console.error(`[QUEUE] ❌ Job ${job?.id} failed:`, err.message))
}

// ── node-cron fallback ────────────────────────────────────────────────────────
export async function scheduleCampaignWithCron(
  campaignId: string,
  contacts: Array<{ id: string; phone: string; name?: string; email?: string }>,
  deviceIds: string[],
  orgId: string,
  content: string,
  delays: { min: number; max: number },
  mediaUrl?: string,
): Promise<void> {
  const cron = (await import('node-cron')).default
  let index = 0
  let consecutiveErrors = 0

  console.log(`[CRON] 🚀 Starting cron campaign — ${contacts.length} contacts, devices: ${deviceIds.join(', ')}`)

  const task = cron.schedule('*/8 * * * * *', async () => {
    if (index >= contacts.length) {
      console.log(`[CRON] ✅ Campaign ${campaignId} COMPLETED via cron`)
      task.stop()
      await supabase.from('campaigns').update({
        status: 'completed',
        completed_at: new Date().toISOString(),
      }).eq('id', campaignId)
      return
    }

    if (consecutiveErrors >= 5) {
      console.error(`[CRON] ❌ Campaign ${campaignId} paused — 5 consecutive errors`)
      task.stop()
      await supabase.from('campaigns').update({
        status: 'paused',
        updated_at: new Date().toISOString(),
      }).eq('id', campaignId)
      return
    }

    const contact = contacts[index]
    const deviceId = deviceIds[index % deviceIds.length]
    index++

    console.log(`[CRON] 📤 Processing contact ${index}/${contacts.length}: ${contact.phone}`)

    try {
      await sendCampaignMessage({
        deviceId,
        contactId: contact.id,
        orgId,
        campaignId,
        content,
        mediaUrl,
        minDelay: delays.min * 1000,
        maxDelay: delays.max * 1000,
      })
      consecutiveErrors = 0
    } catch (err: any) {
      consecutiveErrors++
      console.error(`[CRON] ⚠️ Send error (${consecutiveErrors}/5):`, err.message)
    }
  })

  console.log(`[CRON] ✅ Cron task scheduled — fires every 8 seconds`)
}

// ── Legacy exports for compatibility ───────────────────────────────────────────
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

export async function processCampaignSendJob(data: CampaignSendJobData): Promise<void> {
  await sendCampaignMessage({
    deviceId: data.deviceId,
    contactId: data.contactId,
    orgId: data.orgId,
    campaignId: data.campaignId,
    content: data.content,
    mediaUrl: data.mediaUrl || undefined,
    minDelay: data.minDelayMs,
    maxDelay: data.maxDelayMs,
  })
}

export async function enqueueCampaignMessages(params: EnqueueCampaignParams): Promise<void> {
  const { campaignId, orgId, contacts, templateBody, deviceIds, minDelaySeconds, maxDelaySeconds, mediaUrl } = params

  // Create message rows
  for (let i = 0; i < contacts.length; i++) {
    const deviceId = deviceIds[i % deviceIds.length]
    const contact = contacts[i]

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
      console.error(`[QUEUE] ❌ Failed to create message row for contact ${contact.id}`)
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
        minDelayMs: minDelaySeconds * 1000,
        maxDelayMs: maxDelaySeconds * 1000,
      })
    }
  }

  // If no Redis, fallback to cron
  if (!campaignQueue) {
    const { data: contactData } = await supabase
      .from('contacts')
      .select('id, phone, name, email')
      .in('id', contacts.map(c => c.id))

    if (contactData) {
      await scheduleCampaignWithCron(
        campaignId,
        contactData,
        deviceIds,
        orgId,
        templateBody,
        { min: minDelaySeconds, max: maxDelaySeconds },
        mediaUrl || undefined
      )
    }
  }
}
