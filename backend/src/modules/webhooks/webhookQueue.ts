import type { WebhookDeliveryResult } from './webhookSender.js'
import { sendWebhook } from './webhookSender.js'

interface QueuedWebhook {
  url: string
  secret: string
  event: string
  payload: unknown
}

const queue: QueuedWebhook[] = []

export const webhookQueue = {
  enqueue(job: QueuedWebhook) {
    queue.push(job)
  },

  async flush(): Promise<WebhookDeliveryResult[]> {
    const jobs = queue.splice(0, queue.length)
    return Promise.all(jobs.map((job) => sendWebhook(job.url, job.secret, job.event, job.payload)))
  },
}
