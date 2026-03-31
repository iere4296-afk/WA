'use client'

import { Button } from '@/components/ui/button'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html>
      <body>
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
          <div className="space-y-2">
            <h2 className="text-2xl font-semibold">Application error</h2>
            <p className="text-sm text-muted-foreground">
              {error.message || 'An unexpected error occurred.'}
            </p>
          </div>
          <Button onClick={reset}>Reload</Button>
        </div>
      </body>
    </html>
  )
}
