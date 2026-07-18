import { Request, Response, NextFunction } from 'express'
import crypto from 'crypto'
import logger from '../utils/logger'

const CSRF_COOKIE = 'csrf_token'
const CSRF_HEADER = 'x-csrf-token'

// 安全方法（GET、HEAD、OPTIONS）不需要 CSRF Token
const SAFE_METHODS = ['GET', 'HEAD', 'OPTIONS']

/**
 * CSRF 防护中间件
 * 使用 Double Submit Cookie 模式：
 * 1. 在任意请求中生成的 csrf_token Cookie 设置为非 HttpOnly（前端可读取）
 * 2. 在非安全方法（POST/PUT/DELETE等）中，前端需从 Cookie 读取 token 并放入 x-csrf-token 头
 * 3. 服务端比对 Cookie 和 Header 中的 token 是否一致
 * 4. 攻击者无法读取跨域 Cookie，因此无法构造有效请求
 */
const generateCsrfToken = (): string => {
  return crypto.randomBytes(32).toString('hex')
}

const csrfMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  // 安全方法直接放行
  if (SAFE_METHODS.includes(req.method)) {
    // 如果不存在 csrf_token Cookie，则生成一个
    if (!req.cookies?.[CSRF_COOKIE]) {
      const token = generateCsrfToken()
      res.cookie(CSRF_COOKIE, token, {
        httpOnly: false, // 前端需要读取
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 24 * 60 * 60 * 1000, // 24小时
        path: '/',
      })
    }
    return next()
  }

  // 非安全方法需要验证 CSRF Token
  const cookieToken = req.cookies?.[CSRF_COOKIE]
  const headerToken = req.headers[CSRF_HEADER] as string

  if (!cookieToken || !headerToken) {
    logger.warn('CSRF Token 缺失', {
      method: req.method,
      path: req.originalUrl,
      hasCookie: !!cookieToken,
      hasHeader: !!headerToken,
    })
    res.status(403).json({
      code: 403,
      message: '请求被拒绝：缺少 CSRF Token',
    })
    return
  }

  // 使用 timingSafeEqual 防止时序攻击
  try {
    const cookieBuf = Buffer.from(cookieToken, 'utf8')
    const headerBuf = Buffer.from(headerToken, 'utf8')
    if (cookieBuf.length !== headerBuf.length || !crypto.timingSafeEqual(cookieBuf, headerBuf)) {
      logger.warn('CSRF Token 不匹配', {
        method: req.method,
        path: req.originalUrl,
      })
      res.status(403).json({
        code: 403,
        message: '请求被拒绝：CSRF Token 验证失败',
      })
      return
    }
  } catch {
    res.status(403).json({
      code: 403,
      message: '请求被拒绝：CSRF Token 格式错误',
    })
    return
  }

  next()
}

export { csrfMiddleware, CSRF_COOKIE, CSRF_HEADER, generateCsrfToken }