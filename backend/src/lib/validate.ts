import { Request, Response, NextFunction } from 'express'
import { ZodError, ZodSchema } from 'zod'
import { logger } from './logger.js'

/**
 * Validation middleware factory
 * Validates request body, params, or query against a Zod schema
 */
export const validate = (schema: ZodSchema, source: 'body' | 'params' | 'query' = 'body') => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = source === 'body' ? req.body : source === 'params' ? req.params : req.query
      const parsed = schema.parse(data)

      // Replace with validated data
      if (source === 'body') req.body = parsed
      else if (source === 'params') req.params = parsed
      else req.query = parsed

      next()
    } catch (error) {
      logger.warn({ error, source }, 'Validation failed')
      if (error instanceof ZodError) {
        return res.status(400).json({
          error: 'Validation failed',
          details: error.errors.map((issue) => ({
            field: issue.path.join('.'),
            message: issue.message,
          })),
        })
      }
      res.status(400).json({ error: 'Validation failed' })
    }
  }
}

/**
 * Async route wrapper to catch errors automatically
 */
export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next)
  }
}
