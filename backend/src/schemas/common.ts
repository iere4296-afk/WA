import { z } from 'zod'

export const uuidSchema = z.string().uuid()

export const idParamsSchema = z.object({
  id: uuidSchema,
})

export const listMemberParamsSchema = z.object({
  id: uuidSchema,
  contactId: uuidSchema,
})

export const userIdParamsSchema = z.object({
  userId: uuidSchema,
})

export const webhookIdParamsSchema = z.object({
  webhookId: z.string().min(1),
})

export const paginationQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
})

export const optionalSearchSchema = z.object({
  search: z.string().trim().min(1).optional(),
})
