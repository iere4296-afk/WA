import OpenAI from 'openai'
import { config } from '../../lib/config.js'
import { logger } from '../../lib/logger.js'

export interface OpenAIVariantParams {
  product: string
  audience: string
  tone: string
  count: number
  language?: string
}

export interface OpenAIVariantResult {
  variants: string[]
  model: string
  tokensUsed: number
}

let openaiInstance: OpenAI | null = null

function getOpenAIClient(): OpenAI {
  if (!openaiInstance) {
    if (!config.openai.apiKey) {
      throw new Error('OPENAI_API_KEY is not configured')
    }

    openaiInstance = new OpenAI({ apiKey: config.openai.apiKey })
  }

  return openaiInstance
}

function stripCodeFences(value: string): string {
  return value
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim()
}

export async function openaiGenerateVariants(params: OpenAIVariantParams): Promise<OpenAIVariantResult> {
  const { product, audience, tone, count, language = 'English' } = params
  const client = getOpenAIClient()
  const model = config.openai.model || 'gpt-4o-mini'

  logger.debug({ model, count, language, tone }, 'OpenAI generation started')

  const completion = await client.chat.completions.create({
    model,
    messages: [
      {
        role: 'system',
        content: [
          `You are a WhatsApp marketing expert. Generate exactly ${count} diverse WhatsApp messages.`,
          'Each message must start with a completely different opening.',
          'Every message must include {{name}}.',
          'Each message must stay under 280 characters and use a single CTA.',
          `Language: ${language}.`,
          `Tone: ${tone}.`,
          'Return only JSON: {"variants":["msg1","msg2"]}',
        ].join(' '),
      },
      {
        role: 'user',
        content: `Product: ${product}\nAudience: ${audience}\nCount: ${count}`,
      },
    ],
    max_tokens: 900,
    temperature: 0.9,
    response_format: { type: 'json_object' },
  })

  const content = stripCodeFences(completion.choices[0]?.message?.content ?? '{}')
  const parsed = JSON.parse(content)

  if (!Array.isArray(parsed?.variants)) {
    throw new Error('OpenAI returned invalid format')
  }

  const variants = parsed.variants.map((variant: unknown) => String(variant).trim()).filter(Boolean).slice(0, count)
  if (variants.length === 0) {
    throw new Error('OpenAI returned an empty variants array')
  }

  return {
    variants,
    model,
    tokensUsed: completion.usage?.total_tokens ?? 0,
  }
}
