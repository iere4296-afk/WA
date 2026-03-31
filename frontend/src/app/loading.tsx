import { SkeletonPage } from '@/components/shared/SkeletonPage'

export default function RootLoading() {
  return (
    <div className="px-4 py-6">
      <SkeletonPage showHeader={false} rows={4} />
    </div>
  )
}
