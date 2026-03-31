'use client'

import { Suspense, useEffect, type ReactNode } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { AppShell } from '@/components/layout/AppShell'
import { SkeletonPage } from '@/components/shared/SkeletonPage'
import { OrgProvider } from '@/contexts/OrgContext'
import { useAuth } from '@/contexts/AuthContext'
import { QueryProvider } from '@/providers/QueryProvider'

function AuthGuard({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth()
  const pathname = usePathname()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !session) {
      router.replace(`/login?redirect=${encodeURIComponent(pathname)}`)
    }
  }, [loading, pathname, router, session])

  if (loading || !session) {
    return <SkeletonPage showHeader={false} />
  }

  return <>{children}</>
}

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <QueryProvider>
      <AuthGuard>
        <OrgProvider>
          <AppShell>
            <Suspense fallback={<SkeletonPage rows={5} />}>
              {children}
            </Suspense>
          </AppShell>
        </OrgProvider>
      </AuthGuard>
    </QueryProvider>
  )
}
