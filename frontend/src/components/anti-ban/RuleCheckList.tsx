import { CheckCircle2, XCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

interface RuleCheckListProps {
  rules: Array<{ name: string; passed: boolean; detail?: string; category?: string }>
}

export function RuleCheckList({ rules }: RuleCheckListProps) {
  const groups = rules.reduce<Record<string, Array<{ name: string; passed: boolean; detail?: string }>>>((acc, rule) => {
    const category = rule.category || 'Rules'
    if (!acc[category]) acc[category] = []
    acc[category].push({
      name: rule.name,
      passed: rule.passed,
      detail: rule.detail,
    })
    return acc
  }, {})

  return (
    <div className="space-y-4">
      {Object.entries(groups).map(([category, categoryRules]) => {
        const passedCount = categoryRules.filter((rule) => rule.passed).length

        return (
          <div key={category} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between gap-4">
              <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">{category}</h3>
              <span className="text-xs text-slate-500">
                {passedCount}/{categoryRules.length} passing
              </span>
            </div>

            <div className="space-y-3">
              {categoryRules.map((rule) => (
                <div key={`${category}:${rule.name}`} className="flex items-start justify-between gap-4 rounded-xl bg-slate-50 px-3 py-3 text-sm">
                  <div className="space-y-1">
                    <p className="font-medium text-slate-900">{rule.name}</p>
                    {rule.detail ? <p className="text-slate-500">{rule.detail}</p> : null}
                  </div>

                  <div
                    className={cn(
                      'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium',
                      rule.passed
                        ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200'
                        : 'bg-rose-50 text-rose-700 ring-1 ring-rose-200',
                    )}
                  >
                    {rule.passed ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
                    {rule.passed ? 'Pass' : 'Fail'}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
