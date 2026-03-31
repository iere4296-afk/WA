import Redis from 'ioredis'
import { config } from './config.js'
import { logger } from './logger.js'

let redis: Redis | null = null
export let isRedisAvailable = false

if (config.redis.ready) {
  redis = new Redis(config.redis.url, {
    lazyConnect: true,
  })
  void redis
    .connect()
    .then(() => {
      isRedisAvailable = true
      logger.info('Redis connected')
    })
    .catch((err) => {
      logger.warn({ err }, 'Redis unavailable — using cron fallback')
      isRedisAvailable = false
      try {
        redis?.disconnect()
      } catch {
        /* ignore */
      }
      redis = null
    })
}

export { redis }

export function getRedisClient(): Redis | null {
  return redis
}

/** True when TCP connection finished and ioredis reports ready */
export function isRedisReady(): boolean {
  return isRedisAvailable && redis?.status === 'ready'
}
