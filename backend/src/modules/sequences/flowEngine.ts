import { supabase } from '../../lib/supabase.js'

export const flowEngine = {
  async enrollContacts(flowId: string, orgId: string, contactIds: string[]) {
    const rows = contactIds.map((contactId) => ({
      flow_id: flowId,
      org_id: orgId,
      contact_id: contactId,
      next_step_at: new Date().toISOString(),
    }))

    const { error } = await supabase.from('flow_enrollments').upsert(rows, {
      onConflict: 'flow_id,contact_id',
    })

    if (error) throw error

    await supabase.rpc('increment_flow_enrolled', {
      flow_id: flowId,
      count: contactIds.length,
    })

    return rows.length
  },

  async executeDueSteps(limit = 20) {
    const { data } = await supabase
      .from('flow_enrollments')
      .select('id')
      .eq('status', 'active')
      .lte('next_step_at', new Date().toISOString())
      .limit(limit)

    return data?.length ?? 0
  },
}
