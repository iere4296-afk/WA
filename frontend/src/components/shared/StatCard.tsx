import { ReactNode } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

interface StatCardProps {
  title: string
  value: string | number
  change?: number
  loading?: boolean
  subtitle?: string
  icon?: ReactNode
  iconClassName?: string
  trend?: {
    value: number
    label: string
  }
}

export function StatCard({
  title,
  value,
  change,
  loading = false,
  subtitle,
  icon,
  iconClassName,
  trend,
}: StatCardProps) {
  const delta = change ?? trend?.value
  const trendLabel = trend?.label

  if (loading) {
    return (
      <Card>
        <CardContent className="space-y-4 p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-3">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-8 w-24" />
              <Skeleton className="h-3 w-36" />
            </div>
            <Skeleton className="h-11 w-11 rounded-2xl" />
          </div>
          <Skeleton className="h-3 w-24" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-slate-200 shadow-sm">
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="mt-2 text-3xl font-bold">{value}</p>
            {subtitle ? <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p> : null}
            {typeof delta === 'number' ? (
              <div className="mt-2 flex items-center gap-1">
                <span
                  className={cn(
                    'text-xs font-medium',
                    delta >= 0 ? 'text-green-600' : 'text-red-600',
                  )}
                >
                  {delta >= 0 ? '+' : ''}
                  {delta}%
                </span>
                {trendLabel ? <span className="text-xs text-muted-foreground">{trendLabel}</span> : null}
              </div>
            ) : null}
          </div>
          {icon ? (
            <div
              className={cn(
                'flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600',
                iconClassName,
              )}
            >
              {icon}
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  )
}
