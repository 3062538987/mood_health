import { Request, Response } from 'express'
import { AuthRequest } from '../middleware/auth'
import { apiSuccess, apiFailure } from '../utils/apiResponse'
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
  try {
    if (!req.user) {
      return res.status(401).json(apiFailure(401, '未登录'))
    }

    const user = await authService.getMe(req.user.userId)
    res.json(apiSuccess({ user }, '获取当前用户成功'))
  } catch (error) {
    if (error instanceof HttpException) {
      return res.status(error.statusCode).json(apiFailure(error.statusCode, error.message))
    }
    logger.error('获取当前用户失败', { error, userId: req.user?.userId })
    return res.status(500).json(apiFailure(500, '获取用户信息失败'))
  }
}
