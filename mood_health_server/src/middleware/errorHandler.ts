import type { NextFunction, Request, Response } from 'express'
import logger, { sanitizeForLogs } from '../utils/logger'
import { AppError } from '../utils/errors'
import { API_ERROR_CODES, apiFailure, businessCodeForHttpStatus, generateRequestId, type ValidationDetail } from '../utils/apiResponse'

type ErrorLike = Error & {
  status?: number
  statusCode?: number
  path?: string
  timestamp?: string
  data?: unknown
  array?: () => { path: string; msg: string }[]
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

  const requestId = generateRequestId()

  const logContext = {
    requestId,
    name: error.name || 'Error',
    message: error.message || '服务器内部错误',
    statusCode,
    path: request.originalUrl,
    method: request.method,
    timestamp: new Date().toISOString(),
    stack: process.env.NODE_ENV === 'production' ? undefined : error.stack,
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

  // 提取验证错误详情
  let details: ValidationDetail[] | undefined
  if (isValidationError && typeof error.array === 'function') {
    const validationErrors = error.array()
    if (validationErrors.length > 0) {
      details = validationErrors.map((e) => ({
        field: e.path,
        message: e.msg,
      }))
    }
  }

  const body = apiFailure(businessCode, message, null, details)
  body.requestId = requestId
  return response.status(statusCode).json(body)
}

export const notFoundHandler = (request: Request, _response: Response, next: NextFunction) => {
  next(new AppError('请求的资源不存在', 404, null, request.originalUrl))
}
