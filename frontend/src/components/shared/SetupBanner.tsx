'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'

export function SetupBanner() {
  const [dismissed, setDismissed] = useState(false)

  const { data: services, isLoading } = useQuery({
    queryKey: ['setup-status'],
    queryFn: async () => {
      const response = await api.get('/setup/status')
      return response.data.data ?? null
    },
    staleTime: 30_000,
  })

  useEffect(() => {
    if (typeof window === 'undefined') return
    setDismissed(window.sessionStorage.getItem('wa.setupBanner.dismissed') === '1')
  }, [])

  if (isLoading || dismissed || !services) return null

  const missingServices = [
    !services.redis ? 'Redis queue' : null,
    !services.ai ? 'AI providers' : null,
  ].filter(Boolean)

  if (missingServices.length === 0) return null

  function dismiss() {
    if (typeof window !== 'undefined') {
      window.sessionStorage.setItem('wa.setupBanner.dismissed', '1')
    }

    setDismissed(true)
  }

  return (
    <div className="flex items-center justify-between gap-3 border-t border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 sm:px-6">
      <div className="flex min-w-0 items-center gap-2">
        <AlertTriangle className="h-4 w-4 flex-shrink-0" />
        <p className="min-w-0">
          <span className="font-semibold">Service warning:</span>{' '}
          {missingServices.join(' and ')} {missingServices.length === 1 ? 'is' : 'are'} unavailable. Some automation features may be limited.
        </p>
      </div>

      <button
        className="shrink-0 rounded-md px-2 py-1 font-medium text-amber-800 transition hover:bg-amber-100"
        onClick={dismiss}
      >
        Dismiss
      </button>
    </div>
  )
}
