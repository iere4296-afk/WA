import cron from 'node-cron'
import { supabase } from '../../lib/supabase.js'
import { computeHealthScore } from '../fleet/healthScorer.js'

let task: cron.ScheduledTask | null = null

async function rescoreAllDevices(): Promise<number> {
  const { data: devices } = await supabase.from('whatsapp_devices').select('id')
  const ids = devices?.map((device) => device.id) ?? []
  await Promise.all(ids.map((id) => computeHealthScore(id)))
  return ids.length
}

export const healthMonitor = {
  start() {
    if (task) return
    task = cron.schedule('*/30 * * * *', () => {
      void rescoreAllDevices()
    })
  },

  stop() {
    task?.stop()
    task = null
  },

  rescoreAllDevices,
}
