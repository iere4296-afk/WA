import { Response } from 'express'
import { AuthRequest } from './authenticate.js'
import { writeAuditLog } from './audit.js'

export interface CursorMeta {
  nextCursor: string | null
  hasMore: boolean
}

export function respondData<T>(res: Response, data: T, status = 200) {
  return res.status(status).json({ data })
}

export function respondPaginated<T>(
  res: Response,
  data: T,
  meta: CursorMeta,
  status = 200,
) {
  return res.status(status).json({ data, meta })
}

export function getRequestMeta(req: AuthRequest) {
  return {
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'] as string | undefined,
  }
}

export async function auditMutation(
  req: AuthRequest,
  action: string,
  resourceType: string,
  resourceId: string | undefined,
  beforeState?: unknown,
  afterState?: unknown,
) {
  if (!req.user?.orgId) return

  await writeAuditLog({
    orgId: req.user.orgId,
    userId: req.user.id,
    action,
    resourceType,
    resourceId,
    beforeState,
    afterState,
    ...getRequestMeta(req),
  })
}

export function normalizeIdParam(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] : value || ''
}

export function encodeCursor(payload: Record<string, string>): string {
  return Buffer.from(JSON.stringify(payload)).toString('base64')
}

export function decodeCursor<T>(cursor: string): T {
  return JSON.parse(Buffer.from(cursor, 'base64').toString()) as T
}
