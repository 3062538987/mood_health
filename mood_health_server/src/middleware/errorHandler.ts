import type { NextFunction, Request, Response } from 'express'
import logger, { sanitizeForLogs } from '../utils/logger'
import { AppError } from '../utils/errors'
import { API_ERROR_CODES, apiFailure, businessCodeForHttpStatus } from '../utils/apiResponse'

type ErrorLike = Error & {
  status?: number
  statusCode?: number
  path?: string
  timestamp?: string
  data?: unknown
  array?: () => unknown[]
}

export const errorHandler = (
  error: ErrorLike,
  request: Request,
  response: Response,
  _next: NextFunction
) => {
  const isValidationError = error.name === 'ValidationError' || typeof error.array === 'function'
  const statusCode = isValidationError ? 400 : error.statusCode || error.status || 500
  const isInternalError = statusCode >= 500
  const message = isValidationError
    ? '请求参数验证失败'
    : process.env.NODE_ENV === 'production' && isInternalError
      ? '服务器内部错误'
      : error.message || '服务器内部错误'

  const logContext = {
    name: error.name || 'Error',
    message: error.message || '服务器内部错误',
    statusCode,
    path: request.originalUrl,
    method: request.method,
    timestamp: new Date().toISOString(),
    stack: error.stack,
    data: sanitizeForLogs(error.data ?? null),
  }

  if (isInternalError) {
    logger.error(`[${request.method}] ${request.originalUrl}`, logContext)
  } else {
    logger.warn(`[${request.method}] ${request.originalUrl}`, logContext)
  }

  const businessCode = isValidationError
    ? API_ERROR_CODES.BAD_REQUEST
    : businessCodeForHttpStatus(statusCode)

  return response.status(statusCode).json(apiFailure(businessCode, message))
}

export const notFoundHandler = (request: Request, _response: Response, next: NextFunction) => {
  next(new AppError('请求的资源不存在', 404, null, request.originalUrl))
}
