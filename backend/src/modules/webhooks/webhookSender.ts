import crypto from 'crypto'

export interface WebhookDeliveryResult {
  ok: boolean
  status: number
}

export async function sendWebhook(url: string, secret: string, event: string, payload: unknown): Promise<WebhookDeliveryResult> {
  const body = JSON.stringify(payload)
  const signature = crypto.createHmac('sha256', secret).update(body).digest('hex')

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-wa-event': event,
      'x-wa-signature': signature,
    },
    body,
  })

  return {
    ok: response.ok,
    status: response.status,
  }
}
