import { MessageTemplate } from '@/types'
import { TemplateCard } from './TemplateCard'

interface TemplateGridProps {
  templates: MessageTemplate[]
}

export function TemplateGrid({ templates }: TemplateGridProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {templates.map((template) => (
        <TemplateCard key={template.id} template={template} />
      ))}
    </div>
  )
}
