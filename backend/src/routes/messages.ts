import { Router } from 'express'
import { z } from 'zod'
import { supabase } from '../lib/supabase.js'
import { authenticate, AuthRequest, requireRole } from '../lib/authenticate.js'
import { getSession } from '../modules/session/sessionManager.js'
import { auditMutation, decodeCursor, encodeCursor, respondData, respondPaginated } from '../lib/http.js'
import { validate } from '../lib/validate.js'
import { paginationQuerySchema } from '../schemas/common.js'
import { normalizePhone } from '../modules/importer/phoneNormalizer.js'

const router = Router()

const listMessagesQuerySchema = paginationQuerySchema.extend({
  deviceId: z.string().uuid().optional(),
  contactId: z.string().uuid().optional(),
  campaignId: z.string().uuid().optional(),
})

const sendMessageSchema = z.object({
  deviceId: z.string().uuid(),
  phone: z.string().min(1),
  content: z.string().trim().min(1),
  type: z.enum(['text', 'image', 'video', 'document']).default('text'),
  mediaUrl: z.string().url().optional(),
})

router.get('/', authenticate, validate(listMessagesQuerySchema, 'query'), async (req: AuthRequest, res) => {
  const { deviceId, contactId, campaignId, cursor, limit } = req.query as unknown as z.infer<typeof listMessagesQuerySchema>
  let query = supabase
    .from('messages')
    .select('*')
    .eq('org_id', req.user!.orgId)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(limit)

  if (cursor) {
    try {
      const decoded = decodeCursor<{ created_at: string; id: string }>(cursor)
      query = query.or(`created_at.lt.${decoded.created_at},and(created_at.eq.${decoded.created_at},id.lt.${decoded.id})`)
    } catch {
      query = query.lt('created_at', cursor)
    }
  }

  if (deviceId) query = query.eq('device_id', deviceId)
  if (contactId) query = query.eq('contact_id', contactId)
  if (campaignId) query = query.eq('campaign_id', campaignId)

  const { data, error } = await query
  if (error) return res.status(500).json({ error: error.message })

  const nextCursor = data && data.length === limit
    ? encodeCursor({ created_at: data[data.length - 1].created_at, id: data[data.length - 1].id })
    : null

  return respondPaginated(res, data || [], { nextCursor, hasMore: !!nextCursor })
})

router.post('/send', authenticate, requireRole('operator'), validate(sendMessageSchema), async (req: AuthRequest, res) => {
  const { deviceId, phone, content, type, mediaUrl } = req.body as z.infer<typeof sendMessageSchema>
  const normalizedPhone = normalizePhone(phone)
  if (!normalizedPhone) return res.status(400).json({ error: 'Invalid phone number' })

  const { data: device } = await supabase
    .from('whatsapp_devices')
    .select('id')
    .eq('id', deviceId)
    .eq('org_id', req.user!.orgId)
    .single()

  if (!device) return res.status(404).json({ error: 'Device not found' })

  const sock = getSession(deviceId)
  if (!sock) return res.status(400).json({ error: 'Device not connected' })

  const jid = `${normalizedPhone.replace('+', '')}@s.whatsapp.net`

  try {
    const { data: contact } = await supabase
      .from('contacts')
      .upsert({
        org_id: req.user!.orgId,
        phone: normalizedPhone,
        deleted_at: null,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'org_id,phone' })
      .select()
      .single()

    const result = await sock.sendMessage(jid, mediaUrl
      ? { image: { url: mediaUrl }, caption: content }
      : { text: content })

    const { data: message, error } = await supabase
      .from('messages')
      .insert({
        org_id: req.user!.orgId,
        device_id: deviceId,
        contact_id: contact?.id || null,
        direction: 'outbound',
        type,
        content,
        media_url: mediaUrl,
        wa_message_id: result?.key?.id,
        status: 'sent',
        sent_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (error || !message) return res.status(500).json({ error: error?.message || 'Unable to persist message' })
    await auditMutation(req, 'message.send', 'message', message.id, null, message)
    return respondData(res, message)
  } catch (err: any) {
    return res.status(500).json({ error: err.message })
  }
})

export default router
