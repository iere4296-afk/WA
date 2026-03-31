'use client'

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import api from '@/lib/api'
import { Organization, User } from '@/types'

export interface AuthSession {
  user: User
  org: Organization | null
  orgs?: Organization[]
}

interface AuthContextType {
  user: User | null
  session: AuthSession | null
  org: Organization | null
  loading: boolean
  isLoading: boolean
  isAuthenticated: boolean
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  checkAuth: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

function normalizeOrg(org: any): Organization | null {
  if (!org) return null

  return {
    ...org,
    timezone: org.timezone ?? 'UTC',
    monthly_message_limit: org.monthly_message_limit ?? org.monthlyMessageLimit ?? 0,
    messages_sent_this_month: org.messages_sent_this_month ?? org.messagesSentThisMonth ?? 0,
  }
}

function buildSession(payload: any): AuthSession | null {
  if (!payload?.user) return null

  const normalizedOrgs = Array.isArray(payload.orgs)
    ? payload.orgs.map((org: any) => normalizeOrg(org)).filter(Boolean)
    : undefined
  const currentOrg = normalizeOrg(payload.org ?? normalizedOrgs?.[0] ?? null)

  return {
    user: payload.user,
    org: currentOrg,
    orgs: normalizedOrgs as Organization[] | undefined,
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter()
  const [session, setSession] = useState<AuthSession | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [org, setOrg] = useState<Organization | null>(null)
  const [loading, setLoading] = useState(true)

  function syncSession(nextSession: AuthSession | null) {
    setSession(nextSession)
    setUser(nextSession?.user ?? null)
    setOrg(nextSession?.org ?? null)
  }

  async function checkAuth() {
    setLoading(true)

    try {
      const { data } = await api.get('/auth/session', { skipAuthRedirect: true } as any)
      const payload = data.data ?? data
      syncSession(buildSession(payload))
    } catch {
      syncSession(null)
    } finally {
      setLoading(false)
    }
  }

  async function signIn(email: string, password: string) {
    const { data } = await api.post(
      '/auth/login',
      { email, password },
      { skipAuthRedirect: true } as any,
    )

    const payload = data.data ?? data
    syncSession(buildSession(payload))
  }

  async function signOut() {
    try {
      await api.post('/auth/logout', undefined, { skipAuthRedirect: true } as any)
    } finally {
      syncSession(null)
      router.replace('/login')
    }
  }

  useEffect(() => {
    void checkAuth()
  }, [])

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        org,
        loading,
        isLoading: loading,
        isAuthenticated: !!session,
        signIn,
        signOut,
        login: signIn,
        logout: signOut,
        checkAuth,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)

  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }

  return context
}
