import promClient from 'prom-client'
import { logger } from './logger.js'

// Default metrics (CPU, memory, etc.)
promClient.collectDefaultMetrics({ prefix: 'nodejs_' })

// ═══════════════════════════════════════════════════════════
// HTTP REQUEST METRICS
// ═══════════════════════════════════════════════════════════

export const httpRequestDuration = new promClient.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10],
})

export const httpRequestSize = new promClient.Histogram({
  name: 'http_request_size_bytes',
  help: 'Size of HTTP request body in bytes',
  labelNames: ['method', 'route'],
  buckets: [100, 500, 1000, 5000, 10000, 50000, 100000],
})

export const httpResponseSize = new promClient.Histogram({
  name: 'http_response_size_bytes',
  help: 'Size of HTTP response body in bytes',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [100, 500, 1000, 5000, 10000, 50000, 100000, 500000],
})

export const httpRequestTotal = new promClient.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
})

export const httpErrorsTotal = new promClient.Counter({
  name: 'http_errors_total',
  help: 'Total number of HTTP errors',
  labelNames: ['method', 'route', 'status_code'],
})

// ═══════════════════════════════════════════════════════════
// DATABASE METRICS
// ═══════════════════════════════════════════════════════════

export const dbQueryDuration = new promClient.Histogram({
  name: 'db_query_duration_seconds',
  help: 'Duration of database queries in seconds',
  labelNames: ['operation', 'table'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5],
})

export const dbQueryErrors = new promClient.Counter({
  name: 'db_query_errors_total',
  help: 'Total number of database query errors',
  labelNames: ['operation', 'table', 'error_type'],
})

export const dbConnections = new promClient.Gauge({
  name: 'db_connections',
  help: 'Current number of database connections',
  labelNames: ['state'],
})

// ═══════════════════════════════════════════════════════════
// CACHE METRICS
// ═══════════════════════════════════════════════════════════

export const cacheHitRate = new promClient.Counter({
  name: 'cache_hits_total',
  help: 'Total number of cache hits',
  labelNames: ['cache', 'key_prefix'],
})

export const cacheMissRate = new promClient.Counter({
  name: 'cache_misses_total',
  help: 'Total number of cache misses',
  labelNames: ['cache', 'key_prefix'],
})

export const cacheSetErrors = new promClient.Counter({
  name: 'cache_set_errors_total',
  help: 'Total number of cache set errors',
  labelNames: ['cache'],
})

export const redisConnectionStatus = new promClient.Gauge({
  name: 'redis_connection_status',
  help: 'Redis connection status (1=connected, 0=disconnected)',
})

// ═══════════════════════════════════════════════════════════
// QUEUE METRICS
// ═══════════════════════════════════════════════════════════

export const queueJobDuration = new promClient.Histogram({
  name: 'queue_job_duration_seconds',
  help: 'Duration of queue job processing',
  labelNames: ['queue', 'status'],
  buckets: [0.1, 1, 5, 10, 30, 60],
})

export const queueJobsTotal = new promClient.Counter({
  name: 'queue_jobs_total',
  help: 'Total number of queue jobs processed',
  labelNames: ['queue', 'status'],
})

export const queueSize = new promClient.Gauge({
  name: 'queue_size',
  help: 'Current size of queue (number of pending jobs)',
  labelNames: ['queue'],
})

export const queueErrors = new promClient.Counter({
  name: 'queue_errors_total',
  help: 'Total number of queue processing errors',
  labelNames: ['queue', 'error_type'],
})

// ═══════════════════════════════════════════════════════════
// AUTH METRICS
// ═══════════════════════════════════════════════════════════

export const authAttempts = new promClient.Counter({
  name: 'auth_attempts_total',
  help: 'Total authentication attempts',
  labelNames: ['type', 'result'],
})

export const authTokensIssued = new promClient.Counter({
  name: 'auth_tokens_issued_total',
  help: 'Total tokens issued',
  labelNames: ['token_type'],
})

export const authTokenRefreshes = new promClient.Counter({
  name: 'auth_token_refreshes_total',
  help: 'Total token refreshes',
  labelNames: ['result'],
})

// ═══════════════════════════════════════════════════════════
// RATE LIMIT METRICS
// ═══════════════════════════════════════════════════════════

export const rateLimitHits = new promClient.Counter({
  name: 'rate_limit_hits_total',
  help: 'Total rate limit hits',
  labelNames: ['limiter_type', 'tier'],
})

export const rateLimitUsage = new promClient.Gauge({
  name: 'rate_limit_usage',
  help: 'Current rate limit usage percentage',
  labelNames: ['limiter_type', 'identifier'],
})

// ═══════════════════════════════════════════════════════════
// AI SERVICE METRICS
// ═══════════════════════════════════════════════════════════

export const aiGeneration = new promClient.Counter({
  name: 'ai_generation_total',
  help: 'Total AI message generations',
  labelNames: ['model', 'status'],
})

export const aiGenerationDuration = new promClient.Histogram({
  name: 'ai_generation_duration_seconds',
  help: 'Duration of AI message generation',
  labelNames: ['model'],
  buckets: [0.1, 0.5, 1, 2, 5, 10],
})

export const aiContentGateFails = new promClient.Counter({
  name: 'ai_content_gate_fails_total',
  help: 'Total AI content gate failures',
  labelNames: ['gate_type'],
})

export const aiModelFallbacks = new promClient.Counter({
  name: 'ai_model_fallbacks_total',
  help: 'Total fallbacks to alternative AI model',
  labelNames: ['from_model', 'to_model'],
})

// ═══════════════════════════════════════════════════════════
// WHATSAPP MESSAGING METRICS
// ═══════════════════════════════════════════════════════════

export const waMessagesTotal = new promClient.Counter({
  name: 'wa_messages_total',
  help: 'Total WhatsApp messages sent',
  labelNames: ['type', 'status'],
})

export const waMessageDuration = new promClient.Histogram({
  name: 'wa_message_duration_seconds',
  help: 'Duration to send WhatsApp message',
  labelNames: ['type'],
  buckets: [0.1, 0.5, 1, 2, 5],
})

export const waDeviceHealth = new promClient.Gauge({
  name: 'wa_device_health_score',
  help: 'WhatsApp device health score (0-100)',
  labelNames: ['device_id', 'organization_id'],
})

export const waDeviceStatus = new promClient.Gauge({
  name: 'wa_device_status',
  help: 'WhatsApp device status (1=connected, 0=disconnected)',
  labelNames: ['device_id', 'organization_id'],
})

// ═══════════════════════════════════════════════════════════
// BUSINESS METRICS
// ═══════════════════════════════════════════════════════════

export const campaignStats = new promClient.Counter({
  name: 'campaign_stats_total',
  help: 'Campaign statistics',
  labelNames: ['organization_id', 'status'],
})

export const userActionsTotal = new promClient.Counter({
  name: 'user_actions_total',
  help: 'Total user actions',
  labelNames: ['action_type', 'organization_id'],
})

export const organizationStats = new promClient.Gauge({
  name: 'organization_stats',
  help: 'Organization statistics',
  labelNames: ['organization_id', 'stat_type'],
})

// ═══════════════════════════════════════════════════════════
// MIDDLEWARE FOR AUTO-TRACKING
// ═══════════════════════════════════════════════════════════

export function prometheusMiddleware(req: any, res: any, next: any) {
  const start = Date.now()
  const route = req.route?.path || req.path || 'unknown'

  // Track request size if present
  const contentLength = req.get('content-length')
  if (contentLength) {
    httpRequestSize
      .labels(req.method, route)
      .observe(parseInt(contentLength))
  }

  // Capture response metrics
  const originalJson = res.json
  res.json = function (data: any) {
    const responseSize = JSON.stringify(data).length
    httpResponseSize
      .labels(req.method, route, res.statusCode)
      .observe(responseSize)
    
    return originalJson.call(this, data)
  }

  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000
    const status = res.statusCode

    // Record metrics
    httpRequestDuration
      .labels(req.method, route, status)
      .observe(duration)

    httpRequestTotal
      .labels(req.method, route, status)
      .inc()

    // Track errors
    if (status >= 400) {
      httpErrorsTotal
        .labels(req.method, route, status)
        .inc()
    }
  })

  next()
}

/**
 * Export metrics in Prometheus format
 */
export async function getMetrics() {
  try {
    return await promClient.register.metrics()
  } catch (error) {
    logger.error({ error }, 'Failed to generate metrics')
    return ''
  }
}

export default {
  httpRequestDuration,
  httpRequestSize,
  httpResponseSize,
  httpRequestTotal,
  httpErrorsTotal,
  dbQueryDuration,
  dbQueryErrors,
  dbConnections,
  cacheHitRate,
  cacheMissRate,
  cacheSetErrors,
  redisConnectionStatus,
  queueJobDuration,
  queueJobsTotal,
  queueSize,
  queueErrors,
  authAttempts,
  authTokensIssued,
  authTokenRefreshes,
  rateLimitHits,
  rateLimitUsage,
  aiGeneration,
  aiGenerationDuration,
  aiContentGateFails,
  aiModelFallbacks,
  waMessagesTotal,
  waMessageDuration,
  waDeviceHealth,
  waDeviceStatus,
  campaignStats,
  userActionsTotal,
  organizationStats,
  prometheusMiddleware,
  getMetrics,
}
