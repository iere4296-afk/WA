'use client'

import { Bot, Clock3 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { AutoReplyRule } from '@/types'
import { truncate } from '@/lib/utils'

interface AutoReplyRuleCardProps {
  rule: AutoReplyRule
  onToggle?: (enabled: boolean) => void
  onDelete?: () => void
}

export function AutoReplyRuleCard({ rule, onToggle, onDelete }: AutoReplyRuleCardProps) {
  return (
    <Card className="border-slate-200 shadow-sm">
      <CardContent className="flex items-start justify-between gap-4 p-5">
        <div className="min-w-0 space-y-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-100">
              <Bot className="h-5 w-5 text-emerald-700" />
            </div>
            <div>
              <p className="font-medium text-slate-950">{rule.name}</p>
              <div className="mt-1 flex flex-wrap gap-2">
                <Badge variant="secondary">{rule.trigger_type.replace('_', ' ')}</Badge>
                <Badge variant="outline">{rule.match_type.replace('_', ' ')}</Badge>
              </div>
            </div>
          </div>

          {rule.keywords.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {rule.keywords.map((keyword) => (
                <Badge key={keyword} variant="secondary" className="rounded-full">
                  {keyword}
                </Badge>
              ))}
            </div>
          ) : null}

          <p className="text-sm text-slate-500">
            {truncate(rule.response_message || 'Template or AI-powered reply configured.', 120)}
          </p>

          <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500">
            <span className="inline-flex items-center gap-1">
              <Clock3 className="h-3.5 w-3.5" />
              {rule.cooldown_minutes} min cooldown
            </span>
            <span>{rule.trigger_count} triggers</span>
          </div>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-3">
          <Switch checked={rule.is_active} onCheckedChange={onToggle} />
          {onDelete ? (
            <Button variant="ghost" size="sm" onClick={onDelete} className="text-rose-600 hover:text-rose-700">
              Delete
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  )
}
