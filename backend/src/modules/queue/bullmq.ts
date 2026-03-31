import { QueueEvents } from 'bullmq'
import { campaignQueue, campaignWorker, managementQueue } from './campaignProcessor.js'

export { campaignQueue }
export { managementQueue }

export const campaignQueueEvents = campaignQueue
  ? new QueueEvents('campaign-send', { connection: (campaignQueue as any).opts.connection })
  : null

export function getCampaignWorker() {
  return campaignWorker
}

export function getManagementWorker() {
  return null
}
