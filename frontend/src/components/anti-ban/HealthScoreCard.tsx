import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface HealthScoreCardProps {
  score: number
  rulesPassed?: number
  rulesTotal?: number
}

function getScoreTone(score: number) {
  if (score >= 80) return { ring: '#22c55e', accent: 'text-emerald-600', label: 'Healthy' }
  if (score >= 60) return { ring: '#f59e0b', accent: 'text-amber-600', label: 'Watch closely' }
  return { ring: '#ef4444', accent: 'text-rose-600', label: 'At risk' }
}

export function HealthScoreCard({ score, rulesPassed, rulesTotal }: HealthScoreCardProps) {
  const safeScore = Math.max(0, Math.min(100, Math.round(score)))
  const tone = getScoreTone(safeScore)

  return (
    <Card className="border-slate-200 shadow-sm">
      <CardHeader>
        <CardTitle>Health Score</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex justify-center">
          <div
            className="relative flex h-48 w-48 items-center justify-center rounded-full"
            style={{
              background: `conic-gradient(${tone.ring} ${safeScore * 3.6}deg, #e2e8f0 0deg)`,
            }}
          >
            <div className="flex h-36 w-36 flex-col items-center justify-center rounded-full bg-white shadow-inner">
              <span className="text-5xl font-semibold text-slate-950">{safeScore}</span>
              <span className="text-sm text-slate-500">out of 100</span>
            </div>
          </div>
        </div>

        <div className="space-y-2 text-center">
          <p className={cn('text-sm font-medium', tone.accent)}>{tone.label}</p>
          {typeof rulesPassed === 'number' && typeof rulesTotal === 'number' ? (
            <p className="text-sm text-slate-500">
              {rulesPassed} / {rulesTotal} anti-ban rules are currently passing
            </p>
          ) : null}
        </div>
      </CardContent>
    </Card>
  )
}
