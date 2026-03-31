import { CookieOptions, NextFunction, Request, Response } from 'express'
import jwt from 'jsonwebtoken'
import type { JwtPayload, SignOptions, VerifyOptions } from 'jsonwebtoken'
import { config } from './config.js'

const ROLE_HIERARCHY = { owner: 5, admin: 4, operator: 3, member: 2, viewer: 1 }
const AUTH_TOKEN_TTL = '7d'
const REFRESH_GRACE_SECONDS = 24 * 60 * 60
const TokenExpiredError = jwt.TokenExpiredError

export interface AuthRequest extends Request {
  user?: { id: string; orgId: string; role: string }
}

export interface AuthTokenPayload extends JwtPayload {
  userId: string
  orgId: string
  role: string
  email?: string
}

export function signAuthToken(
  payload: Omit<AuthTokenPayload, 'iat' | 'exp'>,
  expiresIn: SignOptions['expiresIn'] = AUTH_TOKEN_TTL,
): string {
  return jwt.sign(payload, config.security.jwtSecret, { expiresIn })
}

export function verifyAuthToken(token: string, options?: VerifyOptions): AuthTokenPayload {
  return jwt.verify(token, config.security.jwtSecret, options) as AuthTokenPayload
}

export function verifyRefreshableToken(token: string): AuthTokenPayload {
  try {
    return verifyAuthToken(token)
  } catch (error) {
    if (!(error instanceof TokenExpiredError)) {
      throw error
    }

    const decoded = jwt.decode(token)
    if (!decoded || typeof decoded === 'string') {
      throw error
    }

    const payload = decoded as AuthTokenPayload
    const exp = payload.exp ?? 0
    const now = Math.floor(Date.now() / 1000)
    if (now - exp > REFRESH_GRACE_SECONDS) {
      throw error
    }

    return payload
  }
}

export function getAuthCookieOptions(): CookieOptions {
  const isProduction = config.server.nodeEnv === 'production'

  return {
    httpOnly: true,
    secure: isProduction,
    // Vercel frontend + Railway backend uses cross-site cookies in production.
    sameSite: isProduction ? 'none' : 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  }
}

export function authenticate(req: AuthRequest, res: Response, next: NextFunction) {
  const token = req.cookies?.wa_token
    || req.headers.authorization?.replace('Bearer ', '')

  if (!token) return res.status(401).json({ error: 'Unauthorized' })

  try {
    const payload = verifyAuthToken(token)
    req.user = { id: payload.userId, orgId: payload.orgId, role: payload.role }
    next()
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' })
  }
}

export function requireRole(minRole: keyof typeof ROLE_HIERARCHY) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    const userLevel = ROLE_HIERARCHY[req.user?.role as keyof typeof ROLE_HIERARCHY] ?? 0
    const requiredLevel = ROLE_HIERARCHY[minRole]
    if (userLevel < requiredLevel) {
      return res.status(403).json({ error: `Requires ${minRole} role or higher` })
    }
    next()
  }
}
