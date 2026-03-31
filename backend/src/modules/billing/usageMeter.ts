import { supabase } from '../../lib/supabase.js'

export async function incrementUsage(orgId: string, field: 'messages_sent' | 'ai_calls') {
  return supabase.rpc('increment_billing_usage', { org_id: orgId, field })
}

export async function getCurrentUsage(orgId: string) {
  const periodStart = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1)).toISOString()
  const { data, error } = await supabase
    .from('billing_usage')
    .select('*')
    .eq('org_id', orgId)
    .eq('period_start', periodStart)
    .single()

  if (error && error.code !== 'PGRST116') throw error
  return data
}
