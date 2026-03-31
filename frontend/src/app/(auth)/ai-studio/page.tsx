'use client'

import { useState } from 'react'
import { Check, Loader2, Sparkles, Wand2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useCreateTemplate } from '@/hooks/useTemplates'
import { api } from '@/lib/api'
import type {
  AIGateDetail,
  AIStudioGenerateResponse,
  AIVariantResult,
} from '@/types/api.types'
import { toast } from 'sonner'

type ToneOption = 'professional' | 'casual' | 'urgent' | 'friendly'

interface GeneratedVariant extends AIVariantResult {
  id: string
  saved: boolean
}

const gateConfig: Array<{ key: string; label: string; gateNum: number }> = [
  { key: 'gate1', label: 'Spam Patterns', gateNum: 1 },
  { key: 'gate2', label: 'Emoji Density', gateNum: 2 },
  { key: 'gate3', label: 'Opening Pattern', gateNum: 3 },
  { key: 'gate4', label: 'Length Match', gateNum: 4 },
  { key: 'gate5', label: 'Similarity Check', gateNum: 5 },
]

function findGateDetail(details: AIGateDetail[] | undefined, gateNum: number) {
  return details?.find((detail) => detail.gate === gateNum)
}

function toneLabel(value: ToneOption) {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

export default function AIStudioPage() {
  const createTemplate = useCreateTemplate()
  const [product, setProduct] = useState('')
  const [audience, setAudience] = useState('')
  const [tone, setTone] = useState<ToneOption>('professional')
  const [results, setResults] = useState<GeneratedVariant[]>([])
  const [isGenerating, setIsGenerating] = useState(false)
  const [generateCount, setGenerateCount] = useState(0)

  async function handleGenerate(total: number) {
    if (!product.trim() || !audience.trim()) {
      toast.error('Product and audience are both required before generating content')
      return
    }

    setIsGenerating(true)
    setGenerateCount(total)

    try {
      const response = await api.post<AIStudioGenerateResponse>('/ai-studio/generate', {
        product: product.trim(),
        audience: audience.trim(),
        tone: toneLabel(tone),
        count: total,
        language: 'English',
      })

      const payload = response.data.data
      setResults(
        payload.variants.map((variant, index) => ({
          ...variant,
          id: `${Date.now()}-${index}`,
          saved: false,
        })),
      )

      toast.success(total === 1 ? 'AI message generated' : `${total} AI variations generated`)
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Unable to generate AI content right now')
    } finally {
      setIsGenerating(false)
      setGenerateCount(0)
    }
  }

  async function handleSave(variant: GeneratedVariant) {
    try {
      await createTemplate.mutateAsync({
        name: `AI Generated - ${new Date().toLocaleDateString()}`,
        body: variant.content,
        category: 'marketing',
        status: 'draft',
        is_ai_generated: true,
        language: 'EN',
        type: 'text',
        tags: [tone, audience.trim()].filter(Boolean),
      })

      setResults((current) => current.map((item) => (item.id === variant.id ? { ...item, saved: true } : item)))
      toast.success('Saved to templates!')
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Unable to save this message as a template')
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-slate-950">AI Studio</h2>
        <p className="mt-1 text-sm text-slate-500">
          Generate one or five WhatsApp-ready message drafts, inspect every gate result, then save the winners to templates.
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.95fr,1.05fr]">
        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wand2 className="h-5 w-5 text-emerald-600" />
              Content Context
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="product">Product</Label>
              <Textarea
                id="product"
                value={product}
                onChange={(event) => setProduct(event.target.value)}
                placeholder="Describe the product, offer, or service you want to promote."
                className="min-h-28"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="audience">Audience</Label>
              <Input
                id="audience"
                value={audience}
                onChange={(event) => setAudience(event.target.value)}
                placeholder="Example: existing customers in Dubai interested in weekend promotions"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="tone">Tone</Label>
              <select
                id="tone"
                value={tone}
                onChange={(event) => setTone(event.target.value as ToneOption)}
                className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700"
              >
                <option value="professional">Professional</option>
                <option value="casual">Casual</option>
                <option value="urgent">Urgent</option>
                <option value="friendly">Friendly</option>
              </select>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Button
                onClick={() => void handleGenerate(1)}
                disabled={isGenerating}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                {isGenerating && generateCount === 1 ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                Generate Single
              </Button>
              <Button
                variant="outline"
                onClick={() => void handleGenerate(5)}
                disabled={isGenerating}
              >
                {isGenerating && generateCount === 5 ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                Generate 5 Variations
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle>Results</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {results.length > 0 ? (
                results.map((variant, index) => (
                  <div key={variant.id} className="rounded-2xl border border-slate-200 p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <p className="font-medium text-slate-950">Variation {index + 1}</p>
                        <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">{variant.content}</p>
                      </div>

                      <Button
                        size="sm"
                        variant={variant.saved ? 'secondary' : 'outline'}
                        onClick={() => void handleSave(variant)}
                        disabled={variant.saved || createTemplate.isPending}
                      >
                        {variant.saved ? 'Saved' : 'Save to templates'}
                      </Button>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      {gateConfig.map((gate) => {
                        const detail = findGateDetail(variant.gateDetails, gate.gateNum)
                        const passed = detail?.passed ?? true

                        return (
                          <span
                            key={`${variant.id}:${gate.key}`}
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs ${
                              passed ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                            }`}
                          >
                            {passed ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                            {gate.label}
                          </span>
                        )
                      })}
                    </div>

                    {variant.gatesFailed.length > 0 ? (
                      <div className="mt-2 rounded bg-red-50 p-2 text-xs text-red-700">
                        {variant.gatesFailed.map((reason, reasonIndex) => (
                          <p key={`${variant.id}:failed:${reasonIndex}`}>{reason}</p>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-10 text-center text-sm text-slate-500">
                  Generate a message to populate the results panel with live AI output and gate checks.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
