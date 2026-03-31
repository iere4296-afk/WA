import { Router } from 'express'
import { z } from 'zod'
import { supabase } from '../lib/supabase.js'
import { authenticate, AuthRequest, requireRole } from '../lib/authenticate.js'
import { buildJidCandidates, isLidJid, normalizeWhatsAppJid, normalizeWhatsAppPhone } from '../lib/utils.js'
import { getSession } from '../modules/session/sessionManager.js'
import { auditMutation, decodeCursor, encodeCursor, normalizeIdParam, respondData, respondPaginated } from '../lib/http.js'
import { logger } from '../lib/logger.js'
import { validate } from '../lib/validate.js'
import { idParamsSchema, paginationQuerySchema } from '../schemas/common.js'

const router = Router()

const listConversationsQuerySchema = paginationQuerySchema.extend({
  status: z.string().optional(),
  assignedTo: z.string().optional(),
  search: z.string().trim().optional(),
})

const conversationMessagesQuerySchema = paginationQuerySchema

const sendMessageSchema = z.object({
  deviceId: z.string().uuid().optional(),
  content: z.string().trim().min(1),
  mediaUrl: z.string().url().optional(),
  type: z.enum(['text', 'image', 'video', 'document']).default('text'),
})

const updateConversationSchema = z.object({
  status: z.enum(['open', 'resolved', 'pending', 'archived']).optional(),
  assignedTo: z.string().uuid().nullable().optional(),
  tags: z.array(z.string()).optional(),
})

type InboxContact = {
  id: string
  phone?: string | null
  custom_fields?: Record<string, any> | null
  updated_at?: string
} | null

function buildLegacyIdentityFields(contact: InboxContact) {
  const existingFields = contact?.custom_fields || {}
  const resolvedPhone = normalizeWhatsAppPhone(
    existingFields.resolved_phone || contact?.phone || null,
  )
  const whatsappJid = normalizeWhatsAppJid(
    existingFields.whatsapp_jid || contact?.phone || null,
    isLidJid(existingFields.whatsapp_jid || contact?.phone || null) ? 'lid' : 's.whatsapp.net',
  )

  if (!resolvedPhone && !whatsappJid) return null

  const mergedFields = {
    ...existingFields,
    resolved_phone: resolvedPhone || existingFields.resolved_phone || null,
    whatsapp_jid: whatsappJid || existingFields.whatsapp_jid || null,
    identity_type: isLidJid(whatsappJid) ? 'lid' : (existingFields.identity_type || 'pn'),
  }

  const unchanged = JSON.stringify(mergedFields) === JSON.stringify(existingFields)
  return unchanged ? null : mergedFields
}

async function hydrateLegacyContactIdentity(orgId: string, contact: InboxContact) {
  if (!contact?.id) return contact

  const nextFields = buildLegacyIdentityFields(contact)
  if (!nextFields) return contact

  const { data, error } = await supabase
    .from('contacts')
    .update({
      custom_fields: nextFields,
      updated_at: new Date().toISOString(),
    })
    .eq('id', contact.id)
    .eq('org_id', orgId)
    .select('id, name, phone, email, wa_status, tags, custom_fields')
    .single()

  if (error || !data) {
    logger.warn({ error, orgId, contactId: contact.id }, 'Unable to hydrate legacy inbox contact identity')
    return {
      ...contact,
      custom_fields: nextFields,
    }
  }

  return data
}

router.get('/conversations', authenticate, validate(listConversationsQuerySchema, 'query'), async (req: AuthRequest, res) => {
  const { status, assignedTo, cursor, limit, search } = req.query as unknown as z.infer<typeof listConversationsQuerySchema>

  let query = supabase
    .from('conversations')
    .select('*, contacts(id, name, phone, wa_status, custom_fields), whatsapp_devices(id, name, status)')
    .eq('org_id', req.user!.orgId)
    .order('last_message_at', { ascending: false, nullsFirst: false })
    .order('id', { ascending: false })
    .limit(limit)

  if (cursor) {
    try {
      const decoded = decodeCursor<{ last_message_at: string; id: string }>(cursor)
      query = query.or(`last_message_at.lt.${decoded.last_message_at},and(last_message_at.eq.${decoded.last_message_at},id.lt.${decoded.id})`)
    } catch {
      query = query.lt('id', cursor)
    }
  }

  if (status) query = query.eq('status', status)
  if (assignedTo === 'me') query = query.eq('assigned_to', req.user!.id)
  else if (assignedTo) query = query.eq('assigned_to', assignedTo)
  if (search) query = query.or(`last_message_preview.ilike.%${search}%`)

  const { data: conversations, error } = await query
  if (error) return res.status(500).json({ error: error.message })

  const hydratedConversations = await Promise.all((conversations || []).map(async (conversation) => ({
    ...conversation,
    contacts: await hydrateLegacyContactIdentity(req.user!.orgId, (conversation.contacts as InboxContact) || null),
  })))

  const nextCursor = hydratedConversations && hydratedConversations.length === limit
    ? encodeCursor({
        last_message_at: hydratedConversations[hydratedConversations.length - 1].last_message_at || hydratedConversations[hydratedConversations.length - 1].created_at,
        id: hydratedConversations[hydratedConversations.length - 1].id,
      })
    : null

  return respondPaginated(res, hydratedConversations || [], { nextCursor, hasMore: !!nextCursor })
})

router.get('/conversations/:id', authenticate, validate(idParamsSchema, 'params'), async (req: AuthRequest, res) => {
  const conversationId = normalizeIdParam(req.params.id)
  const { data, error } = await supabase
    .from('conversations')
    .select('*, contacts(id, name, phone, email, wa_status, tags, custom_fields), whatsapp_devices(id, name, status, phone_number)')
    .eq('id', conversationId)
    .eq('org_id', req.user!.orgId)
    .single()

  if (error || !data) return res.status(404).json({ error: 'Conversation not found' })

  const hydratedContact = await hydrateLegacyContactIdentity(req.user!.orgId, (data.contacts as InboxContact) || null)
  return respondData(res, {
    ...data,
    contacts: hydratedContact,
  })
})

router.get('/conversations/:id/messages', authenticate, validate(idParamsSchema, 'params'), validate(conversationMessagesQuerySchema, 'query'), async (req: AuthRequest, res) => {
  const conversationId = normalizeIdParam(req.params.id)
  const { cursor, limit } = req.query as unknown as z.infer<typeof conversationMessagesQuerySchema>

  let query = supabase
    .from('messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .eq('org_id', req.user!.orgId)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(limit)

  if (cursor) {
    try {
      const decoded = decodeCursor<{ created_at: string; id: string }>(cursor)
      query = query.or(`created_at.lt.${decoded.created_at},and(created_at.eq.${decoded.created_at},id.lt.${decoded.id})`)
    } catch {
      query = query.lt('id', cursor)
    }
  }

  const { data: messages, error } = await query
  if (error) return res.status(500).json({ error: error.message })

  await supabase
    .from('conversations')
    .update({ unread_count: 0, updated_at: new Date().toISOString() })
    .eq('id', conversationId)
    .eq('org_id', req.user!.orgId)

  const orderedMessages = (messages || []).reverse()
  const nextCursor = messages && messages.length === limit
    ? encodeCursor({ created_at: messages[messages.length - 1].created_at, id: messages[messages.length - 1].id })
    : null

  return respondPaginated(res, orderedMessages, { nextCursor, hasMore: !!nextCursor })
})

async function sendConversationMessage(req: AuthRequest, res: any) {
  const conversationId = normalizeIdParam(req.params.id || req.body.conversationId)
  const {
    content,
    mediaUrl,
    type,
    deviceId,
  } = req.body as z.infer<typeof sendMessageSchema> & { conversationId?: string }

  if (!conversationId || !content?.trim()) {
    return res.status(400).json({ error: 'conversationId and content are required' })
  }

  const { data: conversation, error: conversationError } = await supabase
    .from('conversations')
    .select('contact_id, device_id, contacts(id, phone, custom_fields)')
    .eq('id', conversationId)
    .eq('org_id', req.user!.orgId)
    .single()

  if (conversationError || !conversation) {
    return res.status(404).json({ error: 'Conversation not found' })
  }

  const resolvedDeviceId = deviceId || conversation.device_id
  if (!resolvedDeviceId) {
    return res.status(400).json({ error: 'No device associated with this conversation. Provide deviceId.' })
  }

  const sock = getSession(resolvedDeviceId)
  if (!sock) {
    return res.status(503).json({ error: 'Device session not active. Please reconnect the device.' })
  }

  const hydratedContact = await hydrateLegacyContactIdentity(req.user!.orgId, (conversation.contacts as InboxContact) || null)
  const phone = (hydratedContact as any)?.phone
  const preferredJid = (hydratedContact as any)?.custom_fields?.whatsapp_jid || null
  if (!phone) {
    return res.status(400).json({ error: 'Contact phone number not found' })
  }

  const jidCandidates = buildJidCandidates(String(phone), preferredJid)
  if (jidCandidates.length === 0) {
    return res.status(400).json({ error: 'Contact phone number not found' })
  }

  const now = new Date().toISOString()

  try {
    const { data: message, error } = await supabase
      .from('messages')
      .insert({
        org_id: req.user!.orgId,
        conversation_id: conversationId,
        device_id: resolvedDeviceId,
        contact_id: conversation.contact_id,
        direction: 'outbound',
        type: mediaUrl ? 'image' : type,
        content,
        media_url: mediaUrl,
        status: 'queued',
        sent_at: now,
        created_at: now,
      })
      .select()
      .single()

    if (error || !message) return res.status(500).json({ error: error?.message || 'Unable to persist message' })

    await supabase
      .from('conversations')
      .update({
        last_message_at: now,
        last_message_preview: content.slice(0, 100),
        updated_at: now,
      })
      .eq('id', conversationId)

    res.status(202).json({
      data: message,
      message: 'Message queued for sending',
    })

    setImmediate(async () => {
      let lastError: any = null

      try {
        let result: any = null

        for (const jid of jidCandidates) {
          try {
            result = await sock.sendMessage(
              jid,
              mediaUrl
                ? { image: { url: mediaUrl }, caption: content }
                : { text: content },
            )

            await supabase
              .from('contacts')
              .update({
                custom_fields: {
                  ...(((hydratedContact as any)?.custom_fields || {})),
                  whatsapp_jid: jid,
                },
                updated_at: new Date().toISOString(),
              })
              .eq('id', conversation.contact_id)
              .eq('org_id', req.user!.orgId)

            break
          } catch (error: any) {
            lastError = error
          }
        }

        if (!result) {
          throw lastError || new Error('No valid WhatsApp JID found for contact')
        }

        await supabase
          .from('messages')
          .update({
            status: 'sent',
            wa_message_id: result?.key?.id ?? null,
          })
          .eq('id', message.id)
      } catch (error: any) {
        logger.error(
          { error: error?.message, conversationId, deviceId: resolvedDeviceId, jidCandidates },
          'Failed to send WhatsApp message',
        )

        await supabase
          .from('messages')
          .update({
            status: 'failed',
            error_message: error?.message || 'Unknown send failure',
          })
          .eq('id', message.id)
      }
    })

    return
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Unable to queue message' })
  }
}

router.post('/conversations/:id/send', authenticate, requireRole('operator'), validate(idParamsSchema, 'params'), validate(sendMessageSchema), sendConversationMessage)
router.post('/send', authenticate, requireRole('operator'), validate(z.object({ conversationId: z.string().uuid() }).merge(sendMessageSchema)), sendConversationMessage)

router.patch('/conversations/:id', authenticate, requireRole('operator'), validate(idParamsSchema, 'params'), validate(updateConversationSchema), async (req: AuthRequest, res) => {
  const conversationId = normalizeIdParam(req.params.id)
  const payload = req.body as z.infer<typeof updateConversationSchema>

  const { data: before } = await supabase
    .from('conversations')
    .select('*')
    .eq('id', conversationId)
    .eq('org_id', req.user!.orgId)
    .single()

  if (!before) return res.status(404).json({ error: 'Conversation not found' })

  const { data: conversation, error } = await supabase
    .from('conversations')
    .update({
      status: payload.status ?? before.status,
      assigned_to: payload.assignedTo !== undefined ? payload.assignedTo : before.assigned_to,
      tags: payload.tags ?? before.tags,
      updated_at: new Date().toISOString(),
    })
    .eq('id', conversationId)
    .eq('org_id', req.user!.orgId)
    .select()
    .single()

  if (error || !conversation) return res.status(500).json({ error: error?.message || 'Unable to update conversation' })
  await auditMutation(req, 'conversation.update', 'conversation', conversation.id, before, conversation)
  return respondData(res, conversation)
})

export default router
