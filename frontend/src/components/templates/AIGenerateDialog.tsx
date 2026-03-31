'use client'

import { useEffect, useState } from 'react'
import { CheckCircle2, Loader2, Sparkles, XCircle } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { Textarea } from '@/components/ui/textarea'
import { useAIGenerateTemplate, useCreateTemplate } from '@/hooks/useTemplates'
import { TemplatePreview } from './TemplatePreview'

interface AIGenerateDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved?: () => void
}

export function AIGenerateDialog({ open, onOpenChange, onSaved }: AIGenerateDialogProps) {
  const aiGenerate = useAIGenerateTemplate()
  const createTemplate = useCreateTemplate()
  const [description, setDescription] = useState('')
  const [audience, setAudience] = useState('')
  const [tone, setTone] = useState('professional')
  const [progress, setProgress] = useState(0)
  const [result, setResult] = useState<Awaited<ReturnType<typeof aiGenerate.mutateAsync>> | null>(null)

  useEffect(() => {
    if (!open) {
      setDescription('')
      setAudience('')
      setTone('professional')
      setProgress(0)
      setResult(null)
    }
  }, [open])

  useEffect(() => {
    if (!aiGenerate.isPending) return undefined

    setProgress(10)
    const interval = window.setInterval(() => {
      setProgress((current) => Math.min(90, current + 12))
    }, 180)

    return () => window.clearInterval(interval)
  }, [aiGenerate.isPending])

  async function handleGenerate() {
    if (!description.trim() || !audience.trim()) {
      toast.error('Add a product description and target audience first.')
      return
    }

    try {
      const generated = await aiGenerate.mutateAsync({
        description: `${description.trim()}\nTarget audience: ${audience.trim()}`,
        category: 'marketing',
        tone,
      })
      setResult(generated)
      setProgress(100)
      toast.success('Template generated.')
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Unable to generate template.')
      setProgress(0)
    }
  }

  async function handleSave() {
    if (!result) return

    try {
      await createTemplate.mutateAsync({
        name: result.name,
        body: result.body,
        category: 'marketing',
        language: 'EN',
        type: 'text',
        tags: [tone, audience.trim()].filter(Boolean),
        status: 'draft',
        is_ai_generated: true,
      })
      toast.success('AI template saved.')
      onSaved?.()
      onOpenChange(false)
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Unable to save generated template.')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>AI Generate Template</DialogTitle>
          <DialogDescription>
            Describe the product, audience, and tone, then review gate results before saving.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
          <div className="space-y-4">
            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-700">Product description</span>
              <Textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="What are you selling or announcing?"
                className="min-h-28"
              />
            </label>

            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-700">Target audience</span>
              <Input
                value={audience}
                onChange={(event) => setAudience(event.target.value)}
                placeholder="Who should receive this message?"
              />
            </label>

            <label className="space-y-2">
              <span className="text-sm font-medium text-slate-700">Tone</span>
              <select
                className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"
                value={tone}
                onChange={(event) => setTone(event.target.value)}
              >
                <option value="professional">Professional</option>
                <option value="casual">Casual</option>
                <option value="urgent">Urgent</option>
                <option value="friendly">Friendly</option>
              </select>
            </label>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm text-slate-600">
                <span>Generation progress</span>
                <span>{progress}%</span>
              </div>
              <Progress value={progress} className="h-3 bg-slate-200" />
            </div>

            <Button
              className="w-full bg-emerald-600 text-white hover:bg-emerald-700"
              onClick={() => void handleGenerate()}
              disabled={aiGenerate.isPending}
            >
              {aiGenerate.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Generate
                </>
              )}
            </Button>
          </div>

          <div className="space-y-4">
            {result ? (
              <>
                <TemplatePreview
                  template={{
                    name: result.name,
                    body: result.body,
                    variables: result.variables,
                  }}
                />

                <div className="rounded-3xl border border-slate-200 bg-white p-4">
                  <h3 className="font-medium text-slate-950">Gate Status</h3>
                  <div className="mt-3 space-y-2">
                    {result.gates.map((gate) => (
                      <div key={gate.name} className="flex items-start justify-between gap-3 rounded-2xl bg-slate-50 px-3 py-2">
                        <div>
                          <p className="text-sm font-medium text-slate-900">{gate.name}</p>
                          <p className="text-xs text-slate-500">{gate.reason || 'Passed'}</p>
                        </div>
                        {gate.passed ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                        ) : (
                          <XCircle className="h-4 w-4 text-rose-600" />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <div className="flex h-full min-h-64 items-center justify-center rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-500">
                Generated output and gate results will appear here.
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button
            className="bg-emerald-600 text-white hover:bg-emerald-700"
            onClick={() => void handleSave()}
            disabled={!result || createTemplate.isPending}
          >
            Save Template
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
