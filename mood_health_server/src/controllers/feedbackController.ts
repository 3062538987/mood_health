import { Response } from 'express'
import { AuthRequest } from '../middleware/auth'
import { apiFailure, apiSuccess } from '../utils/apiResponse'
import { createFeedbackService } from '../services/feedbackService'

const feedbackService = createFeedbackService()

export const submitFeedback = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId
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
    console.error(error)
    res.status(500).json(apiFailure(500, '服务器错误'))
  }
}

export const getFeedbackStats = async (req: AuthRequest, res: Response) => {
  try {
    const stats = await feedbackService.getStats()
    res.json(apiSuccess(stats, '获取反馈统计成功'))
  } catch (error) {
    console.error(error)
    res.status(500).json(apiFailure(500, '服务器错误'))
  }
}