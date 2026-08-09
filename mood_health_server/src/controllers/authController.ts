import { HTTP_STATUS } from '../utils/httpStatus'
import { Request, Response } from 'express'
import { AuthRequest } from '../middleware/auth'
import { apiSuccess, apiFailure } from '../utils/apiResponse'
import { HttpException } from '../utils/errors'
import logger from '../utils/logger'
import { createAuthService } from '../services/authService'

const authService = createAuthService()

// 安全: 设置 HttpOnly Cookie 防止 XSS 窃取 Token (VUE-AUTH-001)
const TOKEN_COOKIE = 'auth_token'
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7天
  path: '/',
}

export const register = async (req: Request, res: Response) => {
  try {
    await authService.register(req.body)
    res.status(HTTP_STATUS.CREATED).json(apiSuccess(null, '注册成功'))
  } catch (error: unknown) {
    logger.warn('用户注册请求失败', {
      path: req.originalUrl,
      username: req.body?.username,
      reason: error instanceof Error ? error.message : 'unknown_error',
    })
    throw error
  }
}

export const login = async (req: Request, res: Response) => {
  try {
    const result = await authService.login(req.body)
    // 安全: 将 JWT 存入 HttpOnly Cookie，防止 XSS 读取 (VUE-AUTH-001)
    res.cookie(TOKEN_COOKIE, result.token, COOKIE_OPTIONS)
    res.json(apiSuccess(result, '登录成功'))
  } catch (error: unknown) {
    logger.warn('用户登录失败', {
      path: req.originalUrl,
      username: req.body?.username,
      reason: error instanceof Error ? error.message : 'unknown_error',
    })
    throw error
  }
}

export const logout = async (_req: Request, res: Response) => {
  res.clearCookie(TOKEN_COOKIE, { path: '/' })
  res.json(apiSuccess(null, '已退出登录'))
}

export const getMe = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json(apiFailure(401, '未登录'))
    }

    const user = await authService.getMe(req.user.userId)
    res.json(apiSuccess({ user }, '获取当前用户成功'))
  } catch (error) {
    if (error instanceof HttpException) {
      return res.status(error.statusCode).json(apiFailure(error.statusCode, error.message))
    }
    logger.error('获取当前用户失败', { error, userId: req.user?.userId })
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(apiFailure(500, '获取用户信息失败'))
  }
}

export const deleteMe = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json(apiFailure(401, '未登录'))
    }

    await authService.deleteMe(req.user.userId)
    res.clearCookie(TOKEN_COOKIE, { path: '/' })
    res.json(apiSuccess(null, '账号已注销'))
  } catch (error) {
    if (error instanceof HttpException) {
      return res.status(error.statusCode).json(apiFailure(error.statusCode, error.message))
    }
    logger.error('账号注销失败', { error, userId: req.user?.userId })
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(apiFailure(500, '账号注销失败'))
  }
}
