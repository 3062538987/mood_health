import type { NextFunction, Request, Response } from 'express'
import { generateRequestId } from '../utils/apiResponse'

/**
 * 为每个请求生成唯一 requestId，并挂载到 req 和 res.locals 上。
 * 响应头也会添加 X-Request-Id 方便调试。
 */
export const requestIdMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const id = generateRequestId()
  res.locals.requestId = id
  res.setHeader('X-Request-Id', id)
  next()
}