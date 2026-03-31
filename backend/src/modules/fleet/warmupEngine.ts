import { supabase } from '../../lib/supabase.js'

const WARMUP_CURVE = [5, 8, 12, 16, 20, 25, 32, 40, 50, 62, 75, 90, 110, 130, 150, 170, 190, 210, 230, 250]

export function getWarmupTarget(day: number, dailyLimit: number): number {
  const curveValue = WARMUP_CURVE[Math.max(0, Math.min(day - 1, WARMUP_CURVE.length - 1))] ?? 25
  return Math.min(curveValue, dailyLimit)
}

export const warmupEngine = {
  getWarmupTarget,

  async start(deviceId: string) {
    const warmupStarted = new Date().toISOString()
    const { data, error } = await supabase
      .from('whatsapp_devices')
      .update({
        is_warmup_active: true,
        status: 'warming',
        warmup_day: 1,
        warmup_started: warmupStarted,
        updated_at: warmupStarted,
      })
      .eq('id', deviceId)
      .select()
      .single()

    if (error) throw error
    return data
  },

  async advanceDay(deviceId: string) {
    const { data: device, error } = await supabase
      .from('whatsapp_devices')
      .select('warmup_day, warmup_target_day, daily_limit')
      .eq('id', deviceId)
      .single()

    if (error) throw error

    const nextDay = Math.min((device?.warmup_day ?? 0) + 1, device?.warmup_target_day ?? 30)
    const target = getWarmupTarget(nextDay, device?.daily_limit ?? 200)

    await supabase
      .from('whatsapp_devices')
      .update({
        warmup_day: nextDay,
        updated_at: new Date().toISOString(),
      })
      .eq('id', deviceId)

    return { day: nextDay, target }
  },

  async stop(deviceId: string) {
    const { data, error } = await supabase
      .from('whatsapp_devices')
      .update({
        is_warmup_active: false,
        status: 'connected',
        updated_at: new Date().toISOString(),
      })
      .eq('id', deviceId)
      .select()
      .single()

    if (error) throw error
    return data
  },
}
