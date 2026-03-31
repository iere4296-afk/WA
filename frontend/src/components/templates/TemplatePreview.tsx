'use client'

import { Copy } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import type { MessageTemplate } from '@/types'

interface TemplatePreviewProps {
  template: Pick<MessageTemplate, 'body' | 'name' | 'variables'> & Partial<MessageTemplate>
}

function highlightVariables(body: string) {
  return body.split(/(\{\{\w+\}\})/g).filter(Boolean).map((part, index) => {
    if (/^\{\{\w+\}\}$/.test(part)) {
      return (
        <span
          key={`${part}-${index}`}
          className="rounded-md bg-emerald-100 px-1.5 py-0.5 font-medium text-emerald-700"
        >
          {part}
        </span>
      )
    }

    return <span key={`${part}-${index}`}>{part}</span>
  })
}

export function TemplatePreview({ template }: TemplatePreviewProps) {
  async function handleCopy() {
    await navigator.clipboard.writeText(template.body)
    toast.success('Template copied to clipboard.')
  }

  return (
    <div className="space-y-4">
      <div className="mx-auto w-full max-w-[320px] rounded-[2.5rem] border border-slate-300 bg-slate-900 p-3 shadow-xl">
        <div className="rounded-[2rem] bg-[#e5ddd5] p-4">
          <div className="mb-4 flex items-center justify-between text-xs text-slate-500">
            <span>{template.name || 'Template Preview'}</span>
            <span>WhatsApp Mockup</span>
          </div>
          <div className="ml-auto max-w-[85%] rounded-2xl rounded-br-md bg-[#dcf8c6] px-4 py-3 text-sm leading-6 text-slate-900 shadow-sm">
            {highlightVariables(template.body)}
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <Button variant="outline" onClick={() => void handleCopy()}>
          <Copy className="h-4 w-4" />
          Copy
        </Button>
      </div>
    </div>
  )
}
