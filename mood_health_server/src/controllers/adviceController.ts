import { HTTP_STATUS } from '../utils/httpStatus'
import { Response } from 'express'
import { AuthRequest } from '../middleware/auth'
import { apiSuccess, apiFailure, API_ERROR_CODES } from '../utils/apiResponse'
import { createAdviceRepository } from '../repositories/adviceRepository'

const adviceRepo = createAdviceRepository()

export const saveAdviceHandler = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(HTTP_STATUS.UNAUTHORIZED).json(apiFailure(API_ERROR_CODES.UNAUTHORIZED, '未登录'))
    const { moodRecordId, analysis, suggestions } = req.body as {
      moodRecordId?: unknown
      analysis?: unknown
      suggestions?: unknown
    }
    if (typeof analysis !== 'string' || !analysis.trim()) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json(apiFailure(API_ERROR_CODES.BAD_REQUEST, 'analysis 不能为空'))
    }
    if (!Array.isArray(suggestions) || suggestions.some((s) => typeof s !== 'string')) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json(apiFailure(API_ERROR_CODES.BAD_REQUEST, 'suggestions 必须为字符串数组'))
    }
    const id = await adviceRepo.save({
      userId: req.user.userId,
      moodRecordId: typeof moodRecordId === 'number' ? moodRecordId : undefined,
      analysis,
      suggestions: suggestions as string[],
    })
    return res.status(HTTP_STATUS.CREATED).json(apiSuccess({ id }, '保存成功'))
  } catch (error) {
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(apiFailure(API_ERROR_CODES.INTERNAL_ERROR, '保存建议失败'))
  }
}

export const getAdviceHistoryHandler = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) return res.status(HTTP_STATUS.UNAUTHORIZED).json(apiFailure(API_ERROR_CODES.UNAUTHORIZED, '未登录'))
    const page = Math.max(1, parseInt(req.query.page as string) || 1)
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize as string) || 20))
    const { list, total } = await adviceRepo.listByUser(req.user.userId, page, pageSize)
    return res.json(apiSuccess({ list, total }, '获取成功'))
  } catch (error) {
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(apiFailure(API_ERROR_CODES.INTERNAL_ERROR, '获取建议历史失败'))
  }
}
