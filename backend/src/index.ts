import express from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import helmet from 'helmet'
import { config, serviceStatus } from './lib/config.js'
import { logger } from './lib/logger.js'
import { supabase } from './lib/supabase.js'
import { connectDevice, getAllSessions } from './modules/session/sessionManager.js'

// Import routes
import authRoutes from './routes/auth.js'
import deviceRoutes from './routes/devices.js'
import contactRoutes from './routes/contacts.js'
import campaignRoutes from './routes/campaigns.js'
import templateRoutes from './routes/templates.js'
import inboxRoutes from './routes/inbox.js'
import analyticsRoutes from './routes/analytics.js'
import setupRoutes from './routes/setup.js'
import autoReplyRoutes from './routes/autoReply.js'
import flowsRoutes from './routes/flows.js'
import antiBanRoutes from './routes/antiBan.js'
import aiStudioRoutes from './routes/aiStudio.js'
import settingsRoutes from './routes/settings.js'
import billingRoutes from './routes/billing.js'
import messagesRoutes from './routes/messages.js'
import webhooksRoutes from './routes/webhooks.js'

// Import campaign worker to ensure it starts (CRITICAL — without this, BullMQ jobs never process)
import './modules/queue/campaignProcessor.js'

const app = express()

app.use(helmet())
app.use(cors({
  origin: config.server.corsOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Cookie'],
}))
app.use(express.json({ limit: '50mb' }))
app.use(express.urlencoded({ extended: true, limit: '50mb' }))
app.use(cookieParser())

// Routes
app.use('/api/v1/setup', setupRoutes)
app.use('/api/v1/auth', authRoutes)
app.use('/api/v1/devices', deviceRoutes)
app.use('/api/v1/contacts', contactRoutes)
app.use('/api/v1/campaigns', campaignRoutes)
app.use('/api/v1/templates', templateRoutes)
app.use('/api/v1/inbox', inboxRoutes)
app.use('/api/v1/analytics', analyticsRoutes)
app.use('/api/v1/auto-reply', autoReplyRoutes)
app.use('/api/v1/flows', flowsRoutes)
app.use('/api/v1/anti-ban', antiBanRoutes)
app.use('/api/v1/ai-studio', aiStudioRoutes)
app.use('/api/v1/settings', settingsRoutes)
app.use('/api/v1/billing', billingRoutes)
app.use('/api/v1/messages', messagesRoutes)
app.use('/api/v1/webhooks', webhooksRoutes)

// ── Debug endpoint (no auth — for development) ────────────────────────────────
app.get('/api/v1/debug', async (req, res) => {
  const activeSessions = [...getAllSessions().keys()]

  const { data: dbDevices } = await supabase
    .from('whatsapp_devices')
    .select('id, name, status, phone_number')

  const sessionDbMismatch = (dbDevices || []).filter(d =>
    d.status === 'connected' && !activeSessions.includes(d.id)
  )

  res.json({
    activeSessions: activeSessions.length,
    sessionIds: activeSessions,
    dbDevices: dbDevices?.map(d => ({
      id: d.id,
      name: d.name,
      status: d.status,
      phone: d.phone_number,
      hasSession: activeSessions.includes(d.id),
    })),
    mismatch: sessionDbMismatch.map(d => ({
      ...d,
      problem: 'DB says connected but no session in memory — backend was restarted',
    })),
    services: serviceStatus,
    time: new Date().toISOString(),
    hint: sessionDbMismatch.length > 0
      ? 'Run: npm run dev:stable (no watch mode) — OR — go to Devices page and reconnect'
      : 'All sessions OK',
  })
})

// ── Error handler ─────────────────────────────────────────────────────────────
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('[ERROR]', err)
  res.status(500).json({ error: 'Internal server error', message: err.message })
})

// ── Startup ───────────────────────────────────────────────────────────────────
const PORT = config.server.port

app.listen(PORT, async () => {
  console.log(`\n[STARTUP] ══════════════════════════════`)
  console.log(`[STARTUP] 🚀 WA Intelligence Backend`)
  console.log(`[STARTUP] Port: ${PORT}`)
  console.log(`[STARTUP] Mode: ${config.server.nodeEnv}`)
  console.log(`[STARTUP] AI: ${serviceStatus.ai ? '✅' : '❌'} | Queue: ${serviceStatus.queue ? '✅ Redis' : '⚠️ Cron fallback'} | Stripe: ${serviceStatus.stripe ? '✅' : '❌'}`)
  console.log(`[STARTUP] ══════════════════════════════\n`)

  // Auto-reconnect all previously-connected devices after 3s (give DB time to respond)
  setTimeout(reconnectAllDevices, 3_000)

  // Session health check every 5 minutes
  setInterval(sessionHealthCheck, 5 * 60 * 1000)
})

// ── Startup reconnection ───────────────────────────────────────────────────────
async function reconnectAllDevices() {
  console.log('[STARTUP] 🔄 Fetching previously connected devices...')

  try {
    const { data: devices, error } = await supabase
      .from('whatsapp_devices')
      .select('id, org_id, name, status')
      .in('status', ['connected', 'connecting'])

    if (error) {
      console.error('[STARTUP] ❌ Failed to fetch devices:', error.message)
      return
    }

    if (!devices || devices.length === 0) {
      console.log('[STARTUP] ℹ️ No devices to reconnect')
      return
    }

    console.log(`[STARTUP] 📱 Reconnecting ${devices.length} device(s): ${devices.map(d => d.name).join(', ')}`)

    for (let i = 0; i < devices.length; i++) {
      const device = devices[i]
      const delay = i * 4_000  // 4s stagger to avoid hammering WhatsApp
      setTimeout(async () => {
        console.log(`[STARTUP] 🔌 Reconnecting: ${device.name} (${device.id})`)
        try {
          await connectDevice(device.id, device.org_id)
        } catch (err: any) {
          console.error(`[STARTUP] ❌ Failed to reconnect ${device.name}:`, err.message)
        }
      }, delay)
    }
  } catch (err: any) {
    console.error('[STARTUP] ❌ reconnectAllDevices error:', err.message)
  }
}

// ── Session health check ───────────────────────────────────────────────────────
async function sessionHealthCheck() {
  try {
    const activeSessions = getAllSessions()
    const { data: connectedDevices } = await supabase
      .from('whatsapp_devices')
      .select('id, org_id, name')
      .eq('status', 'connected')

    if (!connectedDevices) return

    const drifted = connectedDevices.filter(d => !activeSessions.has(d.id))

    if (drifted.length > 0) {
      console.log(`[HEALTH] ⚠️ Session drift detected — ${drifted.length} device(s) reconnecting:`, drifted.map(d => d.name))
      for (const device of drifted) {
        connectDevice(device.id, device.org_id).catch(err =>
          console.error(`[HEALTH] ❌ Drift reconnect failed for ${device.name}:`, err.message)
        )
      }
    }
  } catch { /* non-critical */ }
}
