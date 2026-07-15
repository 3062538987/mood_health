import { Request, Response } from 'express'
import { AuthRequest } from '../middleware/auth'
import { apiSuccess } from '../utils/apiResponse'
import { HttpException } from '../utils/errors'
import logger from '../utils/logger'
import { createAuthService } from '../services/authService'

const authService = createAuthService()

export const register = async (req: Request, res: Response) => {
  try {
    await authService.register(req.body)
    res.status(201).json(apiSuccess(null, '注册成功'))
  } catch (error: any) {
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
    res.json(apiSuccess(result, '登录成功'))
  } catch (error: any) {
    logger.warn('用户登录失败', {
      path: req.originalUrl,
      username: req.body?.username,
      reason: error instanceof Error ? error.message : 'unknown_error',
    })
    throw error
  }
}

export const getMe = async (req: AuthRequest, res: Response) => {
  if (!req.user) {
    throw new HttpException('未登录', 401, null, req.originalUrl)
  }

  const user = await authService.getMe(req.user.userId)
  res.json(apiSuccess({ user }, '获取当前用户成功'))
}
