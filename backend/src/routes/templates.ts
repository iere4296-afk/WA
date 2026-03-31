import { Router } from 'express'
import { z } from 'zod'
import { supabase } from '../lib/supabase.js'
import { authenticate, AuthRequest, requireRole } from '../lib/authenticate.js'
import { aiService } from '../modules/ai/aiService.js'
import { auditMutation, decodeCursor, encodeCursor, normalizeIdParam, respondData, respondPaginated } from '../lib/http.js'
import { validate } from '../lib/validate.js'
import { idParamsSchema, paginationQuerySchema } from '../schemas/common.js'

const router = Router()

const templateSchema = z.object({
  name: z.string().trim().min(1),
  category: z.enum(['marketing', 'transactional', 'support', 'reminder', 'otp', 'other']).default('marketing'),
  language: z.string().default('EN'),
  type: z.enum(['text', 'image', 'video', 'document']).default('text'),
  header: z.string().optional(),
  body: z.string().trim().min(1),
  footer: z.string().optional(),
  tags: z.array(z.string()).default([]),
  status: z.enum(['draft', 'active', 'archived']).default('draft'),
  isAiGenerated: z.boolean().optional(),
})

const listTemplatesQuerySchema = paginationQuerySchema.extend({
  category: z.string().optional(),
  type: z.string().optional(),
  tags: z.string().optional(),
})

const aiGenerateSchema = z.object({
  description: z.string().trim().min(1),
  category: z.string().optional(),
  language: z.string().optional(),
  tone: z.string().optional(),
  intentScore: z.coerce.number().optional(),
})

function extractVariables(content: string): string[] {
  const matches = content.match(/\{\{(\w+)\}\}/g) || []
  return [...new Set(matches.map((match) => match.slice(2, -2)))]
}

router.get('/', authenticate, validate(listTemplatesQuerySchema, 'query'), async (req: AuthRequest, res) => {
  const { category, type, tags, cursor, limit } = req.query as unknown as z.infer<typeof listTemplatesQuerySchema>

  let query = supabase
    .from('message_templates')
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
      query = query.lt('id', cursor)
    }
  }

  if (category) {
    query = query.eq('category', category)
  }

  if (type) {
    query = query.eq('type', type)
  }

  if (tags) {
    const tagList = tags.split(',').map((tag) => tag.trim()).filter(Boolean)
    if (tagList.length > 0) {
      query = query.overlaps('tags', tagList)
    }
  }

  const { data: templates, error } = await query
  if (error) return res.status(500).json({ error: error.message })

  const nextCursor = templates && templates.length === limit
    ? encodeCursor({ created_at: templates[templates.length - 1].created_at, id: templates[templates.length - 1].id })
    : null
  return respondPaginated(res, templates || [], { nextCursor, hasMore: !!nextCursor })
})

router.post('/', authenticate, requireRole('operator'), validate(templateSchema), async (req: AuthRequest, res) => {
  const payload = req.body as z.infer<typeof templateSchema>
  const { data: template, error } = await supabase
    .from('message_templates')
    .insert({
      org_id: req.user!.orgId,
      name: payload.name,
      category: payload.category,
      language: payload.language,
      type: payload.type,
      header: payload.header,
      body: payload.body,
      footer: payload.footer,
      tags: payload.tags,
      status: payload.status,
      is_ai_generated: payload.isAiGenerated ?? false,
      variables: extractVariables(payload.body),
    })
    .select()
    .single()

  if (error || !template) return res.status(500).json({ error: error?.message || 'Unable to create template' })
  await auditMutation(req, 'template.create', 'template', template.id, null, template)
  return respondData(res, template, 201)
})

async function generateTemplate(req: AuthRequest, res: any) {
  const payload = req.body as z.infer<typeof aiGenerateSchema>
  try {
    const result = await aiService.generateMessage({
      description: payload.description,
      category: payload.category,
      language: payload.language,
      tone: payload.tone,
      intentScore: payload.intentScore,
      orgId: req.user!.orgId,
      userId: req.user!.id,
    })

    return respondData(res, result)
  } catch (err: any) {
    return res.status(500).json({ error: err.message })
  }
}

router.post('/generate', authenticate, requireRole('operator'), validate(aiGenerateSchema), generateTemplate)
router.post('/ai-generate', authenticate, requireRole('operator'), validate(aiGenerateSchema), generateTemplate)

router.patch('/:id', authenticate, requireRole('operator'), validate(idParamsSchema, 'params'), validate(templateSchema.partial()), async (req: AuthRequest, res) => {
  const templateId = normalizeIdParam(req.params.id)
  const updates = req.body as Partial<z.infer<typeof templateSchema>>

  const { data: before } = await supabase
    .from('message_templates')
    .select('*')
    .eq('id', templateId)
    .eq('org_id', req.user!.orgId)
    .single()

  if (!before) return res.status(404).json({ error: 'Template not found' })

  const payload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  }
  if (updates.name !== undefined) payload.name = updates.name
  if (updates.category !== undefined) payload.category = updates.category
  if (updates.language !== undefined) payload.language = updates.language
  if (updates.header !== undefined) payload.header = updates.header
  if (updates.footer !== undefined) payload.footer = updates.footer
  if (updates.status !== undefined) payload.status = updates.status
  if (updates.body) {
    payload.body = updates.body
    payload.variables = extractVariables(updates.body)
  }
  if (updates.type !== undefined) {
    payload.type = updates.type
  }
  if (updates.tags !== undefined) {
    payload.tags = updates.tags
  }
  if (updates.isAiGenerated !== undefined) {
    payload.is_ai_generated = updates.isAiGenerated
  }

  const { data: template, error } = await supabase
    .from('message_templates')
    .update(payload)
    .eq('id', templateId)
    .eq('org_id', req.user!.orgId)
    .select()
    .single()

  if (error || !template) return res.status(500).json({ error: error?.message || 'Unable to update template' })
  await auditMutation(req, 'template.update', 'template', template.id, before, template)
  return respondData(res, template)
})

router.delete('/:id', authenticate, requireRole('operator'), validate(idParamsSchema, 'params'), async (req: AuthRequest, res) => {
  const templateId = normalizeIdParam(req.params.id)
  const { data: before } = await supabase
    .from('message_templates')
    .select('*')
    .eq('id', templateId)
    .eq('org_id', req.user!.orgId)
    .single()

  if (!before) return res.status(404).json({ error: 'Template not found' })

  const { error } = await supabase
    .from('message_templates')
    .delete()
    .eq('id', templateId)
    .eq('org_id', req.user!.orgId)

  if (error) return res.status(500).json({ error: error.message })
  await auditMutation(req, 'template.delete', 'template', templateId, before, null)
  return respondData(res, { success: true })
})

export default router
