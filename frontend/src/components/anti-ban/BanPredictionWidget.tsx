import { AlertTriangle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'

interface BanPredictionWidgetProps {
  probability: number
  riskLevel: 'low' | 'medium' | 'high'
  topFactors?: string[]
  recommendation?: string
}

function getRiskTone(riskLevel: 'low' | 'medium' | 'high') {
  if (riskLevel === 'high') {
    return {
      badge: 'bg-rose-50 text-rose-700 ring-1 ring-rose-200',
      progress: '[&>*]:bg-rose-500',
    }
  }

  if (riskLevel === 'medium') {
    return {
      badge: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
      progress: '[&>*]:bg-amber-500',
    }
  }

  return {
    badge: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
    progress: '[&>*]:bg-emerald-500',
  }
}

export function BanPredictionWidget({
  probability,
  riskLevel,
  topFactors = [],
  recommendation,
}: BanPredictionWidgetProps) {
  const percentage = Math.max(0, Math.min(100, Math.round(probability * 100)))
  const tone = getRiskTone(riskLevel)

  return (
    <Card className="border-slate-200 shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-amber-500" />
          Ban Prediction
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-3xl font-semibold text-slate-950">{percentage}%</p>
            <p className="text-sm text-slate-500">Probability based on current device health and event history.</p>
          </div>
          <Badge className={cn('capitalize', tone.badge)}>{riskLevel} risk</Badge>
        </div>

        <Progress value={percentage} className={cn('h-3 bg-slate-200', tone.progress)} />

        {topFactors.length > 0 ? (
          <div className="space-y-2">
            <p className="text-sm font-medium text-slate-700">Top risk factors</p>
            <ul className="space-y-2 text-sm text-slate-600">
              {topFactors.map((factor) => (
                <li key={factor} className="rounded-xl bg-slate-50 px-3 py-2">
                  {factor}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="rounded-xl bg-slate-50 px-3 py-3 text-sm text-slate-600">
          {recommendation || 'Maintain warmup discipline, balanced send velocity, and immediate handling of risk events.'}
        </div>
      </CardContent>
    </Card>
  )
}
