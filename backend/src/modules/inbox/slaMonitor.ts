import cron from 'node-cron'
import { supabase } from '../../lib/supabase.js'

let task: cron.ScheduledTask | null = null

async function checkSlaBreaches(): Promise<number> {
  const { data } = await supabase
    .from('conversations')
    .select('id')
    .eq('status', 'open')
    .lt('sla_deadline', new Date().toISOString())

  return data?.length ?? 0
}

export const slaMonitor = {
  start() {
    if (task) return
    task = cron.schedule('*/5 * * * *', () => {
      void checkSlaBreaches()
    })
  },

  stop() {
    task?.stop()
    task = null
  },

  checkSlaBreaches,
}
