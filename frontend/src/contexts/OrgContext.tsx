'use client'

import { createContext, useContext, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import { Organization } from '@/types'
import { useAuth } from './AuthContext'

export interface OrgUsage {
  messages_sent: number
  ai_calls: number
  contacts_stored: number
  media_uploaded_mb: number
}

export interface OrgLimits {
  monthlyMessages: number
  aiCalls: number
  contacts: number
}

interface OrgContextType {
  org: Organization | null
  plan: string
  usage: OrgUsage
  limits: OrgLimits
  loading: boolean
  refetch: () => Promise<void>
  isOverLimit: (type: 'messages' | 'ai' | 'contacts') => boolean
}

const EMPTY_USAGE: OrgUsage = {
  messages_sent: 0,
  ai_calls: 0,
  contacts_stored: 0,
  media_uploaded_mb: 0,
}

const EMPTY_LIMITS: OrgLimits = {
  monthlyMessages: 0,
  aiCalls: 0,
  contacts: 0,
}

const OrgContext = createContext<OrgContextType | undefined>(undefined)

function normalizeOrg(org: any): Organization | null {
  if (!org) return null

  return {
    ...org,
    timezone: org.timezone ?? 'UTC',
    monthly_message_limit: org.monthly_message_limit ?? org.monthlyMessageLimit ?? 0,
    messages_sent_this_month: org.messages_sent_this_month ?? org.messagesSentThisMonth ?? 0,
  }
}

export function OrgProvider({ children }: { children: ReactNode }) {
  const { session, org: authOrg, loading: authLoading } = useAuth()

  const orgQuery = useQuery({
    queryKey: ['org', session?.org?.id],
    queryFn: async () => {
      const response = await api.get('/settings/org')
      return normalizeOrg(response.data.data ?? response.data)
    },
    enabled: !!session,
    staleTime: 30_000,
  })

  const org = orgQuery.data ?? authOrg ?? null
  const plan = org?.plan ?? 'free'
  const usage: OrgUsage = {
    ...EMPTY_USAGE,
    messages_sent: org?.messages_sent_this_month ?? EMPTY_USAGE.messages_sent,
  }
  const limits: OrgLimits = {
    monthlyMessages: org?.monthly_message_limit ?? EMPTY_LIMITS.monthlyMessages,
    aiCalls: EMPTY_LIMITS.aiCalls,
    contacts: EMPTY_LIMITS.contacts,
  }
  const loading = authLoading || orgQuery.isLoading

  async function refetch() {
    await orgQuery.refetch()
  }

  function isOverLimit(type: 'messages' | 'ai' | 'contacts') {
    if (type === 'messages') return usage.messages_sent >= limits.monthlyMessages && limits.monthlyMessages > 0
    if (type === 'ai') return usage.ai_calls >= limits.aiCalls && limits.aiCalls > 0
    return usage.contacts_stored >= limits.contacts && limits.contacts > 0
  }

  return (
    <OrgContext.Provider value={{ org, plan, usage, limits, loading, refetch, isOverLimit }}>
      {children}
    </OrgContext.Provider>
  )
}

export function useOrgContext() {
  const context = useContext(OrgContext)

  if (!context) {
    throw new Error('useOrgContext must be used within an OrgProvider')
  }

  return context
}
