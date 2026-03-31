import * as Sentry from '@sentry/node'
import { nodeProfilingIntegration } from '@sentry/profiling-node'
import { config } from './config.js'
import { logger } from './logger.js'

function toSentryContext(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }

  return { value }
}

export function initSentry() {
  if (!process.env.SENTRY_DSN) {
    logger.warn('SENTRY_DSN not set - error tracking disabled')
    return
  }

  Sentry.init({
    // Credentials
    dsn: process.env.SENTRY_DSN,
    environment: config.server.nodeEnv,
    
    // Performance
    tracesSampleRate: config.server.nodeEnv === 'production' ? 0.1 : 1.0,
    profilesSampleRate: config.server.nodeEnv === 'production' ? 0.1 : 1.0,
    integrations: [
      nodeProfilingIntegration(),
      Sentry.httpIntegration({ breadcrumbs: true, spans: true }),
      Sentry.onUncaughtExceptionIntegration(),
      Sentry.onUnhandledRejectionIntegration(),
    ],
    
    // Capture details
    maxBreadcrumbs: 50,
    attachStacktrace: true,
    maxValueLength: 1000,
    
    // Filtering
    beforeSend(event: Sentry.ErrorEvent, _hint: Sentry.EventHint) {
      // Filter out sensitive data
      if (event.request) {
        delete event.request.cookies
        delete event.request.headers?.authorization
        delete event.request.headers?.['x-api-key']
        
        // Scrub passwords and tokens from body
        if (event.request.data && typeof event.request.data === 'string') {
          event.request.data = event.request.data
            .replace(/password["\']?\s*:\s*["\']([^"\']+)?["\']?/gi, 'password: ***')
            .replace(/token["\']?\s*:\s*["\']([^"\']+)?["\']?/gi, 'token: ***')
            .replace(/key["\']?\s*:\s*["\']([^"\']+)?["\']?/gi, 'key: ***')
        }
      }
      
      // Filter low-priority errors
      if (event.exception) {
        const exception = event.exception.values?.[0]?.value || ''
        
        // Ignore harmless errors
        if (
          exception.includes('ECONNREFUSED') ||
          exception.includes('ETIMEDOUT') ||
          exception.includes('socket hang up')
        ) {
          return null
        }
      }
      
      return event
    },
    
    beforeBreadcrumb(breadcrumb: Sentry.Breadcrumb) {
      // Filter out noisy breadcrumbs
      if (breadcrumb.category === 'http') {
        if (breadcrumb.data?.url?.includes('/health')) {
          return null
        }
      }
      
      // Scrub sensitive data from breadcrumbs
      if (breadcrumb.data?.body) {
        breadcrumb.data.body = String(breadcrumb.data.body)
          .replace(/password["\']?\s*:\s*["\']([^"\']+)?["\']?/gi, 'password: ***')
          .replace(/token["\']?\s*:\s*["\']([^"\']+)?["\']?/gi, 'token: ***')
      }
      
      return breadcrumb
    },
    
    // Release tracking
    release: process.env.APP_VERSION || '1.0.0',
  })

  logger.info({ dsn: process.env.SENTRY_DSN }, 'Sentry error tracking initialized')
}

/**
 * Capture custom error with context
 */
export function captureError(error: Error, context: Record<string, unknown> = {}) {
  Sentry.withScope((scope) => {
    // Add custom context
    Object.entries(context).forEach(([key, value]) => {
      scope.setContext(key, toSentryContext(value))
    })
    
    Sentry.captureException(error)
  })
}

/**
 * Capture custom message
 */
export function captureMessage(message: string, level: 'fatal' | 'error' | 'warning' | 'info' | 'debug' = 'info') {
  Sentry.captureMessage(message, level)
}

/**
 * Add custom context to current scope
 */
export function addContext(key: string, value: unknown) {
  Sentry.getCurrentScope().setContext(key, toSentryContext(value))
}

/**
 * Set user context
 */
export function setUser(userId: string, email?: string, orgId?: string) {
  Sentry.setUser({
    id: userId,
    email,
    username: `org-${orgId}`,
  })
}

/**
 * Clear user context (on logout)
 */
export function clearUser() {
  Sentry.setUser(null)
}

export default {
  initSentry,
  captureError,
  captureMessage,
  addContext,
  setUser,
  clearUser,
}
