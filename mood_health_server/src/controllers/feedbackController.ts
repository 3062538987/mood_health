import { Response } from 'express'
import { AuthRequest } from '../middleware/auth'
import { apiFailure, apiSuccess } from '../utils/apiResponse'
import logger from '../utils/logger'
import { createFeedbackService } from '../services/feedbackService'

const feedbackService = createFeedbackService()

export const submitFeedback = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId
    if (!userId) {
      return res.status(401).json(apiFailure(401, '未登录'))
    }
    const { analysisHistoryId, feedbackType, comment } = req.body

    if (!analysisHistoryId || !['helpful', 'not_helpful'].includes(feedbackType)) {
      return res.status(400).json(apiFailure(400, '请提供有效的 analysisHistoryId 和 feedbackType'))
    }

    const result = await feedbackService.submitFeedback(
      userId,
      parseInt(String(analysisHistoryId)),
      feedbackType,
      comment,
    )

    if (result.duplicate) {
      return res.status(409).json(apiFailure(409, '您已对该建议提交过反馈'))
    }

    res.json(apiSuccess({ id: result.id }, '反馈提交成功'))
  } catch (error) {
    logger.error(error)
    res.status(500).json(apiFailure(500, '服务器错误'))
  }
}

export const getFeedbackStats = async (req: AuthRequest, res: Response) => {
  try {
    const stats = await feedbackService.getStats()
    res.json(apiSuccess(stats, '获取反馈统计成功'))
  } catch (error) {
    logger.error(error)
    res.status(500).json(apiFailure(500, '服务器错误'))
  }
}

export const getFeedbackList = async (req: AuthRequest, res: Response) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1)
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize as string) || 20))
    const feedbackType = req.query.feedbackType as string | undefined

    const result = await feedbackService.getList(feedbackType, page, pageSize)
    res.json(apiSuccess(result, '获取反馈列表成功'))
  } catch (error) {
    logger.error(error)
    res.status(500).json(apiFailure(500, '服务器错误'))
  }
}