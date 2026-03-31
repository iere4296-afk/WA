import { Skeleton } from '@/components/ui/skeleton'

interface SkeletonPageProps {
  rows?: number
  showHeader?: boolean
}

export function SkeletonPage({ rows = 3, showHeader = true }: SkeletonPageProps) {
  return (
    <div className="space-y-6">
      {showHeader ? (
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-64" />
          </div>
          <Skeleton className="h-10 w-32" />
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-28 rounded-xl" />
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_0.6fr]">
        <Skeleton className="h-72 rounded-2xl" />
        <Skeleton className="h-72 rounded-2xl" />
      </div>

      {Array.from({ length: rows }).map((_, index) => (
        <Skeleton key={index} className="h-20 rounded-2xl" />
      ))}
    </div>
  )
}
