'use client'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { MessageTemplate } from '@/types'
import { truncate } from '@/lib/utils'

interface TemplateCardProps {
  template: MessageTemplate
  onClick?: (template: MessageTemplate) => void
}

export function TemplateCard({ template, onClick }: TemplateCardProps) {
  return (
    <button className="w-full text-left" onClick={() => onClick?.(template)}>
      <Card className="h-full border-slate-200 shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-200">
        <CardContent className="space-y-4 p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate font-medium text-slate-950">{template.name}</p>
              <p className="mt-1 text-sm text-slate-500">{truncate(template.body, 84)}</p>
            </div>
            <Badge variant="outline" className="capitalize">
              {template.type}
            </Badge>
          </div>

          <div className="flex flex-wrap gap-2">
            {(template.tags || []).slice(0, 3).map((tag) => (
              <Badge key={tag} variant="secondary" className="rounded-full">
                {tag}
              </Badge>
            ))}
            {template.tags?.length > 3 ? (
              <Badge variant="secondary" className="rounded-full">
                +{template.tags.length - 3}
              </Badge>
            ) : null}
          </div>

          <div className="flex items-center justify-between text-xs text-slate-500">
            <span className="capitalize">{template.category}</span>
            <span>{template.use_count} uses</span>
          </div>
        </CardContent>
      </Card>
    </button>
  )
}
