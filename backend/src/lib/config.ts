import 'dotenv/config'

const ENCRYPTION_KEY_PATTERN = /^[a-fA-F0-9]{64}$/
const hasValidEncryptionKey = ENCRYPTION_KEY_PATTERN.test(process.env.ENCRYPTION_KEY || '')
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || ''
const encryptionBuffer = Buffer.from(ENCRYPTION_KEY, 'hex')

const trimEnv = (value: string | undefined) => value?.trim() || ''
const splitCsv = (value: string | undefined, fallback: string[]) => {
  const items = (value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)

  return items.length > 0 ? items : fallback
}

const groqApiKey = trimEnv(process.env.GROQ_API_KEY)
const groqModelFast = trimEnv(process.env.GROQ_MODEL_FAST) || 'llama-3.1-8b-instant'
const groqModelSmart = trimEnv(process.env.GROQ_MODEL_SMART) || 'llama-3.3-70b-versatile'
// Groq no longer lists `llama-3.1-70b-versatile` as a production model on 2026-03-31,
// so we default quality traffic to the supported 3.3 70B model.
const groqModelQuality = trimEnv(process.env.GROQ_MODEL_QUALITY) || 'llama-3.3-70b-versatile'
const openaiApiKey = trimEnv(process.env.OPENAI_API_KEY)

if (encryptionBuffer.length < 32) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('FATAL: ENCRYPTION_KEY must be 32+ bytes (64 hex characters)')
  }
  console.warn('WARNING: ENCRYPTION_KEY must be 64 hex characters (32 bytes) for production. Using dev placeholder until set.')
}

if (process.env.TZ !== 'UTC') {
  if (process.env.NODE_ENV === 'production') {
    console.error('FATAL: TZ must be set to UTC. Set TZ=UTC in your environment.')
    process.exit(1)
  } else {
    console.warn('WARNING: TZ is not set to UTC. Timestamp bugs may occur. Set TZ=UTC to fix.')
  }
}

export const config = {
  supabase: {
    url: trimEnv(process.env.SUPABASE_URL),
    serviceKey: trimEnv(process.env.SUPABASE_SERVICE_KEY),
    anonKey: trimEnv(process.env.SUPABASE_ANON_KEY),
    ready: Boolean(trimEnv(process.env.SUPABASE_URL) && trimEnv(process.env.SUPABASE_SERVICE_KEY)),
  },
  groq: {
    apiKey: groqApiKey,
    modelFast: groqModelFast,
    modelSmart: groqModelSmart,
    modelQuality: groqModelQuality,
    ready: Boolean(groqApiKey),
  },
  openai: {
    apiKey: openaiApiKey,
    model: trimEnv(process.env.OPENAI_MODEL) || 'gpt-4o-mini',
    modelQuality: trimEnv(process.env.OPENAI_MODEL_QUALITY) || 'gpt-4o',
    ready: Boolean(openaiApiKey),
  },
  redis: {
    url: trimEnv(process.env.REDIS_URL) || 'redis://localhost:6379',
    ready: Boolean(trimEnv(process.env.REDIS_URL)),
  },
  security: {
    encryptionKey: process.env.ENCRYPTION_KEY || '0'.repeat(64),
    encryptionKeyOld: process.env.ENCRYPTION_KEY_OLD || '',
    jwtSecret: process.env.JWT_SECRET || 'dev-jwt-secret',
  },
  stripe: {
    secretKey: trimEnv(process.env.STRIPE_SECRET_KEY),
    webhookSecret: trimEnv(process.env.STRIPE_WEBHOOK_SECRET),
    ready: Boolean(trimEnv(process.env.STRIPE_SECRET_KEY)),
  },
  server: {
    port: parseInt(process.env.PORT || '3001', 10),
    nodeEnv: process.env.NODE_ENV || 'development',
    frontendUrl: trimEnv(process.env.FRONTEND_URL) || 'http://localhost:3000',
    corsOrigins: splitCsv(process.env.CORS_ORIGINS, ['http://localhost:3000']),
  },
  worker: {
    concurrency: parseInt(process.env.WORKER_CONCURRENCY || '5', 10),
  },
} as const

if (config.server.nodeEnv === 'production') {
  if (!config.supabase.ready) {
    console.error('FATAL: SUPABASE_URL and SUPABASE_SERVICE_KEY are required')
    process.exit(1)
  }
  if (!hasValidEncryptionKey) {
    console.error('FATAL: ENCRYPTION_KEY must be 64 hex characters (32 bytes) in production')
    process.exit(1)
  }
} else if (!hasValidEncryptionKey) {
  console.warn('WARNING: ENCRYPTION_KEY should be 64 hex characters to enable secure session encryption.')
}

/** Static capability flags (env). Actual Redis TCP status: `isRedisReady()` in `redis.ts` - exposed on GET /api/v1/setup/status as `queue`. */
export const serviceStatus = {
  ai: config.groq.ready || config.openai.ready,
  queue: config.redis.ready,
  stripe: config.stripe.ready,
}
