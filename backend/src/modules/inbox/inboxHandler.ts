import type { WAMessage, WASocket } from '@whiskeysockets/baileys'
import { supabase } from '../../lib/supabase.js'
import { messageBatchWriter } from '../../lib/batchWriter.js'
import { logger } from '../../lib/logger.js'
import {
  isLidJid,
  jidToPhone,
  normalizeWhatsAppJid,
  normalizeWhatsAppPhone,
  rememberPhoneShare,
  resolvePhoneShare,
} from '../../lib/utils.js'
import { managementQueue } from '../queue/campaignProcessor.js'

const STOP_KEYWORDS = new Set([
  'stop', 'unsubscribe', 'opt out', 'optout', 'remove me', 'cancel',
  'arreter', 'desabonner', 'parar', 'abbestellen',
])

async function broadcastInbox(orgId: string, conversationId: string) {
  try {
    const channel = supabase.channel(`inbox:${orgId}`) as any
    await channel.subscribe()
    await channel.send({
      type: 'broadcast',
      event: 'conversation.updated',
      payload: {
        orgId,
        conversationId,
        updatedAt: new Date().toISOString(),
      },
    })
    await channel.unsubscribe()
  } catch {
    // Broadcast failures should not block inbox processing.
    // replyid: string | null, phone: string | null
    // logger.error({ orgId, conversationID})
    // logger.error({ orgId, conversationId})
    // logger.error({ orgId, conversationId})
  }
}

function mergeIdentityFields(
  customFields: Record<string, any> | null | undefined,
  replyJid: string | null,
  phone: string,
) {
  return {
    ...(customFields || {}),
    whatsapp_jid: replyJid || customFields?.whatsapp_jid || null,
    resolved_phone: phone,
    identity_type: isLidJid(replyJid) ? 'lid' : 'pn',
  }
}

async function upsertInboundContact(
  orgId: string,
  phone: string,
  legacyPhone: string | null,
  replyJid: string | null,
) {
  const candidatePhones = [...new Set([
    phone,
    legacyPhone,
    legacyPhone && isLidJid(replyJid) ? `${legacyPhone}@lid` : null,
  ].filter(Boolean) as string[])]

  const { data: existingContacts, error: contactsLookupError } = await supabase
    .from('contacts')
    .select('id, phone, custom_fields, deleted_at')
    .eq('org_id', orgId)
    .in('phone', candidatePhones)

  if (contactsLookupError) {
    logger.error({ contactsLookupError, orgId, phone, legacyPhone }, 'Failed to look up inbound contacts')
    return null
  }

  const exactActiveContact = (existingContacts || []).find((contact) => contact.phone === phone && !contact.deleted_at)
  const exactDeletedContact = (existingContacts || []).find((contact) => contact.phone === phone && !!contact.deleted_at)
  const exactContact = exactActiveContact || exactDeletedContact

  if (exactContact) {
    const { data: updatedContact, error: updateError } = await supabase
      .from('contacts')
      .update({
        wa_status: 'active',
        custom_fields: mergeIdentityFields(exactContact.custom_fields as Record<string, any> | null | undefined, replyJid, phone),
        deleted_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', exactContact.id)
      .eq('org_id', orgId)
      .select()
      .single()

    if (updateError || !updatedContact) {
      logger.error({ updateError, orgId, contactId: exactContact.id }, 'Failed to update inbound contact metadata')
      return null
    }

    return updatedContact
  }

  const legacyContact = (existingContacts || []).find((contact) => contact.phone !== phone)
  if (legacyContact) {
    const { data: updatedContact, error: updateError } = await supabase
      .from('contacts')
      .update({
        phone,
        wa_status: 'active',
        custom_fields: mergeIdentityFields(legacyContact.custom_fields as Record<string, any> | null | undefined, replyJid, phone),
        deleted_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', legacyContact.id)
      .eq('org_id', orgId)
      .select()
      .single()

    if (updateError || !updatedContact) {
      logger.error({ updateError, orgId, contactId: legacyContact.id }, 'Failed to convert legacy LID contact to phone identity')
      return null
    }

    return updatedContact
  }

  const { data: createdContact, error: createError } = await supabase
    .from('contacts')
    .upsert({
      org_id: orgId,
      phone,
      wa_status: 'active',
      custom_fields: mergeIdentityFields({}, replyJid, phone),
      deleted_at: null,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'org_id,phone',
      ignoreDuplicates: false,
    })
    .select()
    .single()

  if (createError || !createdContact) {
    logger.error({ createError, orgId, phone }, 'Failed to create inbound contact')
    return null
  }

  return createdContact
}

export const inboxHandler = {
  async processInbound(msg: WAMessage, deviceId: string, orgId: string, sock: WASocket) {
    const key = msg.key as any
    const jid = key.remoteJid
    if (!jid || msg.key.fromMe || jid.includes('@g.us')) return

    if (key.senderPn) rememberPhoneShare(jid, key.senderPn)
    if (key.participantPn) rememberPhoneShare(jid, key.participantPn)

    const phone = normalizeWhatsAppPhone(key.senderPn)
      || normalizeWhatsAppPhone(key.participantPn)
      || resolvePhoneShare(jid)
      || jidToPhone(jid)
    if (!phone) {
      logger.warn({ jid, deviceId, orgId }, 'Skipping inbound message without a valid contact phone')
      return
    }

    const legacyPhone = normalizeWhatsAppPhone(jid)
    const replyJid = normalizeWhatsAppJid(
      key.participant || jid,
      isLidJid(key.participant || jid) ? 'lid' : 's.whatsapp.net',
    ) || normalizeWhatsAppJid(jid, isLidJid(jid) ? 'lid' : 's.whatsapp.net')

    const content = msg.message?.conversation
      || msg.message?.extendedTextMessage?.text
      || msg.message?.imageMessage?.caption
      || msg.message?.videoMessage?.caption
      || msg.message?.documentMessage?.title
      || '[Media message]'

    const messageType = msg.message?.imageMessage
      ? 'image'
      : msg.message?.videoMessage
        ? 'video'
        : msg.message?.documentMessage
          ? 'document'
          : 'text'

    const isStop = STOP_KEYWORDS.has(content.toLowerCase().trim())
    if (isStop) {
      await handleOptOut(phone, orgId, deviceId)
      await sock.sendMessage(jid, {
        react: { text: '\u{1F44D}', key: msg.key },
      })
      return
    }

    const now = new Date().toISOString()
    const contact = await upsertInboundContact(orgId, phone, legacyPhone, replyJid)
    if (!contact) {
      logger.error({ orgId, deviceId, phone, legacyPhone, replyJid }, 'Failed to upsert inbound contact')
      return
    }

    const { data: conversation, error: conversationErr } = await supabase
      .from('conversations')
      .upsert({
        org_id: orgId,
        device_id: deviceId,
        contact_id: contact.id,
        status: 'open',
        last_message_at: now,
        last_message_preview: content.slice(0, 100),
        updated_at: now,
      }, { onConflict: 'org_id,device_id,contact_id' })
      .select()
      .single()

    if (conversationErr || !conversation) {
      logger.error({ conversationErr, orgId, deviceId, contactId: contact.id }, 'Failed to upsert inbound conversation')
      return
    }

    await supabase.rpc('increment_unread', { conversation_id: conversation.id })

    const slaDeadline = new Date(Date.now() + 2 * 60 * 60 * 1000)
    await supabase
      .from('conversations')
      .update({
        status: 'open',
        sla_deadline: slaDeadline.toISOString(),
      })
      .eq('id', conversation.id)
      .eq('org_id', orgId)

    const messageTimestamp = Number(msg.messageTimestamp || Math.floor(Date.now() / 1000))

    messageBatchWriter.add({
      org_id: orgId,
      device_id: deviceId,
      contact_id: contact.id,
      conversation_id: conversation.id,
      direction: 'inbound',
      type: messageType,
      content,
      wa_message_id: msg.key.id,
      status: 'read',
      created_at: new Date(messageTimestamp * 1000).toISOString(),
    })

    await supabase.rpc('increment_reply_count', { contact_id: contact.id })
    await broadcastInbox(orgId, conversation.id)
    logger.info({ orgId, deviceId, conversationId: conversation.id, phone }, 'Inbound message processed')
  },
}

async function handleOptOut(phone: string, orgId: string, deviceId: string) {
  await supabase
    .from('contacts')
    .update({ status: 'opted_out', updated_at: new Date().toISOString() })
    .eq('org_id', orgId)
    .eq('phone', phone)
    .is('deleted_at', null)

  const fifteenMinAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString()
  const { count } = await supabase
    .from('health_events')
    .select('*', { count: 'exact', head: true })
    .eq('org_id', orgId)
    .eq('device_id', deviceId)
    .eq('event_type', 'opt_out')
    .gte('created_at', fifteenMinAgo)

  await supabase
    .from('health_events')
    .insert({
      org_id: orgId,
      device_id: deviceId,
      event_type: 'opt_out',
      severity: (count ?? 0) >= 2 ? 'critical' : 'warning',
      details: { phone },
    })

  if ((count ?? 0) >= 2) {
    await supabase
      .from('whatsapp_devices')
      .update({
        status: 'paused',
        updated_at: new Date().toISOString(),
      })
      .eq('id', deviceId)
      .eq('org_id', orgId)

    if (managementQueue) {
      await managementQueue.add('resume-device', { deviceId, orgId }, {
        delay: 4 * 60 * 60 * 1000,
      })
    } else {
      const resumeAt = new Date(Date.now() + 4 * 60 * 60 * 1000)
      await supabase
        .from('whatsapp_devices')
        .update({
          notes: `Resume at ${resumeAt.toISOString()}`,
          updated_at: new Date().toISOString(),
        })
        .eq('id', deviceId)
        .eq('org_id', orgId)
    }

  }
}
