'use client'

import { Workflow } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Flow } from '@/types'

interface FlowCardProps {
  flow: Flow & { flow_steps?: Array<{ count?: number }> }
  onClick?: (flowId: string) => void
}

export function FlowCard({ flow, onClick }: FlowCardProps) {
  const stepCount = flow.flow_steps?.[0]?.count || 0
  const completionRate = flow.enrolled_count > 0
    ? Math.round((flow.completed_count / flow.enrolled_count) * 100)
    : 0

  return (
    <button className="w-full text-left" onClick={() => onClick?.(flow.id)}>
      <Card className="h-full border-slate-200 shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-200">
        <CardContent className="space-y-4 p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-100">
                <Workflow className="h-5 w-5 text-emerald-700" />
              </div>
              <div>
                <p className="font-medium text-slate-950">{flow.name}</p>
                <p className="text-sm text-slate-500">{flow.description || 'No description'}</p>
              </div>
            </div>
            <Badge variant="secondary" className="capitalize">
              {flow.status}
            </Badge>
          </div>

          <div className="flex items-center justify-between text-sm text-slate-500">
            <span>{stepCount} steps</span>
            <span>{flow.trigger_type.replace('_', ' ')}</span>
          </div>

          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>{flow.enrolled_count} enrolled</span>
            <span>{completionRate}% complete</span>
          </div>
        </CardContent>
      </Card>
    </button>
  )
}
