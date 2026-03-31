import { Router } from 'express'
import { z } from 'zod'
import { supabase } from '../lib/supabase.js'
import { authenticate, AuthRequest, requireRole } from '../lib/authenticate.js'
import { auditMutation, normalizeIdParam, respondData } from '../lib/http.js'
import { validate } from '../lib/validate.js'
import { idParamsSchema } from '../schemas/common.js'

const router = Router()

const ruleSchema = z.object({
  name: z.string().trim().min(1),
  triggerType: z.enum(['keyword', 'first_message', 'outside_hours', 'any_message']),
  matchType: z.enum(['contains', 'exact', 'starts_with', 'regex']).default('contains'),
  keywords: z.array(z.string()).default([]),
  responseType: z.enum(['text', 'template', 'ai_powered']).default('text'),
  responseMessage: z.string().optional(),
  templateId: z.string().uuid().optional(),
  aiSystemPrompt: z.string().optional(),
  cooldownMinutes: z.coerce.number().min(0).default(60),
  priority: z.coerce.number().default(0),
  isActive: z.boolean().default(true),
})

router.get('/', authenticate, async (req: AuthRequest, res) => {
  const { data, error } = await supabase
    .from('auto_reply_rules')
    .select('*')
    .eq('org_id', req.user!.orgId)
    .order('priority', { ascending: false })

  if (error) return res.status(500).json({ error: error.message })
  return respondData(res, data || [])
})

router.post('/', authenticate, requireRole('operator'), validate(ruleSchema), async (req: AuthRequest, res) => {
  const payload = req.body as z.infer<typeof ruleSchema>
  const { data, error } = await supabase
    .from('auto_reply_rules')
    .insert({
      org_id: req.user!.orgId,
      name: payload.name,
      trigger_type: payload.triggerType,
      match_type: payload.matchType,
      keywords: payload.keywords,
      response_type: payload.responseType,
      response_message: payload.responseMessage,
      template_id: payload.templateId,
      ai_system_prompt: payload.aiSystemPrompt,
      cooldown_minutes: payload.cooldownMinutes,
      priority: payload.priority,
      is_active: payload.isActive,
    })
    .select()
    .single()

  if (error || !data) return res.status(500).json({ error: error?.message || 'Unable to create auto-reply rule' })
  await auditMutation(req, 'auto-reply.create', 'auto_reply_rule', data.id, null, data)
  return respondData(res, data, 201)
})

router.patch('/:id', authenticate, requireRole('operator'), validate(idParamsSchema, 'params'), validate(ruleSchema.partial()), async (req: AuthRequest, res) => {
  const ruleId = normalizeIdParam(req.params.id)
  const payload = req.body as Partial<z.infer<typeof ruleSchema>>
  const { data: before } = await supabase
    .from('auto_reply_rules')
    .select('*')
    .eq('id', ruleId)
    .eq('org_id', req.user!.orgId)
    .single()

  if (!before) return res.status(404).json({ error: 'Rule not found' })

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (payload.name !== undefined) updates.name = payload.name
  if (payload.triggerType !== undefined) updates.trigger_type = payload.triggerType
  if (payload.matchType !== undefined) updates.match_type = payload.matchType
  if (payload.keywords !== undefined) updates.keywords = payload.keywords
  if (payload.responseType !== undefined) updates.response_type = payload.responseType
  if (payload.responseMessage !== undefined) updates.response_message = payload.responseMessage
  if (payload.templateId !== undefined) updates.template_id = payload.templateId
  if (payload.aiSystemPrompt !== undefined) updates.ai_system_prompt = payload.aiSystemPrompt
  if (payload.cooldownMinutes !== undefined) updates.cooldown_minutes = payload.cooldownMinutes
  if (payload.priority !== undefined) updates.priority = payload.priority
  if (payload.isActive !== undefined) updates.is_active = payload.isActive

  const { data, error } = await supabase
    .from('auto_reply_rules')
    .update(updates)
    .eq('id', ruleId)
    .eq('org_id', req.user!.orgId)
    .select()
    .single()

  if (error || !data) return res.status(500).json({ error: error?.message || 'Unable to update rule' })
  await auditMutation(req, 'auto-reply.update', 'auto_reply_rule', data.id, before, data)
  return respondData(res, data)
})

router.patch('/:id/toggle', authenticate, requireRole('operator'), validate(idParamsSchema, 'params'), async (req: AuthRequest, res) => {
  const ruleId = normalizeIdParam(req.params.id)
  const { data: before } = await supabase
    .from('auto_reply_rules')
    .select('*')
    .eq('id', ruleId)
    .eq('org_id', req.user!.orgId)
    .single()

  if (!before) return res.status(404).json({ error: 'Rule not found' })

  const { data, error } = await supabase
    .from('auto_reply_rules')
    .update({
      is_active: !before.is_active,
      updated_at: new Date().toISOString(),
    })
    .eq('id', ruleId)
    .eq('org_id', req.user!.orgId)
    .select()
    .single()

  if (error || !data) return res.status(500).json({ error: error?.message || 'Unable to toggle rule' })
  await auditMutation(req, 'auto-reply.toggle', 'auto_reply_rule', data.id, before, data)
  return respondData(res, data)
})

router.delete('/:id', authenticate, requireRole('operator'), validate(idParamsSchema, 'params'), async (req: AuthRequest, res) => {
  const ruleId = normalizeIdParam(req.params.id)
  const { data: before } = await supabase
    .from('auto_reply_rules')
    .select('*')
    .eq('id', ruleId)
    .eq('org_id', req.user!.orgId)
    .single()

  if (!before) return res.status(404).json({ error: 'Rule not found' })

  const { error } = await supabase
    .from('auto_reply_rules')
    .delete()
    .eq('id', ruleId)
    .eq('org_id', req.user!.orgId)

  if (error) return res.status(500).json({ error: error.message })
  await auditMutation(req, 'auto-reply.delete', 'auto_reply_rule', ruleId, before, null)
  return respondData(res, { success: true })
})

export default router
