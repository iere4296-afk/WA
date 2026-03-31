import crypto from 'crypto'
import { Router } from 'express'
import { z } from 'zod'
import { supabase } from '../lib/supabase.js'
import { authenticate, AuthRequest, requireRole } from '../lib/authenticate.js'
import { auditMutation, normalizeIdParam, respondData } from '../lib/http.js'
import { validate } from '../lib/validate.js'
import { webhookIdParamsSchema } from '../schemas/common.js'
import { sendWebhook } from '../modules/webhooks/webhookSender.js'

const router = Router()

const webhookSchema = z.object({
  url: z.string().url(),
  events: z.array(z.string()).default(['message.inbound']),
  secret: z.string().min(8),
})

async function getOrgWebhooks(orgId: string) {
  const { data: org, error } = await supabase
    .from('organizations')
    .select('settings')
    .eq('id', orgId)
    .single()

  if (error) {
    throw error
  }

  return {
    settings: org?.settings || {},
    webhooks: org?.settings?.webhooks || [],
  }
}

router.get('/', authenticate, async (req: AuthRequest, res) => {
  const { webhooks } = await getOrgWebhooks(req.user!.orgId)
  return respondData(res, webhooks)
})

router.post('/', authenticate, requireRole('admin'), validate(webhookSchema), async (req: AuthRequest, res) => {
  const payload = req.body as z.infer<typeof webhookSchema>
  const { settings, webhooks } = await getOrgWebhooks(req.user!.orgId)

  const newWebhook = {
    id: crypto.randomUUID(),
    url: payload.url,
    events: payload.events,
    secret: payload.secret,
    active: true,
    createdAt: new Date().toISOString(),
  }

  const nextWebhooks = [...webhooks, newWebhook]
  const { error } = await supabase
    .from('organizations')
    .update({ settings: { ...settings, webhooks: nextWebhooks } })
    .eq('id', req.user!.orgId)

  if (error) return res.status(500).json({ error: error.message })

  await auditMutation(req, 'webhook.create', 'webhook', newWebhook.id, null, newWebhook)
  return respondData(res, newWebhook, 201)
})

router.delete('/:webhookId', authenticate, requireRole('admin'), validate(webhookIdParamsSchema, 'params'), async (req: AuthRequest, res) => {
  const webhookId = normalizeIdParam(req.params.webhookId)
  const { settings, webhooks } = await getOrgWebhooks(req.user!.orgId)
  const before = webhooks.find((webhook: any) => webhook.id === webhookId)

  if (!before) return res.status(404).json({ error: 'Webhook not found' })

  const nextWebhooks = webhooks.filter((webhook: any) => webhook.id !== webhookId)
  const { error } = await supabase
    .from('organizations')
    .update({ settings: { ...settings, webhooks: nextWebhooks } })
    .eq('id', req.user!.orgId)

  if (error) return res.status(500).json({ error: error.message })

  await auditMutation(req, 'webhook.delete', 'webhook', webhookId, before, null)
  return respondData(res, { success: true })
})

router.post('/:webhookId/test', authenticate, requireRole('admin'), validate(webhookIdParamsSchema, 'params'), async (req: AuthRequest, res) => {
  const webhookId = normalizeIdParam(req.params.webhookId)
  const { webhooks } = await getOrgWebhooks(req.user!.orgId)
  const webhook = webhooks.find((candidate: any) => candidate.id === webhookId)

  if (!webhook) return res.status(404).json({ error: 'Webhook not found' })

  const delivery = await sendWebhook(webhook.url, webhook.secret, 'webhook.test', {
    orgId: req.user!.orgId,
    webhookId,
    testedAt: new Date().toISOString(),
  })

  return respondData(res, delivery)
})

export default router
