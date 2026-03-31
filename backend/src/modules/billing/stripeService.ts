import Stripe from 'stripe'
import { config } from '../../lib/config.js'

const stripeClient = config.stripe.ready ? new Stripe(config.stripe.secretKey) : null

export const stripeService = {
  getClient() {
    return stripeClient
  },

  async createPortalSession(customerId: string, returnUrl: string) {
    if (!stripeClient) {
      return null
    }

    return stripeClient.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    })
  },

  async listInvoices(customerId: string) {
    if (!stripeClient) {
      return []
    }

    const invoices = await stripeClient.invoices.list({ customer: customerId, limit: 20 })
    return invoices.data
  },
}
