import { Router } from 'express'
import { z } from 'zod'
import { supabase, supabaseAuth } from '../lib/supabase.js'
import {
  authenticate,
  AuthRequest,
  getAuthCookieOptions,
  signAuthToken,
  verifyAuthToken,
  verifyRefreshableToken,
} from '../lib/authenticate.js'
import { respondData } from '../lib/http.js'
import { validate } from '../lib/validate.js'

const router = Router()

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
})

function buildOrgSlug(email: string): string {
  const local = email.split('@')[0] || 'workspace'
  const base = local.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'workspace'
  return `${base}-${Math.random().toString(36).slice(2, 8)}`
}

function mapLoginError(message: string) {
  if (message.includes('Email logins are disabled')) {
    return {
      status: 503,
      error: 'Email/password login is disabled in Supabase Auth settings.',
    }
  }

  if (message.includes('Email not confirmed')) {
    return {
      status: 403,
      error: 'Email not confirmed.',
    }
  }

  return {
    status: 401,
    error: 'Invalid credentials',
  }
}

async function buildSessionPayload(userId: string) {
  const { data: userResult } = await supabase.auth.admin.getUserById(userId)
  const { data: orgs } = await supabase
    .from('org_members')
    .select('org_id, role, organizations(*)')
    .eq('user_id', userId)

  const currentOrg = orgs?.[0]

  return {
    user: userResult?.user
      ? {
          id: userResult.user.id,
          email: userResult.user.email,
          role: currentOrg?.role,
        }
      : null,
    org: currentOrg
      ? {
          id: currentOrg.org_id,
          role: currentOrg.role,
          name: (currentOrg.organizations as any)?.name,
          plan: (currentOrg.organizations as any)?.plan,
          slug: (currentOrg.organizations as any)?.slug,
          monthlyMessageLimit: (currentOrg.organizations as any)?.monthly_message_limit,
          messagesSentThisMonth: (currentOrg.organizations as any)?.messages_sent_this_month,
          settings: (currentOrg.organizations as any)?.settings || {},
        }
      : null,
    orgs: orgs?.map(o => ({
      id: o.org_id,
      role: o.role,
      name: (o.organizations as any)?.name,
      plan: (o.organizations as any)?.plan,
      slug: (o.organizations as any)?.slug,
      monthlyMessageLimit: (o.organizations as any)?.monthly_message_limit,
      messagesSentThisMonth: (o.organizations as any)?.messages_sent_this_month,
      settings: (o.organizations as any)?.settings || {},
    })) ?? [],
  }
}

router.post('/login', validate(loginSchema), async (req, res) => {
  const { email, password } = req.body as z.infer<typeof loginSchema>

  try {
    if (!supabaseAuth) {
      return res.status(500).json({ error: 'SUPABASE_ANON_KEY is not configured on the backend.' })
    }

    const { data: authData, error: authError } = await supabaseAuth.auth.signInWithPassword({
      email,
      password,
    })

    if (authError || !authData.user) {
      const reason = authError?.message || 'Unknown'

      // BUG FIX 4: Explicitly null user_id for failed logins
      await supabase.from('login_history').insert({
        user_id: null,
        ip_address: req.ip,
        user_agent: req.headers['user-agent'] as string,
        success: false,
        failure_reason: reason,
      })

      const loginError = mapLoginError(reason)
      return res.status(loginError.status).json({ error: loginError.error })
    }

    let { data: memberData } = await supabase
      .from('org_members')
      .select('org_id, role, organizations(id, name, plan, slug)')
      .eq('user_id', authData.user.id)
      .single()

    if (!memberData) {
      const emailLocalPart = authData.user.email?.split('@')[0] || 'Workspace'
      const workspaceName = `${emailLocalPart.replace(/[-_.]/g, ' ')} Workspace`
      const slug = buildOrgSlug(authData.user.email || email)

      const { data: organization, error: orgError } = await supabase
        .from('organizations')
        .insert({
          name: workspaceName,
          slug,
          owner_id: authData.user.id,
        })
        .select('id, name, plan, slug')
        .single()

      if (orgError || !organization) {
        return res.status(500).json({ error: orgError?.message || 'Unable to create organization' })
      }

      const { data: membership, error: membershipError } = await supabase
        .from('org_members')
        .insert({
          org_id: organization.id,
          user_id: authData.user.id,
          role: 'owner',
        })
        .select('org_id, role, organizations(id, name, plan, slug)')
        .single()

      if (membershipError || !membership) {
        return res.status(500).json({ error: membershipError?.message || 'Unable to create membership' })
      }

      memberData = membership
    }

    const orgId = memberData?.org_id
    const role = memberData?.role || 'member'

    const token = signAuthToken(
      { userId: authData.user.id, orgId, role, email: authData.user.email },
    )

    res.cookie('wa_token', token, getAuthCookieOptions())

    await supabase.from('login_history').insert({
      user_id: authData.user.id,
      org_id: orgId,
      ip_address: req.ip,
      user_agent: req.headers['user-agent'] as string,
      success: true,
    })

    return respondData(res, {
      user: {
        id: authData.user.id,
        email: authData.user.email,
        role,
      },
      org: orgId ? {
        id: orgId,
        name: (memberData.organizations as any)?.name || 'Workspace',
        plan: (memberData.organizations as any)?.plan || 'free',
        slug: (memberData.organizations as any)?.slug || null,
      } : null,
    })
  } catch (err) {
    res.status(500).json({ error: 'Login failed' })
  }
})

router.post('/logout', authenticate, async (req: AuthRequest, res) => {
  res.clearCookie('wa_token', getAuthCookieOptions())
  return respondData(res, { success: true })
})

router.post('/refresh', async (req, res) => {
  const token = req.cookies?.wa_token
    || req.headers.authorization?.replace('Bearer ', '')

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  try {
    const payload = verifyRefreshableToken(token)
    const { data: membership } = await supabase
      .from('org_members')
      .select('org_id, role')
      .eq('user_id', payload.userId)
      .eq('org_id', payload.orgId)
      .single()

    const nextToken = signAuthToken({
      userId: payload.userId,
      orgId: membership?.org_id || payload.orgId,
      role: membership?.role || payload.role,
      email: payload.email,
    })

    res.cookie('wa_token', nextToken, getAuthCookieOptions())
    return respondData(res, { refreshed: true })
  } catch {
    res.clearCookie('wa_token', getAuthCookieOptions())
    res.status(401).json({ error: 'Refresh token expired' })
  }
})

router.get('/session', async (req, res) => {
  const token = req.cookies?.wa_token
    || req.headers.authorization?.replace('Bearer ', '')

  if (!token) {
    return respondData(res, { user: null, org: null, orgs: [] })
  }

  try {
    const payload = verifyAuthToken(token)
    return respondData(res, await buildSessionPayload(payload.userId))
  } catch {
    return respondData(res, { user: null, org: null, orgs: [] })
  }
})

router.get('/me', authenticate, async (req: AuthRequest, res) => {
  return respondData(res, await buildSessionPayload(req.user!.id))
})

export default router
