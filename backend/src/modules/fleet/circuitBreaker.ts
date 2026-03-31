import { supabase } from '../../lib/supabase.js'

export interface CircuitBreakerResult {
  triggered: boolean
  reasons: string[]
}

export const circuitBreaker = {
  async evaluateDevice(deviceId: string): Promise<CircuitBreakerResult> {
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const [{ data: device }, { count: optOuts }, { count: banSignals }] = await Promise.all([
      supabase.from('whatsapp_devices').select('status, health_score').eq('id', deviceId).single(),
      supabase.from('health_events').select('*', { count: 'exact', head: true }).eq('device_id', deviceId).eq('event_type', 'opt_out').gte('created_at', since24h),
      supabase.from('health_events').select('*', { count: 'exact', head: true }).eq('device_id', deviceId).eq('event_type', 'ban_signal').gte('created_at', since24h),
    ])

    const reasons: string[] = []
    if ((device?.health_score ?? 100) <= 30) reasons.push('health_score_below_threshold')
    if ((optOuts ?? 0) >= 3) reasons.push('opt_out_spike')
    if ((banSignals ?? 0) >= 1) reasons.push('ban_signal_detected')
    if (device?.status === 'banned') reasons.push('device_marked_banned')

    const triggered = reasons.length > 0
    if (triggered) {
      await supabase
        .from('whatsapp_devices')
        .update({
          status: device?.status === 'banned' ? 'banned' : 'paused',
          updated_at: new Date().toISOString(),
        })
        .eq('id', deviceId)
    }

    return { triggered, reasons }
  },
}
