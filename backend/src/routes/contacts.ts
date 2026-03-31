import { Router } from 'express'
import { z } from 'zod'
import { supabase } from '../lib/supabase.js'
import { authenticate, AuthRequest, requireRole } from '../lib/authenticate.js'
import { auditMutation, decodeCursor, encodeCursor, normalizeIdParam, respondData, respondPaginated } from '../lib/http.js'
import { validate } from '../lib/validate.js'
import { idParamsSchema, paginationQuerySchema } from '../schemas/common.js'
import { logger } from '../lib/logger.js'
import { normalizePhone } from '../modules/importer/phoneNormalizer.js'

const listMemberParamsSchema = z.object({
  id: z.string(),
  contactId: z.string(),
})

const router = Router()

// ─── Validate that a JID will work on WhatsApp ───────────────────────────────
export function buildValidJid(phone: string): string | null {
  if (!phone) return null
  const cleaned = phone.replace('+', '').replace(/\D/g, '')
  if (!/^\d{7,15}$/.test(cleaned)) return null
  return `${cleaned}@s.whatsapp.net` 
}

const createContactSchema = z.object({
  name: z.string().trim().optional(),
  phone: z.string().min(1),
  email: z.string().email().optional(),
  status: z.enum(['active', 'opted_out', 'invalid', 'blocked']).default('active'),
  tags: z.array(z.string()).default([]),
  notes: z.string().trim().optional(),
})

const updateContactSchema = createContactSchema.partial()

const listContactsQuerySchema = paginationQuerySchema.extend({
  search: z.string().trim().optional(),
  status: z.string().optional(),
  tags: z.string().optional(),
  listId: z.string().uuid().optional(),
})

const validateContactsSchema = z.object({
  phones: z.array(z.string()).min(1).max(500),
})

const createListSchema = z.object({
  name: z.string().trim().min(1),
  description: z.string().trim().optional(),
  type: z.enum(['static', 'dynamic', 'imported']).default('static'),
  tags: z.array(z.string()).default([]),
  color: z.string().default('#10b981'),
})

const addListMembersSchema = z.object({
  contactIds: z.array(z.string().uuid()).min(1),
})


router.get('/', authenticate, validate(listContactsQuerySchema, 'query'), async (req: AuthRequest, res) => {
  const { cursor, limit, search, status, tags, listId } = req.query as unknown as z.infer<typeof listContactsQuerySchema>

  let query = supabase
    .from('contacts')
    .select('*')
    .eq('org_id', req.user!.orgId)
    .is('deleted_at', null)
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

  if (search) {
    query = query.or(`name.ilike.%${search}%,phone.ilike.%${search}%,email.ilike.%${search}%`)
  }

  if (status) {
    query = query.eq('status', status)
  }

  if (tags) {
    query = query.contains('tags', tags.split(',').filter(Boolean))
  }

  if (listId) {
    const { data: list } = await supabase
      .from('contact_lists')
      .select('id')
      .eq('id', listId)
      .eq('org_id', req.user!.orgId)
      .single()

    if (!list) {
      return res.status(404).json({ error: 'Contact list not found' })
    }

    const { data: members } = await supabase
      .from('contact_list_members')
      .select('contact_id')
      .eq('list_id', listId)

    const contactIds = members?.map((member) => member.contact_id) || []
    if (contactIds.length === 0) {
      return respondPaginated(res, [], { nextCursor: null, hasMore: false })
    }
    query = query.in('id', contactIds)
  }

  const { data: contacts, error } = await query
  if (error) return res.status(500).json({ error: error.message })

  const nextCursor = contacts && contacts.length === limit
    ? encodeCursor({ created_at: contacts[contacts.length - 1].created_at, id: contacts[contacts.length - 1].id })
    : null

  return respondPaginated(res, contacts || [], {
    nextCursor,
    hasMore: !!nextCursor,
  })
})

router.get('/lists', authenticate, async (req: AuthRequest, res) => {
  const { data, error } = await supabase
    .from('contact_lists')
    .select('*')
    .eq('org_id', req.user!.orgId)
    .order('created_at', { ascending: false })

  if (error) return res.status(500).json({ error: error.message })
  return respondData(res, data || [])
})

router.post('/lists', authenticate, requireRole('operator'), validate(createListSchema), async (req: AuthRequest, res) => {
  const payload = req.body as z.infer<typeof createListSchema>
  const { data, error } = await supabase
    .from('contact_lists')
    .insert({
      org_id: req.user!.orgId,
      name: payload.name,
      description: payload.description,
      type: payload.type,
      tags: payload.tags,
      color: payload.color,
    })
    .select()
    .single()

  if (error || !data) return res.status(500).json({ error: error?.message || 'Unable to create contact list' })
  await auditMutation(req, 'contact-list.create', 'contact_list', data.id, null, data)
  return respondData(res, data, 201)
})

router.post('/lists/:id/members', authenticate, requireRole('operator'), validate(idParamsSchema, 'params'), validate(addListMembersSchema), async (req: AuthRequest, res) => {
  const listId = normalizeIdParam(req.params.id)
  const { contactIds } = req.body as z.infer<typeof addListMembersSchema>

  const { data: list } = await supabase
    .from('contact_lists')
    .select('id')
    .eq('id', listId)
    .eq('org_id', req.user!.orgId)
    .single()

  if (!list) return res.status(404).json({ error: 'Contact list not found' })

  const { data: validContacts } = await supabase
    .from('contacts')
    .select('id')
    .eq('org_id', req.user!.orgId)
    .is('deleted_at', null)
    .in('id', contactIds)

  const effectiveContactIds = (validContacts || []).map((contact) => contact.id)
  if (effectiveContactIds.length === 0) {
    return res.status(400).json({ error: 'No valid contacts selected' })
  }

  const rows = effectiveContactIds.map((contactId) => ({
    list_id: listId,
    contact_id: contactId,
  }))

  const { error } = await supabase
    .from('contact_list_members')
    .upsert(rows, { onConflict: 'list_id,contact_id' })

  if (error) return res.status(500).json({ error: error.message })

  const { count } = await supabase
    .from('contact_list_members')
    .select('*', { count: 'exact', head: true })
    .eq('list_id', listId)

  await supabase
    .from('contact_lists')
    .update({ contact_count: count ?? effectiveContactIds.length, updated_at: new Date().toISOString() })
    .eq('id', listId)
    .eq('org_id', req.user!.orgId)

  await auditMutation(req, 'contact-list.members.add', 'contact_list', listId, null, { contactIds: effectiveContactIds })
  return respondData(res, { added: effectiveContactIds.length })
})

router.delete(
  '/lists/:id/members/:contactId',
  authenticate,
  requireRole('operator'),
  validate(listMemberParamsSchema, 'params'),
  async (req: AuthRequest, res) => {
    const listId = normalizeIdParam(req.params.id)
    const contactId = normalizeIdParam(req.params.contactId)

    const { data: list } = await supabase
      .from('contact_lists')
      .select('id')
      .eq('id', listId)
      .eq('org_id', req.user!.orgId)
      .single()

    if (!list) return res.status(404).json({ error: 'Contact list not found' })

    const { error: delErr } = await supabase
      .from('contact_list_members')
      .delete()
      .eq('list_id', listId)
      .eq('contact_id', contactId)

    if (delErr) return res.status(500).json({ error: delErr.message })

    const { count } = await supabase
      .from('contact_list_members')
      .select('*', { count: 'exact', head: true })
      .eq('list_id', listId)

    await supabase
      .from('contact_lists')
      .update({ contact_count: count ?? 0, updated_at: new Date().toISOString() })
      .eq('id', listId)
      .eq('org_id', req.user!.orgId)

    await auditMutation(req, 'contact-list.members.remove', 'contact_list', listId, null, { contactId })
    return respondData(res, { success: true })
  },
)

router.delete('/lists/:id', authenticate, requireRole('operator'), validate(idParamsSchema, 'params'), async (req: AuthRequest, res) => {
  const listId = normalizeIdParam(req.params.id)

  const { data: before } = await supabase
    .from('contact_lists')
    .select('*')
    .eq('id', listId)
    .eq('org_id', req.user!.orgId)
    .single()

  if (!before) return res.status(404).json({ error: 'Contact list not found' })

  const { error } = await supabase.from('contact_lists').delete().eq('id', listId).eq('org_id', req.user!.orgId)

  if (error) return res.status(500).json({ error: error.message })

  await auditMutation(req, 'contact-list.delete', 'contact_list', listId, before, null)
  return respondData(res, { success: true })
})

router.post('/', authenticate, requireRole('operator'), validate(createContactSchema), async (req: AuthRequest, res) => {
  const payload = req.body as z.infer<typeof createContactSchema>
  const normalizedPhone = normalizePhone(payload.phone)
  if (!normalizedPhone) {
    return res.status(400).json({ error: `Invalid phone number: ${payload.phone}` })
  }

  const { data: contact, error } = await supabase
    .from('contacts')
    .upsert({
      org_id: req.user!.orgId,
      ...payload,
      phone: normalizedPhone,
      deleted_at: null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'org_id,phone' })
    .select()
    .single()

  if (error || !contact) return res.status(500).json({ error: error?.message || 'Unable to create contact' })

  await auditMutation(req, 'contact.create', 'contact', contact.id, null, contact)
  return respondData(res, contact, 201)
})

router.post('/import', authenticate, async (req: AuthRequest, res) => {
  const { orgId } = req.user!
  const rawContacts = req.body?.contacts

  if (!Array.isArray(rawContacts) || rawContacts.length === 0) {
    return res.status(400).json({
      error: 'No contacts provided',
      tip: 'Check that your file has a phone/mobile column with valid numbers',
    })
  }

  const validationErrors: string[] = []

  const contacts = rawContacts
    .filter((contact: unknown): contact is Record<string, unknown> => typeof contact === 'object' && contact !== null)
    .map((contact, index) => {
      const rawPhone = typeof contact.phone === 'string' ? contact.phone : ''
      const phone = normalizePhone(rawPhone)

      if (!phone) {
        if (validationErrors.length < 10) {
          validationErrors.push(`Row ${index + 1}: invalid phone "${rawPhone}"`)
        }
        return null
      }

      return {
        org_id: orgId,
        phone,
        name: typeof contact.name === 'string' ? contact.name.trim() || null : null,
        email: typeof contact.email === 'string' ? contact.email.trim() || null : null,
        status: 'active' as const,
        source: 'import',
        deleted_at: null as null,
        updated_at: new Date().toISOString(),
      }
    })
    .filter((contact): contact is {
      org_id: string
      phone: string
      name: string | null
      email: string | null
      status: 'active'
      source: string
      deleted_at: null
      updated_at: string
    } => contact !== null)

  if (contacts.length === 0) {
    return res.status(400).json({
      error: 'No valid contacts after validation',
      received: rawContacts.length,
    })
  }

  const dedupedContacts = new Map<
    string,
    {
      org_id: string
      phone: string
      name: string | null
      email: string | null
      status: 'active'
      source: string
      deleted_at: null
      updated_at: string
    }
  >()
  let duplicateRows = 0

  for (const contact of contacts) {
    const existing = dedupedContacts.get(contact.phone)
    if (!existing) {
      dedupedContacts.set(contact.phone, contact)
      continue
    }

    duplicateRows += 1
    dedupedContacts.set(contact.phone, {
      ...existing,
      name: contact.name ?? existing.name,
      email: contact.email ?? existing.email,
    })
  }

  const uniqueContacts = [...dedupedContacts.values()]

  let imported = 0
  let skipped = rawContacts.length - contacts.length + duplicateRows
  const errors = [...validationErrors]

  if (duplicateRows > 0 && errors.length < 10) {
    errors.push(`${duplicateRows} duplicate row(s) merged by phone before import`)
  }

  for (let index = 0; index < uniqueContacts.length; index += 500) {
    const batch = uniqueContacts.slice(index, index + 500)
    const { data, error: dbError } = await supabase
      .from('contacts')
      .upsert(batch, {
        onConflict: 'org_id,phone',
        ignoreDuplicates: false,
      })
      .select('id')

    if (dbError) {
      logger.error({ dbError, batchIndex: index }, 'Contact import batch upsert failed')
      if (errors.length < 10) {
        errors.push(`Batch ${Math.floor(index / 500) + 1}: ${dbError.message}`)
      }
      skipped += batch.length
      continue
    }

    const insertedCount = data?.length ?? batch.length
    imported += insertedCount
    skipped += Math.max(batch.length - insertedCount, 0)
  }

  return respondData(res, {
    success: true,
    imported,
    skipped,
    total: rawContacts.length,
    errors: errors.slice(0, 10),
  })
})

router.post('/validate', authenticate, async (req: AuthRequest, res) => {
  const { phones } = req.body
  if (!Array.isArray(phones)) return res.status(400).json({ error: 'Invalid request' })
  
  // Simple validation - return the phones as is for now
  res.json({ phones })
})

router.patch('/:id', authenticate, async (req: AuthRequest, res) => {
  const { id } = req.params
  const payload = req.body
  
  const { data: before } = await supabase
    .from('contacts')
    .select('*')
    .eq('id', id)
    .eq('org_id', req.user!.orgId)
    .single()

  if (!before) return res.status(404).json({ error: 'Contact not found' })

  const phone = payload.phone ? normalizePhone(payload.phone) : before.phone
  if (!phone) return res.status(400).json({ error: 'Invalid phone number' })

  const { data: contact, error } = await supabase
    .from('contacts')
    .update({
      name: payload.name ?? before.name,
      phone,
      email: payload.email ?? before.email,
      status: payload.status ?? before.status,
      tags: payload.tags ?? before.tags,
      notes: payload.notes ?? before.notes,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('org_id', req.user!.orgId)
    .select()
    .single()

  if (error || !contact) return res.status(500).json({ error: error?.message || 'Unable to update contact' })

  await auditMutation(req, 'contact.update', 'contact', contact.id, before, contact)
  return respondData(res, contact)
})

router.delete('/:id', authenticate, async (req: AuthRequest, res) => {
  const { id } = req.params

  const { data: before } = await supabase
    .from('contacts')
    .select('*')
    .eq('id', id)
    .eq('org_id', req.user!.orgId)
    .single()

  if (!before) return res.status(404).json({ error: 'Contact not found' })

  const { data: contact, error } = await supabase
    .from('contacts')
    .update({ deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('org_id', req.user!.orgId)
    .select()
    .single()

  if (error || !contact) return res.status(500).json({ error: error?.message || 'Unable to delete contact' })

  await auditMutation(req, 'contact.delete', 'contact', contact.id, before, contact)
  return respondData(res, { success: true })
})

export default router
