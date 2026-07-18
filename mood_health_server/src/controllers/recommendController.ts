import { Response } from 'express'
import { AuthRequest } from '../middleware/auth'
import { apiFailure, apiSuccess } from '../utils/apiResponse'
import logger from '../utils/logger'
import recommendService from '../utils/ai/recommendService'

export const getContentRecommendations = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId
    const mood = (req.query.mood as string) || '平静'
    const limit = parseInt(req.query.limit as string) || 5

    const result = await recommendService.getPersonalizedRecommendations(userId, mood, limit)
    res.json(apiSuccess(result, '获取推荐成功'))
  } catch (error) {
    logger.error(error)
    res.status(500).json(apiFailure(500, '服务器错误'))
  }
}