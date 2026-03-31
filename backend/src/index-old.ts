import 'express-async-errors'
import express, { Request, Response, NextFunction } from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import helmet from 'helmet'
import { Boom } from '@hapi/boom'
import { config, serviceStatus } from './lib/config.js'
import { logger } from './lib/logger.js'
import { isRedisReady, getRedisClient } from './lib/redis.js'
import { authenticate } from './lib/authenticate.js'
import { tierRateLimit } from './lib/rateLimiter.js'
import { reconnectConnectedDevicesOnBoot } from './modules/session/sessionManager.js'
import { cronFallback } from './modules/queue/cronFallback.js'

import authRoutes from './routes/auth.js'
import deviceRoutes from './routes/devices.js'
import contactRoutes from './routes/contacts.js'
import campaignRoutes from './routes/campaigns.js'
import templateRoutes from './routes/templates.js'
import inboxRoutes from './routes/inbox.js'
import analyticsRoutes from './routes/analytics.js'
import setupRoutes from './routes/setup.js'

// New routes
import autoReplyRoutes from './routes/autoReply.js'
import flowRoutes from './routes/flows.js'
import antiBanRoutes from './routes/antiBan.js'
import aiStudioRoutes from './routes/aiStudio.js'
import settingsRoutes from './routes/settings.js'
import billingRoutes from './routes/billing.js'
import messageRoutes from './routes/messages.js'
import webhookRoutes from './routes/webhooks.js'

// Ensure TZ=UTC (already checked in config.ts, but verify here too)
if (process.env.TZ !== 'UTC') {
  logger.warn('WARNING: TZ is not UTC. Timestamp calculations may be wrong.')
}

const app = express()

// Security middleware
app.use(helmet())
app.use(cors({
  origin: config.server.corsOrigins,
  credentials: true,
}))

// Stripe webhook needs raw body (register BEFORE json middleware)
app.post('/api/v1/billing/webhook', express.raw({ type: 'application/json' }))

// JSON parser
app.use(express.json({ limit: '10mb' }))

// Cookie parser
app.use(cookieParser())

// ═══════════════════════════════════════════════════════════════
// Public Endpoints (no auth required)
// ═══════════════════════════════════════════════════════════════

// Health check (no rate limit, no auth)
app.get('/api/v1/health', (req: Request, res: Response) => {
  const redis = getRedisClient()
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    supabase: config.supabase.ready,
    redis: redis?.status === 'ready' || isRedisReady(),
    ai: serviceStatus.ai,
  })
})

// Setup status (no rate limit, no auth)
app.use('/api/v1/setup', setupRoutes)

// Auth routes (no auth middleware, but has auth rate limiter)
app.use('/api/v1/auth', authRoutes)

// Webhook routes (no auth middleware, has signature verification)
app.use('/api/v1/webhooks', webhookRoutes)

// ═══════════════════════════════════════════════════════════════
// Protected Routes (auth required + rate limited)
// ═══════════════════════════════════════════════════════════════

// Apply auth middleware to all subsequent routes
app.use('/api/v1/', authenticate)

// Apply per-tier rate limiting to protected routes
// Note: auth routes are rate limited separately to allow for stricter
app.use('/api/v1/', tierRateLimit)

// Protected routes
app.use('/api/v1/devices', deviceRoutes)
app.use('/api/v1/contacts', contactRoutes)
app.use('/api/v1/campaigns', campaignRoutes)
app.use('/api/v1/templates', templateRoutes)
app.use('/api/v1/inbox', inboxRoutes)
app.use('/api/v1/analytics', analyticsRoutes)
app.use('/api/v1/auto-reply', autoReplyRoutes)
app.use('/api/v1/flows', flowRoutes)
app.use('/api/v1/anti-ban', antiBanRoutes)
app.use('/api/v1/ai-studio', aiStudioRoutes)
app.use('/api/v1/settings', settingsRoutes)
app.use('/api/v1/billing', billingRoutes)
app.use('/api/v1/messages', messageRoutes)

// ═══════════════════════════════════════════════════════════════
// 404 Handler
// ═══════════════════════════════════════════════════════════════
app.use((req: Request, res: Response) => {
  res.status(404).json({ error: 'Not found' })
})

// ═══════════════════════════════════════════════════════════════
// Error Handler (must be last)
// ═══════════════════════════════════════════════════════════════
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  logger.error({ err, path: req.path, method: req.method }, 'Unhandled error')

  // Handle Boom errors (from @hapi/boom)
  if (err && typeof err.output === 'object') {
    const boom = err as Boom
    return res.status(boom.output.statusCode).json(boom.output.payload)
  }

  // Handle validation errors
  if (err.statusCode === 400) {
    return res.status(400).json({ error: err.message || 'Bad request' })
  }

  // Default 500 error
  res.status(500).json({ error: 'Internal server error' })
})

// ═══════════════════════════════════════════════════════════════
// Start Server
// ═══════════════════════════════════════════════════════════════
const PORT = config.server.port

app.listen(PORT, () => {
  logger.info(
    {
      port: PORT,
      env: config.server.nodeEnv,
      services: {
        ai: serviceStatus.ai,
        redis: isRedisReady(),
        stripe: serviceStatus.stripe,
      },
    },
    '▲ Server Started'
  )

  void reconnectConnectedDevicesOnBoot().catch((err) => {
    logger.error({ err }, 'Boot reconnect for connected devices failed')
  })

  cronFallback.start()
})
// void reconnectConnectedDevicesOnBoot().catch((err)
// logger.error())
