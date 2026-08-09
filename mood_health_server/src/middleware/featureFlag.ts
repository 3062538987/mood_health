import { HTTP_STATUS } from '../utils/httpStatus'
import type { NextFunction, Request, Response } from 'express'
import { featureFlags, type FeatureFlags } from '../config/featureFlags'
import { API_ERROR_CODES, apiFailure } from '../utils/apiResponse'

type FeatureChecker = (flags: FeatureFlags) => boolean

/**
 * 创建功能开关中间件
 * @param check 检查函数，返回 true 表示允许访问
 * @param message 功能关闭时的提示信息
 */
export const requireFeature = (check: FeatureChecker, message: string) => {
  return (_req: Request, res: Response, next: NextFunction) => {
    if (!check(featureFlags)) {
      return res.status(HTTP_STATUS.SERVICE_UNAVAILABLE).json(apiFailure(API_ERROR_CODES.FEATURE_DISABLED, message))
    }
    next()
  }
}

/**
 * 非核心模块开关 (音乐/放松/活动/社区/课程/成就)
 */
export const requireNonCoreModules = requireFeature(
  (flags) => flags.nonCoreModules,
  '该功能模块暂未启用，请稍后再试'
)