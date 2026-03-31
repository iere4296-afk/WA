'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'

export default function AuthError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 rounded-lg border border-dashed bg-white p-8 text-center">
      <div className="space-y-2">
        <h2 className="text-xl font-semibold">Page failed to load</h2>
        <p className="text-sm text-muted-foreground">
          Try reloading this section or come back in a moment.
        </p>
      </div>
      <Button onClick={reset}>Retry</Button>
    </div>
  )
}
