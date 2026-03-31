import { Router } from 'express'
import { z } from 'zod'
import { supabase } from '../lib/supabase.js'
import { authenticate, AuthRequest, requireRole } from '../lib/authenticate.js'
import { auditMutation, decodeCursor, encodeCursor, normalizeIdParam, respondData, respondPaginated } from '../lib/http.js'
import { validate } from '../lib/validate.js'
import { idParamsSchema, paginationQuerySchema } from '../schemas/common.js'

const router = Router()

const flowSchema = z.object({
  name: z.string().trim().min(1),
  description: z.string().trim().optional(),
  triggerType: z.enum(['manual', 'campaign_completion', 'tag_added', 'api']).default('manual'),
  status: z.enum(['draft', 'active', 'paused', 'archived']).optional(),
})

const listFlowsQuerySchema = paginationQuerySchema

const flowStepsSchema = z.object({
  steps: z.array(z.object({
    id: z.string().uuid().optional(),
    name: z.string().trim().min(1),
    delayHours: z.coerce.number().int().min(0).default(24),
    type: z.enum(['message', 'condition', 'wait', 'action']).default('message'),
    templateId: z.string().uuid().optional(),
    aiPrompt: z.string().optional(),
    conditionRules: z.record(z.any()).default({}),
  })).default([]),
})

const reorderStepsSchema = z.object({
  stepIds: z.array(z.string().uuid()).min(1),
})

const enrollSchema = z.object({
  contactIds: z.array(z.string().uuid()).min(1).optional(),
  listId: z.string().uuid().optional(),
}).refine((value) => !!value.contactIds?.length || !!value.listId, {
  message: 'Provide contactIds or listId',
})

router.get('/', authenticate, validate(listFlowsQuerySchema, 'query'), async (req: AuthRequest, res) => {
  const { cursor, limit } = req.query as unknown as z.infer<typeof listFlowsQuerySchema>

  let query = supabase
    .from('flows')
    .select('*, flow_steps(count)')
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

  const { data, error } = await query

  if (error) return res.status(500).json({ error: error.message })
  const nextCursor = data && data.length === limit
    ? encodeCursor({ created_at: data[data.length - 1].created_at, id: data[data.length - 1].id })
    : null

  return respondPaginated(res, data || [], { nextCursor, hasMore: !!nextCursor })
})

router.get('/:id', authenticate, validate(idParamsSchema, 'params'), async (req: AuthRequest, res) => {
  const flowId = normalizeIdParam(req.params.id)
  const { data, error } = await supabase
    .from('flows')
    .select('*, flow_steps(*)')
    .eq('id', flowId)
    .eq('org_id', req.user!.orgId)
    .single()

  if (error || !data) return res.status(404).json({ error: 'Flow not found' })
  return respondData(res, data)
})

router.post('/', authenticate, requireRole('operator'), validate(flowSchema), async (req: AuthRequest, res) => {
  const payload = req.body as z.infer<typeof flowSchema>
  const { data, error } = await supabase
    .from('flows')
    .insert({
      org_id: req.user!.orgId,
      name: payload.name,
      description: payload.description,
      trigger_type: payload.triggerType,
      status: payload.status ?? 'draft',
    })
    .select()
    .single()

  if (error || !data) return res.status(500).json({ error: error?.message || 'Unable to create flow' })
  await auditMutation(req, 'flow.create', 'flow', data.id, null, data)
  return respondData(res, data, 201)
})

router.post('/:id/steps', authenticate, requireRole('operator'), validate(idParamsSchema, 'params'), validate(flowStepsSchema), async (req: AuthRequest, res) => {
  const flowId = normalizeIdParam(req.params.id)
  const { steps } = req.body as z.infer<typeof flowStepsSchema>

  await supabase.from('flow_steps').delete().eq('flow_id', flowId).eq('org_id', req.user!.orgId)

  if (steps.length === 0) {
    await auditMutation(req, 'flow.steps.replace', 'flow', flowId, null, [])
    return respondData(res, [])
  }

  const { data, error } = await supabase
    .from('flow_steps')
    .insert(steps.map((step, index) => ({
      flow_id: flowId,
      org_id: req.user!.orgId,
      step_order: index + 1,
      name: step.name,
      delay_hours: step.delayHours,
      type: step.type,
      template_id: step.templateId ?? null,
      ai_prompt: step.aiPrompt ?? null,
      condition_rules: step.conditionRules,
    })))
    .select()

  if (error) return res.status(500).json({ error: error.message })
  await auditMutation(req, 'flow.steps.replace', 'flow', flowId, null, data)
  return respondData(res, data || [])
})

router.put('/:id/steps', authenticate, requireRole('operator'), validate(idParamsSchema, 'params'), validate(reorderStepsSchema), async (req: AuthRequest, res) => {
  const flowId = normalizeIdParam(req.params.id)
  const { stepIds } = req.body as z.infer<typeof reorderStepsSchema>

  const updates = await Promise.all(stepIds.map((stepId, index) =>
    supabase
      .from('flow_steps')
      .update({ step_order: index + 1 })
      .eq('id', stepId)
      .eq('flow_id', flowId)
      .eq('org_id', req.user!.orgId)
  ))

  const error = updates.find((result) => result.error)?.error
  if (error) return res.status(500).json({ error: error.message })

  const { data } = await supabase
    .from('flow_steps')
    .select('*')
    .eq('flow_id', flowId)
    .eq('org_id', req.user!.orgId)
    .order('step_order', { ascending: true })

  await auditMutation(req, 'flow.steps.reorder', 'flow', flowId, null, { stepIds })
  return respondData(res, data || [])
})

router.patch('/:id', authenticate, requireRole('operator'), validate(idParamsSchema, 'params'), validate(flowSchema.partial()), async (req: AuthRequest, res) => {
  const flowId = normalizeIdParam(req.params.id)
  const payload = req.body as Partial<z.infer<typeof flowSchema>>
  const { data: before } = await supabase
    .from('flows')
    .select('*')
    .eq('id', flowId)
    .eq('org_id', req.user!.orgId)
    .single()

  if (!before) return res.status(404).json({ error: 'Flow not found' })

  const { data, error } = await supabase
    .from('flows')
    .update({
      name: payload.name ?? before.name,
      description: payload.description ?? before.description,
      trigger_type: payload.triggerType ?? before.trigger_type,
      status: payload.status ?? before.status,
      updated_at: new Date().toISOString(),
    })
    .eq('id', flowId)
    .eq('org_id', req.user!.orgId)
    .select()
    .single()

  if (error || !data) return res.status(500).json({ error: error?.message || 'Unable to update flow' })
  await auditMutation(req, 'flow.update', 'flow', data.id, before, data)
  return respondData(res, data)
})

router.delete('/:id', authenticate, requireRole('operator'), validate(idParamsSchema, 'params'), async (req: AuthRequest, res) => {
  const flowId = normalizeIdParam(req.params.id)
  const { data: before } = await supabase
    .from('flows')
    .select('*')
    .eq('id', flowId)
    .eq('org_id', req.user!.orgId)
    .single()

  if (!before) return res.status(404).json({ error: 'Flow not found' })

  const { error } = await supabase
    .from('flows')
    .delete()
    .eq('id', flowId)
    .eq('org_id', req.user!.orgId)

  if (error) return res.status(500).json({ error: error.message })
  await auditMutation(req, 'flow.delete', 'flow', flowId, before, null)
  return respondData(res, { success: true })
})

router.post('/:id/enroll', authenticate, requireRole('operator'), validate(idParamsSchema, 'params'), validate(enrollSchema), async (req: AuthRequest, res) => {
  const flowId = normalizeIdParam(req.params.id)
  const { contactIds, listId } = req.body as z.infer<typeof enrollSchema>

  let effectiveContactIds = contactIds || []
  if (listId) {
    const { data: members } = await supabase
      .from('contact_list_members')
      .select('contact_id')
      .eq('list_id', listId)
    effectiveContactIds = members?.map((member) => member.contact_id) || []
  }

  if (effectiveContactIds.length === 0) {
    return res.status(400).json({ error: 'No contacts to enroll' })
  }

  const enrollments = effectiveContactIds.map((contactId) => ({
    flow_id: flowId,
    contact_id: contactId,
    org_id: req.user!.orgId,
    status: 'active',
    enrolled_at: new Date().toISOString(),
    next_step_at: new Date().toISOString(),
  }))

  const { error } = await supabase
    .from('flow_enrollments')
    .upsert(enrollments, { onConflict: 'flow_id,contact_id' })

  if (error) return res.status(500).json({ error: error.message })

  await supabase
    .from('flows')
    .update({ enrolled_count: effectiveContactIds.length, updated_at: new Date().toISOString() })
    .eq('id', flowId)
    .eq('org_id', req.user!.orgId)

  await auditMutation(req, 'flow.enroll', 'flow', flowId, null, { contactIds: effectiveContactIds })
  return respondData(res, { enrolled: effectiveContactIds.length })
})

export default router
