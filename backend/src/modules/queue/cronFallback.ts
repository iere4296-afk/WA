import cron from 'node-cron'
import { supabase } from '../../lib/supabase.js'
import { config } from '../../lib/config.js'
import { enqueueCampaignMessages, processCampaignSendJob } from './campaignProcessor.js'
import { logger } from '../../lib/logger.js'

let poller: cron.ScheduledTask | null = null

async function processScheduledCampaign(campaignId: string): Promise<void> {
  const { data: campaign } = await supabase
    .from('campaigns')
    .select('*')
    .eq('id', campaignId)
    .is('deleted_at', null)
    .single()

  if (!campaign || campaign.status !== 'scheduled') return

  let contacts: { id: string }[] = []

  if (campaign.contact_list_ids?.length > 0) {
    const { data: scopedLists } = await supabase
      .from('contact_lists')
      .select('id')
      .eq('org_id', campaign.org_id)
      .in('id', campaign.contact_list_ids)

    const effectiveListIds = (scopedLists || []).map((list) => list.id)

    if (effectiveListIds.length > 0) {
      const { data: listMembers } = await supabase
        .from('contact_list_members')
        .select('contacts(*)')
        .in('list_id', effectiveListIds)

      const rows = listMembers as { contacts: { id: string; deleted_at?: string | null; status?: string } | null }[] | null
      const fromLists =
        rows
          ?.map((member) => member.contacts)
          .filter(
            (contact): contact is { id: string; deleted_at?: string | null; status?: string } =>
              !!contact && !contact.deleted_at && contact.status === 'active',
          )
          .map((c) => ({ id: c.id })) || []
      contacts = [...contacts, ...fromLists]
    }
  }

  if (campaign.contact_ids?.length > 0) {
    const { data: directContacts } = await supabase
      .from('contacts')
      .select('id, status')
      .eq('org_id', campaign.org_id)
      .in('id', campaign.contact_ids)
      .is('deleted_at', null)

    contacts = [
      ...contacts,
      ...(directContacts || [])
        .filter((c) => c.status === 'active')
        .map((c) => ({ id: c.id })),
    ]
  }

  contacts = contacts.filter(
    (contact, index, array) => array.findIndex((candidate) => candidate.id === contact.id) === index,
  )

  const { data: template } = await supabase
    .from('message_templates')
    .select('body')
    .eq('id', campaign.template_id)
    .eq('org_id', campaign.org_id)
    .single()

  if (!template || !campaign.device_ids?.length) return

  await supabase
    .from('campaigns')
    .update({
      status: 'running',
      total_contacts: contacts.length,
      started_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', campaignId)
    .eq('org_id', campaign.org_id)

  await enqueueCampaignMessages({
    campaignId,
    orgId: campaign.org_id,
    contacts,
    templateBody: template.body,
    deviceIds: campaign.device_ids,
    minDelaySeconds: campaign.min_delay_seconds,
    maxDelaySeconds: campaign.max_delay_seconds,
  })
}

async function pollScheduledCampaigns(limit = config.worker.concurrency): Promise<number> {
  const { data: campaigns, error } = await supabase
    .from('campaigns')
    .select('id')
    .eq('status', 'scheduled')
    .is('deleted_at', null)
    .lte('scheduled_at', new Date().toISOString())
    .limit(limit)

  if (error) {
    throw error
  }

  await Promise.all((campaigns || []).map((campaign) => processScheduledCampaign(campaign.id)))
  return campaigns?.length ?? 0
}

/**
 * When BullMQ is unavailable, drain up to 3 queued rows per minute (3 msg/min cap).
 */
export async function processQueuedCampaignMessages(): Promise<void> {
  const { isRedisReady } = await import('../../lib/redis.js')
  if (isRedisReady()) return

  const { data: rows, error } = await supabase
    .from('messages')
    .select('id, org_id, campaign_id, device_id, contact_id, content, media_url')
    .eq('status', 'queued')
    .order('created_at', { ascending: true })
    .limit(3)

  if (error || !rows?.length) return

  for (const row of rows) {
    if (!row.campaign_id || !row.device_id || !row.contact_id) continue

    const { data: campaign } = await supabase
      .from('campaigns')
      .select('status, min_delay_seconds, max_delay_seconds')
      .eq('id', row.campaign_id)
      .single()

    if (!campaign || campaign.status !== 'running') continue

    await processCampaignSendJob({
      messageId: row.id,
      deviceId: row.device_id,
      contactId: row.contact_id,
      orgId: row.org_id,
      campaignId: row.campaign_id,
      content: row.content ?? '',
      mediaUrl: row.media_url,
      minDelayMs: campaign.min_delay_seconds * 1000,
      maxDelayMs: campaign.max_delay_seconds * 1000,
    }).catch((err) => {
      logger.error({ err, messageId: row.id, deviceId: row.device_id }, 'Cron fallback campaign message failed')
      
      // If it's a session error, count consecutive failures and pause campaign
      if (err.message?.includes('no active session') || err.message?.includes('Device')) {
        logger.warn({ campaignId: row.campaign_id, deviceId: row.device_id }, 'Session error detected in cron fallback')
        // Optionally update campaign status to paused if too many failures
      }
    })
  }
}

export const cronFallback = {
  start() {
    if (poller) return
    poller = cron.schedule('* * * * *', () => {
      void pollScheduledCampaigns()
      void processQueuedCampaignMessages()
    })
  },

  stop() {
    poller?.stop()
    poller = null
  },

  pollScheduledCampaigns,
  processQueuedCampaignMessages,
}
