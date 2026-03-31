import { Router } from 'express'
import Stripe from 'stripe'
import { supabase } from '../lib/supabase.js'
import { authenticate, AuthRequest, requireRole } from '../lib/authenticate.js'
import { config } from '../lib/config.js'
import { respondData } from '../lib/http.js'

const router = Router()

const PLAN_CATALOG = [
  { id: 'free', name: 'Free', monthlyMessages: 1000, aiCalls: 100, contacts: 1000 },
  { id: 'starter', name: 'Starter', monthlyMessages: 10000, aiCalls: 1000, contacts: 10000 },
  { id: 'growth', name: 'Growth', monthlyMessages: 50000, aiCalls: 5000, contacts: 50000 },
  { id: 'scale', name: 'Scale', monthlyMessages: 200000, aiCalls: 20000, contacts: 200000 },
  { id: 'enterprise', name: 'Enterprise', monthlyMessages: 1000000, aiCalls: 100000, contacts: 1000000 },
]

router.get('/usage', authenticate, async (req: AuthRequest, res) => {
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()
  const [{ data: usage, error }, { data: org }] = await Promise.all([
    supabase
      .from('billing_usage')
      .select('*')
      .eq('org_id', req.user!.orgId)
      .gte('period_start', monthStart)
      .single(),
    supabase
      .from('organizations')
      .select('id, name, plan, monthly_message_limit, messages_sent_this_month, stripe_customer_id, stripe_subscription_id')
      .eq('id', req.user!.orgId)
      .single(),
  ])

  if (error && error.code !== 'PGRST116') return res.status(500).json({ error: error.message })

  const currentPlan = PLAN_CATALOG.find((plan) => plan.id === org?.plan) || PLAN_CATALOG[0]
  return respondData(res, {
    usage: usage || {
      messages_sent: 0,
      ai_calls: 0,
      contacts_stored: 0,
      media_uploaded_mb: 0,
    },
    org,
    limits: currentPlan,
  })
})

router.get('/plans', authenticate, async (_req: AuthRequest, res) => {
  return respondData(res, PLAN_CATALOG)
})

router.post('/portal', authenticate, requireRole('admin'), async (req: AuthRequest, res) => {
  if (!config.stripe.ready) return res.status(503).json({ error: 'Billing not configured' })

  const { data: org } = await supabase
    .from('organizations')
    .select('stripe_customer_id')
    .eq('id', req.user!.orgId)
    .single()

  if (!org?.stripe_customer_id) return res.status(400).json({ error: 'No billing account found' })

  const stripe = new Stripe(config.stripe.secretKey)
  const session = await stripe.billingPortal.sessions.create({
    customer: org.stripe_customer_id,
    return_url: `${config.server.frontendUrl}/settings/billing`,
  })

  return respondData(res, { url: session.url })
})

router.post('/webhook', async (req, res) => {
  if (!config.stripe.ready) return res.sendStatus(400)

  const stripe = new Stripe(config.stripe.secretKey)
  const signature = req.headers['stripe-signature'] as string

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(req.body, signature, config.stripe.webhookSecret)
  } catch (err: any) {
    return res.status(400).json({ error: `Webhook error: ${err.message}` })
  }

  if (event.type === 'customer.subscription.updated') {
    const subscription = event.data.object as Stripe.Subscription
    await supabase
      .from('organizations')
      .update({
        stripe_subscription_id: subscription.id,
        plan: subscription.metadata?.plan || 'starter',
      })
      .eq('stripe_customer_id', String(subscription.customer))
  }

  if (event.type === 'invoice.payment_succeeded') {
    const invoice = event.data.object as Stripe.Invoice
    await supabase
      .from('organizations')
      .update({ is_active: true })
      .eq('stripe_customer_id', String(invoice.customer))
  }

  if (event.type === 'invoice.payment_failed') {
    const invoice = event.data.object as Stripe.Invoice
    await supabase
      .from('organizations')
      .update({
        settings: {
          billing_status: 'past_due',
          last_payment_failed_at: new Date().toISOString(),
        },
      })
      .eq('stripe_customer_id', String(invoice.customer))
  }

  return respondData(res, { received: true })
})

export default router
