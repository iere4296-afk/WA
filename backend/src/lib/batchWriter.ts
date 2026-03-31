import { supabase } from './supabase.js'
import { logger } from './logger.js'

interface BatchItem {
  [key: string]: unknown
}

/**
 * Accumulates rows for FLUSH_MS then flushes in one INSERT (or sooner at MAX_BATCH).
 * Prevents N+1 writes during bulk campaign sends.
 */
export class BatchWriter {
  private buffer: BatchItem[] = []
  private timer: NodeJS.Timeout | null = null
  private readonly FLUSH_MS = 500
  private readonly MAX_BATCH = 100
  private flushInFlight = false
  private readonly tableName: string
  private retryCount = 0
  private readonly maxRetries = 3

  constructor(tableName: string) {
    this.tableName = tableName
  }

  add(record: BatchItem) {
    this.buffer.push(record)
    if (this.buffer.length >= this.MAX_BATCH) {
      void this.flush()
    } else if (!this.timer) {
      this.timer = setTimeout(() => void this.flush(), this.FLUSH_MS)
    }
  }

  async flush() {
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }
    if (!this.buffer.length || this.flushInFlight) return

    this.flushInFlight = true
    const batch = this.buffer.splice(0, this.MAX_BATCH)

    try {
      const { error } = await supabase.from(this.tableName).insert(batch)
      if (error) {
        logger.error({ error, table: this.tableName }, 'Batch insert failed')
        if (this.retryCount < this.maxRetries) {
          this.retryCount += 1
          this.buffer.unshift(...batch)
        } else {
          logger.error({ table: this.tableName, dropped: batch.length }, 'Dropping batch after max retries')
          this.retryCount = 0
        }
        return
      }
      this.retryCount = 0
    } catch (err) {
      logger.error({ err, table: this.tableName }, 'Batch insert exception')
      if (this.retryCount < this.maxRetries) {
        this.retryCount += 1
        this.buffer.unshift(...batch)
      } else {
        logger.error({ table: this.tableName, dropped: batch.length }, 'Dropping batch after max retries')
        this.retryCount = 0
      }
    } finally {
      this.flushInFlight = false
      if (this.buffer.length >= this.MAX_BATCH) {
        void this.flush()
      } else if (this.buffer.length > 0 && !this.timer) {
        this.timer = setTimeout(() => void this.flush(), this.FLUSH_MS)
      }
    }
  }

  async stop() {
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }
    await this.flush()
  }
}

export const messageBatchWriter = new BatchWriter('messages')
export const healthBatchWriter = new BatchWriter('health_events')
export const auditBatchWriter = new BatchWriter('audit_logs')
export const batchWriter = messageBatchWriter
