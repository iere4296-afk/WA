import crypto from 'crypto'
import { Router } from 'express'
import { z } from 'zod'
import { supabase } from '../lib/supabase.js'
import { authenticate, requireRole, AuthRequest } from '../lib/authenticate.js'
import { auditMutation, normalizeIdParam, respondData } from '../lib/http.js'
import { validate } from '../lib/validate.js'
import { idParamsSchema, userIdParamsSchema, webhookIdParamsSchema } from '../schemas/common.js'

const router = Router()

const updateOrgSchema = z.object({
  name: z.string().trim().min(1).optional(),
  timezone: z.string().trim().optional(),
  logoUrl: z.string().url().optional(),
  customDomain: z.string().trim().optional(),
})

const inviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(['owner', 'admin', 'operator', 'member', 'viewer']).default('member'),
})

const updateRoleSchema = z.object({
  role: z.enum(['owner', 'admin', 'operator', 'member', 'viewer']),
})

const createApiKeySchema = z.object({
  name: z.string().trim().min(1),
})

const createWebhookSchema = z.object({
  url: z.string().url(),
  events: z.array(z.string()).default(['message.inbound']),
  secret: z.string().min(8),
})

async function getOrgSettings(orgId: string) {
  const { data: org, error } = await supabase
    .from('organizations')
    .select('*')
    .eq('id', orgId)
    .single()

  if (error || !org) {
    throw error || new Error('Organization not found')
  }

  return org
}

router.get('/org', authenticate, async (req: AuthRequest, res) => {
  try {
    return respondData(res, await getOrgSettings(req.user!.orgId))
  } catch {
    return res.status(404).json({ error: 'Org not found' })
  }
})

router.patch('/org', authenticate, requireRole('admin'), validate(updateOrgSchema), async (req: AuthRequest, res) => {
  const org = await getOrgSettings(req.user!.orgId)
  const payload = req.body as z.infer<typeof updateOrgSchema>

  const { data, error } = await supabase
    .from('organizations')
    .update({
      name: payload.name ?? org.name,
      timezone: payload.timezone ?? org.timezone,
      logo_url: payload.logoUrl ?? org.logo_url,
      custom_domain: payload.customDomain ?? org.custom_domain,
      updated_at: new Date().toISOString(),
    })
    .eq('id', req.user!.orgId)
    .select()
    .single()

  if (error || !data) return res.status(500).json({ error: error?.message || 'Unable to update organization' })
  await auditMutation(req, 'settings.org.update', 'organization', data.id, org, data)
  return respondData(res, data)
})

router.get('/team', authenticate, async (req: AuthRequest, res) => {
  const { data: members, error } = await supabase
    .from('org_members')
    .select('*')
    .eq('org_id', req.user!.orgId)
    .order('joined_at', { ascending: true })

  if (error) return res.status(500).json({ error: error.message })

  const jwt = (await import('jsonwebtoken')).default
  const hydrated = await Promise.all((members || []).map(async (member) => {
    if (!member.user_id) {
      const invitePayload = member.invite_token
        ? jwt.decode(member.invite_token) as { email?: string } | null
        : null

      return {
        ...member,
        email: invitePayload?.email || null,
        name: null,
        pending: true,
      }
    }
    const { data: userData } = await supabase.auth.admin.getUserById(member.user_id)
    return {
      ...member,
      email: userData.user?.email || null,
      name: userData.user?.user_metadata?.name || null,
      pending: false,
    }
  }))

  return respondData(res, hydrated)
})

router.post('/team/invite', authenticate, requireRole('admin'), validate(inviteSchema), async (req: AuthRequest, res) => {
  const { email, role } = req.body as z.infer<typeof inviteSchema>
  const jwt = (await import('jsonwebtoken')).default
  const { config } = await import('../lib/config.js')

  const inviteToken = jwt.sign(
    { email, orgId: req.user!.orgId, role, type: 'invite' },
    config.security.jwtSecret,
    { expiresIn: '48h' },
  )

  const { data, error } = await supabase
    .from('org_members')
    .insert({
      org_id: req.user!.orgId,
      role,
      invite_token: inviteToken,
      invite_expires_at: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
      invited_by: req.user!.id,
    })
    .select()
    .single()

  if (error || !data) return res.status(500).json({ error: error?.message || 'Unable to create invite' })

  await auditMutation(req, 'settings.team.invite', 'org_member', data.id, null, { email, role })
  return respondData(res, { inviteToken, member: data })
})

router.patch('/team/:userId/role', authenticate, requireRole('owner'), validate(userIdParamsSchema, 'params'), validate(updateRoleSchema), async (req: AuthRequest, res) => {
  const userId = normalizeIdParam(req.params.userId)
  const { role } = req.body as z.infer<typeof updateRoleSchema>
  const { data: before } = await supabase
    .from('org_members')
    .select('*')
    .eq('org_id', req.user!.orgId)
    .eq('user_id', userId)
    .single()

  if (!before) return res.status(404).json({ error: 'Member not found' })

  const { data, error } = await supabase
    .from('org_members')
    .update({ role })
    .eq('org_id', req.user!.orgId)
    .eq('user_id', userId)
    .select()
    .single()

  if (error || !data) return res.status(500).json({ error: error?.message || 'Unable to update role' })
  await auditMutation(req, 'settings.team.role', 'org_member', data.id, before, data)
  return respondData(res, data)
})

router.delete('/team/:userId', authenticate, requireRole('owner'), validate(userIdParamsSchema, 'params'), async (req: AuthRequest, res) => {
  const userId = normalizeIdParam(req.params.userId)
  const { data: before } = await supabase
    .from('org_members')
    .select('*')
    .eq('org_id', req.user!.orgId)
    .eq('user_id', userId)
    .single()

  if (!before) return res.status(404).json({ error: 'Member not found' })

  const { error } = await supabase
    .from('org_members')
    .delete()
    .eq('org_id', req.user!.orgId)
    .eq('user_id', userId)

  if (error) return res.status(500).json({ error: error.message })
  await auditMutation(req, 'settings.team.remove', 'org_member', before.id, before, null)
  return respondData(res, { success: true })
})

router.get('/api-keys', authenticate, async (req: AuthRequest, res) => {
  const org = await getOrgSettings(req.user!.orgId)
  const apiKeys = (org.settings?.apiKeys || []).map((key: any) => ({
    ...key,
    value: undefined,
    masked: `${key.prefix || 'wa'}...${(key.value || '').slice(-4)}`,
  }))
  return respondData(res, apiKeys)
})

router.post('/api-keys', authenticate, requireRole('admin'), validate(createApiKeySchema), async (req: AuthRequest, res) => {
  const org = await getOrgSettings(req.user!.orgId)
  const { name } = req.body as z.infer<typeof createApiKeySchema>
  const value = crypto.randomBytes(24).toString('hex')
  const prefix = value.slice(0, 8)
  const key = {
    id: crypto.randomUUID(),
    name,
    prefix,
    value,
    createdAt: new Date().toISOString(),
  }

  const settings = {
    ...(org.settings || {}),
    apiKeys: [...(org.settings?.apiKeys || []), key],
  }

  const { error } = await supabase
    .from('organizations')
    .update({ settings })
    .eq('id', req.user!.orgId)

  if (error) return res.status(500).json({ error: error.message })
  await auditMutation(req, 'settings.api-key.create', 'api_key', key.id, null, { ...key, value: undefined })
  return respondData(res, key, 201)
})

router.delete('/api-keys/:id', authenticate, requireRole('admin'), validate(idParamsSchema, 'params'), async (req: AuthRequest, res) => {
  const org = await getOrgSettings(req.user!.orgId)
  const apiKeyId = normalizeIdParam(req.params.id)
  const existingKey = (org.settings?.apiKeys || []).find((key: any) => key.id === apiKeyId)

  if (!existingKey) return res.status(404).json({ error: 'API key not found' })

  const settings = {
    ...(org.settings || {}),
    apiKeys: (org.settings?.apiKeys || []).filter((key: any) => key.id !== apiKeyId),
  }

  const { error } = await supabase
    .from('organizations')
    .update({ settings })
    .eq('id', req.user!.orgId)

  if (error) return res.status(500).json({ error: error.message })
  await auditMutation(req, 'settings.api-key.delete', 'api_key', apiKeyId, { ...existingKey, value: undefined }, null)
  return respondData(res, { success: true })
})

router.get('/webhooks', authenticate, async (req: AuthRequest, res) => {
  const org = await getOrgSettings(req.user!.orgId)
  return respondData(res, org.settings?.webhooks || [])
})

router.post('/webhooks', authenticate, requireRole('admin'), validate(createWebhookSchema), async (req: AuthRequest, res) => {
  const org = await getOrgSettings(req.user!.orgId)
  const payload = req.body as z.infer<typeof createWebhookSchema>
  const webhook = {
    id: crypto.randomUUID(),
    url: payload.url,
    events: payload.events,
    secret: payload.secret,
    active: true,
    createdAt: new Date().toISOString(),
  }

  const settings = {
    ...(org.settings || {}),
    webhooks: [...(org.settings?.webhooks || []), webhook],
  }

  const { error } = await supabase
    .from('organizations')
    .update({ settings })
    .eq('id', req.user!.orgId)

  if (error) return res.status(500).json({ error: error.message })
  await auditMutation(req, 'settings.webhook.create', 'webhook', webhook.id, null, webhook)
  return respondData(res, webhook, 201)
})

router.delete('/webhooks/:webhookId', authenticate, requireRole('admin'), validate(webhookIdParamsSchema, 'params'), async (req: AuthRequest, res) => {
  const webhookId = normalizeIdParam(req.params.webhookId)
  const org = await getOrgSettings(req.user!.orgId)
  const before = (org.settings?.webhooks || []).find((webhook: any) => webhook.id === webhookId)

  if (!before) return res.status(404).json({ error: 'Webhook not found' })

  const settings = {
    ...(org.settings || {}),
    webhooks: (org.settings?.webhooks || []).filter((webhook: any) => webhook.id !== webhookId),
  }

  const { error } = await supabase
    .from('organizations')
    .update({ settings })
    .eq('id', req.user!.orgId)

  if (error) return res.status(500).json({ error: error.message })
  await auditMutation(req, 'settings.webhook.delete', 'webhook', webhookId, before, null)
  return respondData(res, { success: true })
})

export default router
