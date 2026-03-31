import makeWASocket, {
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  WASocket,
} from '@whiskeysockets/baileys'
import { Boom } from '@hapi/boom'
import Pino from 'pino'
import { useDBAuthState } from './dbAuthState.js'
import { supabase } from '../../lib/supabase.js'
import { logger } from '../../lib/logger.js'
import { inboxHandler } from '../inbox/inboxHandler.js'
import { autoReplyEngine } from '../inbox/autoReplyEngine.js'
import { qrManager } from './qrManager.js'
import { healthBatchWriter } from '../../lib/batchWriter.js'

const sessions = new Map<string, WASocket>()
const reconnectAttempts = new Map<string, number>()
const connectionTimeouts = new Map<string, NodeJS.Timeout>()
const stopDetectionMap = new Map<string, number>()

const MAX_RECONNECT_ATTEMPTS = 3
const CONNECTION_TIMEOUT_MS = 30_000
const STOP_KEYWORDS = {
  en: ['stop', 'quit', 'exit'],
  es: ['parar', 'dejar', 'salir'],
  pt: ['parar', 'sair', 'desistir'],
  fr: ['arrêter', 'quitter', 'abandonner'],
  de: ['stoppen', 'beenden', 'ausstieg'],
  ar: ['توقف', 'إيقاف', 'خروج'],
}

const BROWSER_POOL: Array<[string, string, string]> = [
  ['WA Intelligence', 'Chrome', '120.0.6099.119'],
  ['WA Intelligence', 'Firefox', '121.0'],
  ['WA Intelligence', 'Safari', '17.2'],
  ['WA Intelligence', 'Edge', '120.0.2210.91'],
  ['WA Intelligence', 'Opera', '106.0.4998.70'],
]

function gaussianJitter(baseMs: number): number {
  let u = 0
  let v = 0
  while (u === 0) u = Math.random()
  while (v === 0) v = Math.random()
  const normal = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
  return Math.max(1000, Math.round(baseMs + baseMs * 0.2 * normal))
}

function getReconnectDelay(attempt: number): number {
  const cappedAttempt = Math.min(attempt, MAX_RECONNECT_ATTEMPTS)
  const base = Math.min(60_000, 4_000 * 2 ** cappedAttempt)
  return gaussianJitter(base)
}

/**
 * Check if text contains STOP signal in any supported language
 */
function detectStop(text?: string): boolean {
  if (!text) return false
  const lower = text.toLowerCase().trim()
  for (const keywords of Object.values(STOP_KEYWORDS)) {
    if (keywords.includes(lower)) return true
  }
  return false
}

async function recordHealthEvent(orgId: string, deviceId: string, eventType: string, severity: 'info' | 'warning' | 'critical', details: Record<string, unknown>) {
  healthBatchWriter.add({
    org_id: orgId,
    device_id: deviceId,
    event_type: eventType,
    severity,
export async function connectDevice(deviceId: string, orgId: string): Promise<void> {
  if (sessions.has(deviceId)) {
    console.log(`[SESSION] ✅ Device ${deviceId} already has active session`)
    return
  }

  if (connectingDevices.has(deviceId)) {
    console.log(`[SESSION] ⏳ Device ${deviceId} already connecting — skipping duplicate`)
    return
  }

  connectingDevices.add(deviceId)
  console.log(`[SESSION] 🔌 Connecting device ${deviceId} for org ${orgId}`)

  try {
    const { state, saveCreds } = await useDBAuthState(deviceId)
    const { version } = await fetchLatestBaileysVersion()
    const browser = BROWSER_POOL[Math.floor(Math.random() * BROWSER_POOL.length)]

    const sock = makeWASocket({
      version,
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, Pino({ level: 'silent' })),
      },
      browser,
      printQRInTerminal: false,
      logger: Pino({ level: 'silent' }),
      markOnlineOnConnect: false,
      syncFullHistory: false,
      retryRequestDelayMs: 2000,
      maxMsgRetryCount: 3,
    })

    sessions.set(deviceId, sock)

    sock.ev.on('creds.update', saveCreds)

    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update

      if (qr) {
        console.log(`[SESSION] 📱 QR ready for device ${deviceId}`)
        try {
          const QRCode = (await import('qrcode')).default
          const qrDataUrl = await QRCode.toDataURL(qr)
          await supabase.from('whatsapp_devices').update({
            qr_code: qrDataUrl,
            status: 'connecting',
            updated_at: new Date().toISOString(),
          }).eq('id', deviceId)
        } catch (err) {
          console.error(`[SESSION] ❌ QR generation failed for ${deviceId}:`, err)
        }
      }

      if (connection === 'open') {
        connectingDevices.delete(deviceId)
        if (!sock.user) {
          console.warn(`[SESSION] ⚠️ Connected but sock.user is null for ${deviceId} — disconnecting`)
          await disconnectDevice(deviceId)
          return
        }
        const phoneNumber = sock.user.id.split(':')[0]
        console.log(`[SESSION] ✅ Device ${deviceId} CONNECTED — phone: ${phoneNumber}`)
        await supabase.from('whatsapp_devices').update({
          status: 'connected',
          phone_number: phoneNumber,
          qr_code: null,
          last_active: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }).eq('id', deviceId)
      }

      if (connection === 'close') {
        sessions.delete(deviceId)
        connectingDevices.delete(deviceId)

        const boom = lastDisconnect?.error as Boom
        const code = boom?.output?.statusCode
        console.log(`[SESSION] 🔌 Device ${deviceId} disconnected — code: ${code}`)

        if (code === DisconnectReason.loggedOut) {
          console.error(`[SESSION] 🚫 Device ${deviceId} BANNED/LOGGED OUT — NOT reconnecting`)
          await supabase.from('whatsapp_devices').update({
            status: 'banned',
            qr_code: null,
            updated_at: new Date().toISOString(),
          }).eq('id', deviceId)
        } else if (code === DisconnectReason.badSession) {
          console.warn(`[SESSION] 🗑️ Device ${deviceId} bad session — clearing keys and reconnecting`)
          await supabase.from('wa_session_keys').delete().eq('device_id', deviceId)
          await supabase.from('whatsapp_devices').update({
            status: 'disconnected',
            updated_at: new Date().toISOString(),
          }).eq('id', deviceId)
          setTimeout(() => connectDevice(deviceId, orgId), 5_000)
        } else if (code === DisconnectReason.connectionReplaced) {
          await supabase.from('whatsapp_devices').update({
            status: 'disconnected',
            updated_at: new Date().toISOString(),
          }).eq('id', deviceId)
        } else {
          // Network error or unknown — reconnect after delay
          await supabase.from('whatsapp_devices').update({
            status: 'disconnected',
            updated_at: new Date().toISOString(),
          }).eq('id', deviceId)
          const delay = (code === DisconnectReason.connectionLost || code === DisconnectReason.timedOut) ? 10_000 : 15_000
          console.log(`[SESSION] ⏳ Reconnecting device ${deviceId} in ${delay/1000}s...`)
          setTimeout(() => connectDevice(deviceId, orgId), delay)
        }
      }
    })

    // Import message handlers (static — no dynamic import race)
    const { inboxHandler } = await import('../inbox/inboxHandler.js')
    const { autoReplyEngine } = await import('../inbox/autoReplyEngine.js')

    sock.ev.on('messages.upsert', async ({ messages, type }) => {
      if (type !== 'notify') return
      for (const msg of messages) {
        if (msg.key.fromMe) continue
        try {
          await inboxHandler.processInbound(msg, deviceId, orgId, sock)
          await autoReplyEngine.checkAndReply(msg, deviceId, orgId, sock)
        } catch (err) {
          console.error(`[SESSION] ❌ Error processing inbound message for ${deviceId}:`, err)
        }
      }
    })

    // Track delivery receipts
    sock.ev.on('messages.update', async (updates) => {
      for (const update of updates) {
        if (!update.update.status || !update.key.id) continue
        const statusMap: Record<number, string> = { 1: 'sent', 2: 'sent', 3: 'delivered', 4: 'read' }
        const newStatus = statusMap[update.update.status as number]
        if (!newStatus) continue

        try {
          const { data: msg } = await supabase
            .from('messages')
            .select('campaign_id')
            .eq('wa_message_id', update.key.id)
            .single()

          await supabase.rpc('update_message_status', {
            wa_message_id_param: update.key.id,
            new_status: newStatus,
            campaign_id_param: msg?.campaign_id || null,
          }).then(() => {}).catch(() => {})
        } catch { /* non-critical */ }
      }
    })

  } catch (err) {
    connectingDevices.delete(deviceId)
    console.error(`[SESSION] ❌ connectDevice failed for ${deviceId}:`, err)
    throw err
  }
}

// ── Wait for a session to become ready (used by campaign processor) ──────────
export async function waitForSession(deviceId: string, orgId: string, timeoutMs = 30_000): Promise<WASocket | null> {
  // Check immediately
  let sock = sessions.get(deviceId)
  if (sock) return sock

  // Try to reconnect
  console.log(`[SESSION] 🔄 waitForSession: no session for ${deviceId} — triggering reconnect`)
  try {
    await connectDevice(deviceId, orgId)
  } catch (err) {
    console.error(`[SESSION] ❌ Reconnect failed in waitForSession:`, err)
    return null
  }

  // Poll until connected or timeout
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    sock = sessions.get(deviceId)
    if (sock) {
      console.log(`[SESSION] ✅ waitForSession: device ${deviceId} ready after ${Date.now() - start}ms`)
      return sock
    }
    await new Promise(resolve => setTimeout(resolve, 1000))
  }

  console.error(`[SESSION] ❌ waitForSession: device ${deviceId} timed out after ${timeoutMs}ms`)
  return null
}

// ── Disconnect ────────────────────────────────────────────────────────────────
export async function disconnectDevice(deviceId: string): Promise<void> {
  const sock = sessions.get(deviceId)
  if (sock) {
    try { await sock.logout() } catch { }
    try { sock.end(undefined) } catch { }
    sessions.delete(deviceId)
  }
  connectingDevices.delete(deviceId)
  await supabase.from('whatsapp_devices').update({
    status: 'disconnected',
    qr_code: null,
    updated_at: new Date().toISOString(),
  }).eq('id', deviceId)
  console.log(`[SESSION] 🔌 Device ${deviceId} disconnected and cleaned up`)
}

// ── Boot reconnect for devices left as connected ───────────────────────────────
export async function reconnectConnectedDevicesOnBoot(): Promise<void> {
  const { data: devices, error } = await supabase
    .from('whatsapp_devices')
    .select('id, org_id, name')
    .eq('status', 'connected')

  if (error) {
    console.error('[BOOT] ❌ Failed to list connected devices:', error.message)
    return
  }

  if (!devices?.length) {
    console.log('[BOOT] ℹ️ No devices in connected state')
    return
  }

  console.log(`[BOOT] 🔄 Reconnecting ${devices.length} device(s): ${devices.map(d => d.name).join(', ')}`)

  for (let i = 0; i < devices.length; i++) {
    const device = devices[i]
    const delay = i * 4_000  // 4s stagger to avoid hammering WhatsApp
    setTimeout(async () => {
      console.log(`[BOOT] 🔌 Reconnecting: ${device.name} (${device.id})`)
      try {
        await connectDevice(device.id, device.org_id)
      } catch (err: any) {
        console.error(`[BOOT] ❌ Failed to reconnect ${device.name}:`, err.message)
      }
    }, delay)
  }
}

// ── Exports ───────────────────────────────────────────────────────────────────
export function getSession(deviceId: string): WASocket | undefined {
  return sessions.get(deviceId)
}

export function getAllSessions(): Map<string, WASocket> {
  return sessions
}

export function getSessionCount(): number {
  return sessions.size
}
