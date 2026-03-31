import { Progress } from '@/components/ui/progress'

interface CampaignProgressBarProps {
  sent: number
  delivered?: number
  read?: number
  failed?: number
  total: number
}

export function CampaignProgressBar({
  sent,
  delivered = 0,
  read = 0,
  failed = 0,
  total,
}: CampaignProgressBarProps) {
  const progress = total > 0 ? Math.min(100, Math.round((sent / total) * 100)) : 0

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm text-slate-600">
        <span>{sent.toLocaleString()} sent</span>
        <span>{progress}%</span>
      </div>
      <Progress value={progress} className="h-2.5 bg-slate-200" />
      <div className="flex flex-wrap gap-3 text-xs text-slate-500">
        <span>{delivered.toLocaleString()} delivered</span>
        <span>{read.toLocaleString()} read</span>
        <span>{failed.toLocaleString()} failed</span>
        <span>{total.toLocaleString()} total</span>
      </div>
    </div>
  )
}
