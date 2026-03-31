import { supabase } from './supabase.js'

interface AuditEvent {
  orgId: string
  userId?: string
  action: string
  resourceType?: string
  resourceId?: string
  beforeState?: unknown
  afterState?: unknown
  ipAddress?: string
  userAgent?: string
}

export async function writeAuditLog(event: AuditEvent): Promise<void> {
  try {
    await supabase.from('audit_logs').insert({
      org_id: event.orgId,
      user_id: event.userId || null,
      action: event.action,
      resource_type: event.resourceType,
      resource_id: event.resourceId,
      before_state: event.beforeState as any,
      after_state: event.afterState as any,
      ip_address: event.ipAddress,
      user_agent: event.userAgent,
    })
  } catch (err) {
    // Audit failures must not crash the main flow
    console.error('Audit log write failed:', err)
  }
}
