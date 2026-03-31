import { Router } from 'express'
import { z } from 'zod'
import { supabase } from '../lib/supabase.js'
import { config, serviceStatus } from '../lib/config.js'
import { isRedisReady } from '../lib/redis.js'
import { validate } from '../lib/validate.js'
import { signAuthToken, getAuthCookieOptions } from '../lib/authenticate.js'

const router = Router()

const initializeSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  orgName: z.string().min(1),
})

function buildOrgSlug(email: string): string {
  const local = email.split('@')[0] || 'workspace'
  const base = local.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'workspace'
  return `${base}-${Math.random().toString(36).slice(2, 8)}`
}

// Initialize first user and organization
router.post('/initialize', validate(initializeSchema), async (req, res) => {
  const { email, password, orgName } = req.body as z.infer<typeof initializeSchema>

  try {
    // Step 1: Create or update user in Supabase Auth
    let userId: string
    
    // Try to create user first
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })

    if (authError && authError.message?.includes('already registered')) {
      // User exists, update their password
      const { data: { users }, error: listError } = await supabase.auth.admin.listUsers()
      const existingUser = users?.find((u) => u.email === email)
      
      if (!existingUser) {
        return res.status(400).json({ error: 'User exists but cannot be found' })
      }
      
      userId = existingUser.id
      
      // Update password
      const { error: updateError } = await supabase.auth.admin.updateUserById(userId, {
        password,
      })
      
      if (updateError) {
        return res.status(400).json({ error: `Password update failed: ${updateError.message}` })
      }
    } else if (authError || !authData?.user) {
      return res.status(400).json({ error: authError?.message || 'Unable to create user' })
    } else {
      userId = authData.user.id
    }

    // Step 2: Create organization
    const slug = buildOrgSlug(email)
    const { data: organization, error: orgError } = await supabase
      .from('organizations')
      .insert({
        name: orgName,
        slug,
        owner_id: userId,
      })
      .select('id, name, plan, slug')
      .single()

    if (orgError || !organization) {
      return res.status(400).json({ error: orgError?.message || 'Unable to create organization' })
    }

    // Step 3: Create org membership
    const { data: membership, error: membershipError } = await supabase
      .from('org_members')
      .insert({
        org_id: organization.id,
        user_id: userId,
        role: 'owner',
      })
      .select('org_id, role, organizations(id, name, plan, slug)')
      .single()

    if (membershipError || !membership) {
      return res.status(400).json({ error: membershipError?.message || 'Unable to create membership' })
    }

    // Step 4: Create JWT token
    const token = signAuthToken({
      userId,
      orgId: organization.id,
      role: 'owner',
      email,
    })

    // Step 5: Set cookie and return
    res.cookie('wa_token', token, getAuthCookieOptions())

    res.json({
      data: {
        user: { id: userId, email },
        org: organization,
        message: 'Workspace initialized successfully',
      },
    })
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Setup failed' })
  }
})

router.get('/status', (req, res) => {
  const queue = isRedisReady()
  res.json({
    data: {
      supabase: config.supabase.ready,
      redis: queue,
      queue,
      ai: serviceStatus.ai,
      stripe: serviceStatus.stripe,
      timestamp: new Date().toISOString(),
      aiStatus: {
        provider: config.groq.ready ? 'groq' : config.openai.ready ? 'openai' : 'none',
        modelFast: config.groq.modelFast,
        modelSmart: config.groq.modelSmart,
        modelQuality: config.groq.modelQuality,
        groqReady: config.groq.ready,
        openaiReady: config.openai.ready,
      },
      version: '5.0',
    },
  })
})

router.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    version: '1.0.0',
    environment: config.server.nodeEnv,
    services: {
      ...serviceStatus,
      queue: isRedisReady(),
    },
  })
})

export default router
