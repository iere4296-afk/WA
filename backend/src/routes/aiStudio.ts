import { Router } from 'express'
import { z } from 'zod'
import { authenticate, AuthRequest, requireRole } from '../lib/authenticate.js'
import { config } from '../lib/config.js'
import { respondData } from '../lib/http.js'
import { validate } from '../lib/validate.js'
import { generateMessages } from '../modules/ai/aiService.js'
import { testGroqConnection } from '../modules/ai/groqClient.js'
import { supabase } from '../lib/supabase.js'

const router = Router()

const generateSchema = z.object({
  product: z.string().trim().min(1),
  audience: z.string().trim().min(1),
  tone: z.string().trim().optional(),
  count: z.coerce.number().int().min(1).max(5).optional(),
  language: z.string().trim().optional(),
})

router.get('/status', authenticate, async (req: AuthRequest, res) => {
  const groqStatus = config.groq.ready
    ? await testGroqConnection()
    : {
        connected: false,
        model: config.groq.modelFast,
        latencyMs: 0,
        error: 'Groq is not configured',
      }

  return respondData(res, {
    ai: {
      groq: {
        configured: config.groq.ready,
        connected: groqStatus.connected,
        model: groqStatus.model,
        latencyMs: groqStatus.latencyMs,
        error: groqStatus.error,
      },
      openai: {
        configured: config.openai.ready,
        model: config.openai.model,
      },
      activeProvider: groqStatus.connected ? 'groq' : config.openai.ready ? 'openai' : 'handlebars',
    },
  })
})

router.post('/generate', authenticate, requireRole('operator'), validate(generateSchema), async (req: AuthRequest, res) => {
  try {
    const payload = req.body as z.infer<typeof generateSchema>

    const result = await generateMessages({
      product: payload.product.trim(),
      audience: payload.audience.trim(),
      tone: payload.tone?.trim() || 'Professional',
      count: payload.count ?? 1,
      language: payload.language?.trim() || 'English',
      orgId: req.user!.orgId,
      userId: req.user!.id,
    })

    return respondData(res, {
      variants: result.variants,
      provider: result.provider,
      modelUsed: result.modelUsed,
      totalTokens: result.totalTokens,
    })
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || 'Unable to generate AI messages' })
  }
})

async function getAiLog(orgId: string) {
  const { data, error } = await supabase
    .from('ai_generation_log')
    .select('*')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) throw error
  return data || []
}

router.get('/log', authenticate, async (req: AuthRequest, res) => {
  return respondData(res, await getAiLog(req.user!.orgId))
})

router.get('/usage', authenticate, async (req: AuthRequest, res) => {
  const logs = await getAiLog(req.user!.orgId)
  const totalCalls = logs.length
  const totalTokens = logs.reduce((sum, log) => sum + (log.tokens_used || 0), 0)
  const gatePassRate = logs.length ? logs.filter((log) => log.gates_passed > 0).length / logs.length : 0

  return respondData(res, {
    totalCalls,
    totalTokens,
    gatePassRate,
    modelsUsed: [...new Set(logs.map((log) => log.model_used).filter(Boolean))],
    logs,
  })
})

export default router
