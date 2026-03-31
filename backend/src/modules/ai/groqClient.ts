/**
 * Groq API client for fast AI message generation.
 *
 * Supported production defaults were verified against Groq's official models
 * page on 2026-03-31:
 * - llama-3.1-8b-instant
 * - llama-3.3-70b-versatile
 *
 * Groq's retired legacy 8B model is no longer supported.
 */

import Groq from 'groq-sdk'
import { config } from '../../lib/config.js'
import { logger } from '../../lib/logger.js'

type GroqModelTier = 'fast' | 'smart' | 'quality'

export interface GroqGenerateParams {
  prompt: string
  systemPrompt?: string
  model?: GroqModelTier
  maxTokens?: number
  temperature?: number
}

export interface GroqGenerateResult {
  content: string
  model: string
  tokensUsed: number
  latencyMs: number
}

export interface GroqVariantParams {
  product: string
  audience: string
  tone: string
  count: number
  language?: string
}

export interface GroqVariantResult {
  variants: string[]
  model: string
  tokensUsed: number
  latencyMs: number
}

const MODEL_MAP = {
  fast: 'llama-3.1-8b-instant',
  smart: 'llama-3.3-70b-versatile',
  quality: 'llama-3.3-70b-versatile',
} as const

let groqInstance: Groq | null = null

function getGroqClient(): Groq {
  if (!groqInstance) {
    if (!config.groq.apiKey) {
      throw new Error('GROQ_API_KEY is not configured')
    }

    groqInstance = new Groq({ apiKey: config.groq.apiKey })
  }

  return groqInstance
}

function resolveModelName(modelTier: GroqModelTier): string {
  if (modelTier === 'fast') return config.groq.modelFast || MODEL_MAP.fast
  if (modelTier === 'smart') return config.groq.modelSmart || MODEL_MAP.smart
  if (modelTier === 'quality') return config.groq.modelQuality || MODEL_MAP.quality
  return MODEL_MAP.fast
}

function stripCodeFences(value: string): string {
  return value
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim()
}

function extractVariants(rawContent: string, count: number): string[] {
  const cleaned = stripCodeFences(rawContent)

  try {
    const parsed = JSON.parse(cleaned)

    if (Array.isArray(parsed?.variants)) {
      return parsed.variants.map((variant: unknown) => String(variant).trim()).filter(Boolean).slice(0, count)
    }

    if (Array.isArray(parsed)) {
      return parsed.map((variant: unknown) => String(variant).trim()).filter(Boolean).slice(0, count)
    }
  } catch (parseError) {
    logger.warn({ err: parseError }, 'Groq returned non-JSON variant payload; falling back to line parsing')
  }

  const lines = cleaned
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !line.startsWith('{') && !line.startsWith('}') && !line.startsWith('[') && !line.startsWith(']'))
    .filter((line) => !line.startsWith('"variants"'))
    .map((line) => line.replace(/^["'\d.\-*]+\s*/, '').replace(/["',]+$/, '').trim())
    .filter((line) => line.length > 20)

  return [...new Set(lines)].slice(0, count)
}

export async function groqGenerate(params: GroqGenerateParams): Promise<GroqGenerateResult> {
  const client = getGroqClient()
  const startedAt = Date.now()
  const modelTier = params.model ?? 'fast'
  const modelName = resolveModelName(modelTier)

  const messages: Groq.Chat.ChatCompletionMessageParam[] = []
  if (params.systemPrompt) {
    messages.push({ role: 'system', content: params.systemPrompt })
  }
  messages.push({ role: 'user', content: params.prompt })

  logger.debug({ model: modelName, promptLength: params.prompt.length }, 'Groq generation started')

  const completion = await client.chat.completions.create({
    model: modelName,
    messages,
    max_tokens: params.maxTokens ?? 500,
    temperature: params.temperature ?? 0.8,
  })

  const content = completion.choices[0]?.message?.content ?? ''
  const tokensUsed = completion.usage?.total_tokens ?? 0
  const latencyMs = Date.now() - startedAt

  logger.debug({ model: modelName, tokensUsed, latencyMs }, 'Groq generation finished')

  return {
    content,
    model: modelName,
    tokensUsed,
    latencyMs,
  }
}

export async function groqGenerateVariants(params: GroqVariantParams): Promise<GroqVariantResult> {
  const { product, audience, tone, count, language = 'English' } = params

  const systemPrompt = [
    'You are an expert WhatsApp marketing copywriter.',
    'Generate natural WhatsApp messages that feel human, not robotic.',
    'Each message must include {{name}} for personalization.',
    'Use exactly one clear CTA per message.',
    'Keep each message under 280 characters.',
    'Use at most two relevant emojis per message.',
    'Every variation must have a clearly different opening and structure.',
    `Language: ${language}.`,
    `Tone: ${tone}.`,
  ].join(' ')

  const prompt = [
    `Generate exactly ${count} different WhatsApp message variations.`,
    `Product or service: ${product}`,
    `Target audience: ${audience}`,
    'Rules:',
    '1. No two messages can share the same first four words.',
    '2. Vary structure: use a mix of greeting, offer-first, question-first, and curiosity-based openings.',
    '3. Make every message feel like it was written by a different person.',
    '4. Return only valid JSON with this shape:',
    '{"variants":["message 1","message 2"]}',
  ].join('\n')

  const result = await groqGenerate({
    prompt,
    systemPrompt,
    model: 'smart',
    maxTokens: 900,
    temperature: 0.9,
  })

  const variants = extractVariants(result.content, count)
  if (variants.length === 0) {
    logger.error({ model: result.model, content: result.content }, 'Groq returned an unparseable variants response')
    throw new Error(`Groq returned an unparseable response: ${result.content.slice(0, 200)}`)
  }

  return {
    variants,
    model: result.model,
    tokensUsed: result.tokensUsed,
    latencyMs: result.latencyMs,
  }
}

export async function testGroqConnection(): Promise<{
  connected: boolean
  model: string
  latencyMs: number
  error?: string
}> {
  const startedAt = Date.now()

  try {
    const result = await groqGenerate({
      prompt: 'Say OK and nothing else.',
      model: 'fast',
      maxTokens: 5,
      temperature: 0,
    })

    return {
      connected: true,
      model: result.model,
      latencyMs: Date.now() - startedAt,
    }
  } catch (error: any) {
    return {
      connected: false,
      model: config.groq.modelFast || MODEL_MAP.fast,
      latencyMs: Date.now() - startedAt,
      error: error?.message || 'Groq connection test failed',
    }
  }
}
