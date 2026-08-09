import { HTTP_STATUS } from '../utils/httpStatus'
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
      return res.status(HTTP_STATUS.UNAUTHORIZED).json(apiFailure(401, '未登录'))
    }
    const { analysisHistoryId, feedbackType, comment } = req.body

    if (!analysisHistoryId || !['helpful', 'not_helpful'].includes(feedbackType)) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json(apiFailure(400, '请提供有效的 analysisHistoryId 和 feedbackType'))
    }

    const result = await feedbackService.submitFeedback(
      userId,
      parseInt(String(analysisHistoryId)),
      feedbackType,
      comment,
    )

    if (result.duplicate) {
      return res.status(HTTP_STATUS.CONFLICT).json(apiFailure(409, '您已对该建议提交过反馈'))
    }

    res.json(apiSuccess({ id: result.id }, '反馈提交成功'))
  } catch (error) {
    logger.error(error)
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(apiFailure(500, '服务器错误'))
  }
}

