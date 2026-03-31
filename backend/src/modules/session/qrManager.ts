import QRCode from 'qrcode'
import { supabase } from '../../lib/supabase.js'
import { logger } from '../../lib/logger.js'

type ExpireHandler = () => Promise<void> | void

const qrTimers = new Map<string, NodeJS.Timeout>()
const qrAttempts = new Map<string, number>()

async function broadcastQR(deviceId: string, qrCode: string, attempt: number) {
  try {
    const channel = (supabase.channel(`qr:${deviceId}`) as any)
    await channel.subscribe()
    await channel.send({
      type: 'broadcast',
      event: 'qr',
      payload: {
        deviceId,
        qrCode,
        attempt,
        expiresInSeconds: 60,
      },
    })
    await channel.unsubscribe()
  } catch (error) {
    logger.warn({ error, deviceId }, 'Unable to broadcast QR update')
  }
}

export const qrManager = {
  async publishQR(deviceId: string, qr: string, onExpire?: ExpireHandler): Promise<string | null> {
    const attempt = (qrAttempts.get(deviceId) ?? 0) + 1
    if (attempt > 5) {
      logger.warn({ deviceId }, 'QR regeneration limit reached')
      return null
    }

    qrAttempts.set(deviceId, attempt)
    const qrCode = await QRCode.toDataURL(qr)

    await supabase
      .from('whatsapp_devices')
      .update({
        qr_code: qrCode,
        status: 'connecting',
        updated_at: new Date().toISOString(),
      })
      .eq('id', deviceId)

    await broadcastQR(deviceId, qrCode, attempt)

    const existingTimer = qrTimers.get(deviceId)
    if (existingTimer) {
      clearTimeout(existingTimer)
    }

    qrTimers.set(deviceId, setTimeout(() => {
      void this.clearQR(deviceId, false)
      if (onExpire) {
        void Promise.resolve(onExpire())
      }
    }, 60_000))

    return qrCode
  },

  async clearQR(deviceId: string, resetAttempts = true): Promise<void> {
    const timer = qrTimers.get(deviceId)
    if (timer) {
      clearTimeout(timer)
      qrTimers.delete(deviceId)
    }

    if (resetAttempts) {
      qrAttempts.delete(deviceId)
    }
    await supabase
      .from('whatsapp_devices')
      .update({
        qr_code: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', deviceId)
  },

  getAttempts(deviceId: string): number {
    return qrAttempts.get(deviceId) ?? 0
  },
}
