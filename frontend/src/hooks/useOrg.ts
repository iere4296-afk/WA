import { useOrgContext } from '@/contexts/OrgContext'

export function useOrg() {
  const { org, plan, usage, limits, isOverLimit } = useOrgContext()

  return {
    org,
    orgId: org?.id || null,
    plan,
    usage,
    limits,
    isOverLimit,
  }
}
