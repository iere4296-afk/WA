import { config } from '../../lib/config.js'
import { logger } from '../../lib/logger.js'
import { supabase } from '../../lib/supabase.js'
import { runAllGates } from './contentGates.js'
import { groqGenerateVariants } from './groqClient.js'
import { openaiGenerateVariants } from './openaiClient.js'
import { handlebarsFallback } from './templateFallback.js'

type AIProvider = 'groq' | 'openai' | 'handlebars'

interface AIGenerateOptions {
  description: string
  category?: string
  language?: string
  tone?: string
  intentScore?: number
  orgId: string
  userId: string
}

export interface GenerateParams {
  product: string
  audience: string
  tone: string
  count: number
  language?: string
  orgId: string
  userId: string
  intentScore?: number
}

export interface VariantResult {
  content: string
  gatesPassed: number
  gatesFailed: string[]
  gateDetails: Array<{ gate: number; passed: boolean; reason?: string }>
  isUsable: boolean
}

export interface GenerateResult {
  variants: VariantResult[]
  modelUsed: string
  provider: AIProvider
  totalTokens: number
}

const gateLabels = new Map<number, string>([
  [1, 'Spam Patterns'],
  [2, 'Emoji Density'],
  [3, 'Opening Pattern'],
  [4, 'Length Match'],
  [5, 'Similarity Check'],
])

function extractVariables(content: string): string[] {
  const matches = content.match(/\{\{(\w+)\}\}/g) || []
  return [...new Set(matches.map((match) => match.slice(2, -2)))]
}

function normalizeVariant(content: string): string {
  return content
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

function buildTemplateName(product: string, category: string): string {
  const primaryLine = product.split('\n')[0]?.trim() || ''
  if (!primaryLine) {
    return `${category.charAt(0).toUpperCase() + category.slice(1)} Template`
  }

  return primaryLine.length > 48 ? `${primaryLine.slice(0, 45).trimEnd()}...` : primaryLine
}

function parseDescription(description: string): { product: string; audience: string } {
  const lines = description
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

  const audienceLine = lines.find((line) => /^target audience:/i.test(line))
  const audience = audienceLine?.replace(/^target audience:\s*/i, '').trim() || 'interested contacts'
  const product = lines
    .filter((line) => !/^target audience:/i.test(line))
    .join(' ')
    .trim()

  return {
    product: product || description.trim(),
    audience,
  }
}

function parseHistoryOutput(output: unknown): string[] {
  const raw = typeof output === 'string' ? output.trim() : ''
  if (!raw) return []

  try {
    const parsed = JSON.parse(raw)

    if (typeof parsed?.body === 'string') {
      return [parsed.body]
    }

    if (typeof parsed?.content === 'string') {
      return [parsed.content]
    }

    if (Array.isArray(parsed?.variants)) {
      return parsed.variants.map((variant: unknown) => String(variant).trim()).filter(Boolean)
    }

    if (Array.isArray(parsed)) {
      return parsed.map((variant: unknown) => String(variant).trim()).filter(Boolean)
    }
  } catch {
    // Fall through to plain-text parsing.
  }

  return raw
    .split('\n---\n')
    .map((chunk) => chunk.trim())
    .filter(Boolean)
}

async function getRecentGeneratedMessages(orgId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('ai_generation_log')
    .select('output')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })
    .limit(20)

  if (error) {
    logger.warn({ err: error.message }, 'Unable to load recent AI generation history')
    return []
  }

  return (data || [])
    .flatMap((row) => parseHistoryOutput(row.output))
    .filter(Boolean)
}

async function getExistingTemplateBodies(orgId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('message_templates')
    .select('body')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) {
    logger.warn({ err: error.message }, 'Unable to load existing template bodies')
    return []
  }

  return (data || []).map((row) => row.body).filter(Boolean)
}

function ensureVariantCount(rawVariants: string[], params: Pick<GenerateParams, 'product' | 'audience' | 'tone' | 'count'>): string[] {
  const fallbackVariants = handlebarsFallback.generateVariants(params)
  const finalVariants: string[] = []
  const seen = new Set<string>()

  const addVariant = (variant: string) => {
    const normalized = normalizeVariant(variant)
    if (!normalized || seen.has(normalized)) return

    seen.add(normalized)
    finalVariants.push(variant.trim())
  }

  rawVariants.forEach(addVariant)
  fallbackVariants.forEach(addVariant)

  const prefixes = ['Also', 'Plus', 'Meanwhile', 'Another option', 'Worth noting']
  let prefixIndex = 0
  while (finalVariants.length < params.count && fallbackVariants.length > 0) {
    const base = fallbackVariants[finalVariants.length % fallbackVariants.length]
    addVariant(`${prefixes[prefixIndex % prefixes.length]}, ${base}`)
    prefixIndex += 1
  }

  return finalVariants.slice(0, params.count)
}

async function logGeneration(params: GenerateParams, result: GenerateResult, rawVariants: string[]) {
  const passCount = result.variants.filter((variant) => variant.isUsable).length
  const failedGateNames = [...new Set(result.variants.flatMap((variant) => variant.gatesFailed))]

  const { error: insertError } = await supabase.from('ai_generation_log').insert({
    org_id: params.orgId,
    user_id: params.userId,
    model_used: result.modelUsed,
    prompt: `${params.product} | ${params.audience} | ${params.tone} | count:${params.count}`,
    output: rawVariants.join('\n---\n'),
    gates_passed: passCount,
    gates_failed: failedGateNames,
    attempts: 1,
    tokens_used: result.totalTokens,
  })

  if (insertError) {
    logger.warn({ err: insertError.message }, 'Failed to write AI generation log entry')
  }

  const { error: usageError } = await supabase.rpc('increment_billing_usage', {
    org_id: params.orgId,
    field: 'ai_calls',
  })

  if (usageError) {
    logger.warn({ err: usageError.message }, 'Failed to increment AI billing usage')
  }
}

export async function generateMessages(params: GenerateParams): Promise<GenerateResult> {
  const intentScore = params.intentScore ?? 50
  const language = params.language || 'English'

  let rawVariants: string[] = []
  let modelUsed = 'handlebars-offline'
  let provider: AIProvider = 'handlebars'
  let totalTokens = 0

  if (config.groq.ready) {
    try {
      const groqResult = await groqGenerateVariants({
        product: params.product,
        audience: params.audience,
        tone: params.tone,
        count: params.count,
        language,
      })

      rawVariants = groqResult.variants
      modelUsed = groqResult.model
      provider = 'groq'
      totalTokens = groqResult.tokensUsed
      logger.info({ model: modelUsed, count: rawVariants.length }, 'Groq generation succeeded')
    } catch (groqError: any) {
      logger.warn({ err: groqError?.message || groqError }, 'Groq generation failed, trying OpenAI fallback')
    }
  }

  if (rawVariants.length === 0 && config.openai.ready) {
    try {
      const openaiResult = await openaiGenerateVariants({
        product: params.product,
        audience: params.audience,
        tone: params.tone,
        count: params.count,
        language,
      })

      rawVariants = openaiResult.variants
      modelUsed = openaiResult.model
      provider = 'openai'
      totalTokens = openaiResult.tokensUsed
      logger.info({ model: modelUsed, count: rawVariants.length }, 'OpenAI generation succeeded')
    } catch (openaiError: any) {
      logger.warn({ err: openaiError?.message || openaiError }, 'OpenAI generation failed, using Handlebars fallback')
    }
  }

  if (rawVariants.length === 0) {
    rawVariants = handlebarsFallback.generateVariants({
      product: params.product,
      audience: params.audience,
      tone: params.tone,
      count: params.count,
    })
    modelUsed = 'handlebars-offline'
    provider = 'handlebars'
    totalTokens = 0
    logger.warn({ count: rawVariants.length }, 'Using offline Handlebars fallback for AI generation')
  }

  rawVariants = ensureVariantCount(rawVariants, params)

  const recentMessages = await getRecentGeneratedMessages(params.orgId)
  const existingTemplateBodies = await getExistingTemplateBodies(params.orgId)

  const variants: VariantResult[] = []

  for (const content of rawVariants) {
    const existingForGate3 = [
      ...variants.map((variant) => variant.content),
      ...existingTemplateBodies,
      ...recentMessages,
    ]

    const gateResult = runAllGates(content, existingForGate3, intentScore, recentMessages)

    variants.push({
      content,
      gatesPassed: gateResult.results.filter((result) => result.passed).length,
      gatesFailed: gateResult.failedGates,
      gateDetails: gateResult.results.map((result) => ({
        gate: result.gate,
        passed: result.passed,
        reason: result.reason,
      })),
      isUsable: gateResult.passed,
    })
  }

  const finalResult: GenerateResult = {
    variants,
    modelUsed,
    provider,
    totalTokens,
  }

  await logGeneration(params, finalResult, rawVariants)

  return finalResult
}

export const aiService = {
  async generateMessage(options: AIGenerateOptions) {
    const {
      description,
      category = 'marketing',
      language = 'EN',
      tone = 'professional',
      intentScore = 50,
      orgId,
      userId,
    } = options

    const parsed = parseDescription(description)
    const result = await generateMessages({
      product: parsed.product,
      audience: parsed.audience,
      tone,
      count: 1,
      language,
      orgId,
      userId,
      intentScore,
    })

    const variant = result.variants[0]
    const name = buildTemplateName(parsed.product, category)
    const variables = extractVariables(variant.content)

    return {
      name,
      body: variant.content,
      variables,
      gatesPassed: variant.gatesPassed,
      gatesFailed: variant.gatesFailed,
      gateDetails: variant.gateDetails,
      isUsable: variant.isUsable,
      modelUsed: result.modelUsed,
      provider: result.provider,
      template: {
        name,
        body: variant.content,
        variables,
      },
      gates: variant.gateDetails.map((detail) => ({
        name: gateLabels.get(detail.gate) || `Gate ${detail.gate}`,
        passed: detail.passed,
        reason: detail.reason,
      })),
    }
  },
}
