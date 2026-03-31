import rateLimit from 'express-rate-limit'
import { Request } from 'express'
import { supabase } from './supabase.js'
import { logger } from './logger.js'

// Per-plan rate limits (requests per hour)
const RATE_LIMITS: Record<string, number> = {
  free: 100,
  starter: 500,
  growth: 2000,
  scale: 5000,
  enterprise: 999999,
}

interface CacheEntry {
  plan: string
  expiresAt: number
}

const planCache = new Map<string, CacheEntry>()

async function getOrgPlan(orgId: string): Promise<string> {
  const cached = planCache.get(orgId)
  if (cached && cached.expiresAt > Date.now()) {
    return cached.plan
  }

  try {
    const { data } = await supabase
      .from('organizations')
      .select('plan')
      .eq('id', orgId)
      .single()

    const plan = data?.plan || 'free'
    planCache.set(orgId, { plan, expiresAt: Date.now() + 5 * 60 * 1000 })
    return plan
  } catch (err) {
    logger.error({ err, orgId }, 'Failed to fetch org plan')
    return 'free'
  }
}

export const apiRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please slow down.' },
  skip: (req) => req.path === '/api/v1/health' || req.path === '/api/v1/setup/status',
})

export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Try again in 15 minutes.' },
})

export function createTierRateLimiter() {
  return rateLimit({
    windowMs: 60 * 60 * 1000,
    max: async (req: Request) => {
      // Keep local development smooth even with Strict Mode and query refetches.
      if (process.env.NODE_ENV !== 'production') {
        return 5000
      }

      const orgId = (req as any).user?.orgId
      if (!orgId) {
        return RATE_LIMITS.free
      }

      const plan = await getOrgPlan(orgId)
      return RATE_LIMITS[plan as keyof typeof RATE_LIMITS] || RATE_LIMITS.free
    },
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Rate limit exceeded. Upgrade your plan for higher limits.' },
    keyGenerator: (req) => (req as any).user?.orgId || req.ip || 'unknown',
  })
}

export const tierRateLimit = createTierRateLimiter()
