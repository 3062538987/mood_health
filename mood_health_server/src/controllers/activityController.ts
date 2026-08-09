import { HTTP_STATUS } from '../utils/httpStatus'
import { Request, Response } from 'express'
import { AuthRequest } from '../middleware/auth'
import { setCache, getCache, clearActivityCache } from '../utils/cache'
import { apiFailure, apiSuccess, API_ERROR_CODES } from '../utils/apiResponse'
import logger from '../utils/logger'
import {
  createActivityRepository,
  type ActivityFilter,
} from '../repositories/activityRepository'
import { createActivityFeedbackService } from '../services/activityFeedbackService'

const activityRepo = createActivityRepository()
const feedbackService = createActivityFeedbackService()

export const getActivityList = async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1)
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 10))

    const filter: ActivityFilter = {}

    if (req.query.title) {
      filter.title = req.query.title as string
    }
    if (req.query.location) {
      filter.location = req.query.location as string
    }
    if (req.query.startDate) {
      filter.startDate = req.query.startDate as string
    }
    if (req.query.endDate) {
      filter.endDate = req.query.endDate as string
    }
    if (req.query.status) {
      const statusParam = req.query.status as string
      filter.status = statusParam.split(',')
    }

    const hasFilter = Object.keys(filter).length > 0
    const cacheKey = `activities:list:${page}:${limit}:${JSON.stringify(filter)}`

    if (!hasFilter) {
      const cached = await getCache(cacheKey)
      if (cached) {
        return res.json(cached)
      }
    }

    const [activities, total] = await Promise.all([
      activityRepo.findAll(page, limit, filter),
      activityRepo.count(filter),
    ])

    const pagination = {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    }

    const response = apiSuccess({
      list: activities,
      pagination,
    }, '获取活动列表成功')

    if (!hasFilter) {
      await setCache(cacheKey, response, 600)
    }

    res.json(response)
  } catch (error) {
    logger.error('获取活动列表失败:', error)
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(apiFailure(500, '服务器错误'))
  }
}

export const getActivityDetail = async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string)
    const activity = await activityRepo.findById(id)
    if (!activity) {
      return res.status(HTTP_STATUS.NOT_FOUND).json(apiFailure(API_ERROR_CODES.NOT_FOUND, '活动不存在'))
    }
    res.json(apiSuccess(activity, '获取活动详情成功'))
  } catch (error) {
    logger.error(error)
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(apiFailure(500, '服务器错误'))
  }
}

export const joinActivityHandler = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId
    const activityId = parseInt(req.params.id as string)

    const activity = await activityRepo.findById(activityId)
    if (!activity) {
      return res.status(HTTP_STATUS.NOT_FOUND).json(apiFailure(API_ERROR_CODES.NOT_FOUND, '活动不存在'))
    }

    await activityRepo.join(activityId, userId)
    await clearActivityCache()

    res.json(apiSuccess(null, '报名成功'))
  } catch (error: unknown) {
    logger.error('报名活动失败:', error)

    switch ((error as Error).message) {
      case 'ACTIVITY_FULL':
        return res.status(HTTP_STATUS.BAD_REQUEST).json(apiFailure(400, '报名失败，活动名额已满'))
      case 'ALREADY_JOINED':
        return res.status(HTTP_STATUS.BAD_REQUEST).json(apiFailure(400, '您已经报名过该活动'))
      case 'TRANSACTION_TIMEOUT':
        return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(apiFailure(500, '报名超时，请稍后重试'))
      default:
        return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(apiFailure(500, '报名失败，请稍后重试'))
    }
  }
}

export const cancelJoinActivityHandler = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId
    const activityId = parseInt(req.params.id as string)

    const activity = await activityRepo.findById(activityId)
    if (!activity) {
      return res.status(HTTP_STATUS.NOT_FOUND).json(apiFailure(API_ERROR_CODES.NOT_FOUND, '活动不存在'))
    }

    await activityRepo.cancelJoin(activityId, userId)
    await clearActivityCache()

    res.json(apiSuccess(null, '已取消报名'))
  } catch (error: unknown) {
    logger.error('取消报名失败:', error)

    switch ((error as Error).message) {
      case 'NOT_JOINED':
        return res.status(HTTP_STATUS.BAD_REQUEST).json(apiFailure(400, '您尚未报名该活动'))
      case 'TRANSACTION_TIMEOUT':
        return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(apiFailure(500, '取消报名超时，请稍后重试'))
      default:
        return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(apiFailure(500, '取消报名失败，请稍后重试'))
    }
  }
}

export const getMyJoinedActivities = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId
    const activities = await activityRepo.getUserJoinedActivities(userId)
    res.json(apiSuccess(activities, '获取已报名活动成功'))
  } catch (error) {
    logger.error(error)
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(apiFailure(500, '服务器错误'))
  }
}

export const createActivityHandler = async (req: AuthRequest, res: Response) => {
  try {
    const { title, description, startTime, endTime, maxParticipants, location, imageUrl } = req.body

    if (!title || !startTime || !endTime || !maxParticipants || !location) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json(apiFailure(400, '请提供完整的活动信息'))
    }

    // 校验开始时间必须早于结束时间
    if (new Date(startTime) >= new Date(endTime)) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json(apiFailure(400, '开始时间必须早于结束时间'))
    }

    const activityId = await activityRepo.create({
      title,
      description: description || '',
      startTime,
      endTime,
      maxParticipants,
      location,
      imageUrl,
    })

    await clearActivityCache()

    res.status(HTTP_STATUS.CREATED).json(apiSuccess({ id: activityId }, '活动创建成功'))
  } catch (error) {
    logger.error(error)
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(apiFailure(500, '服务器错误'))
  }
}

export const updateActivityHandler = async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id as string)
    const { title, description, startTime, endTime, maxParticipants, location, imageUrl } = req.body

    const activity = await activityRepo.findById(id)
    if (!activity) {
      return res.status(HTTP_STATUS.NOT_FOUND).json(apiFailure(API_ERROR_CODES.NOT_FOUND, '活动不存在'))
    }

    await activityRepo.update(id, {
      title: title || activity.title,
      description: description || activity.description,
      startTime: startTime || activity.startTime,
      endTime: endTime || activity.endTime,
      maxParticipants: maxParticipants || activity.maxParticipants,
      location: location || activity.location,
      imageUrl: imageUrl || activity.imageUrl,
    })

    await clearActivityCache()

    res.json(apiSuccess(null, '活动更新成功'))
  } catch (error) {
    logger.error(error)
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(apiFailure(500, '服务器错误'))
  }
}

export const deleteActivityHandler = async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id as string)

    const activity = await activityRepo.findById(id)
    if (!activity) {
      return res.status(HTTP_STATUS.NOT_FOUND).json(apiFailure(API_ERROR_CODES.NOT_FOUND, '活动不存在'))
    }

    await activityRepo.remove(id)
    await clearActivityCache()

    res.json(apiSuccess(null, '活动删除成功'))
  } catch (error) {
    logger.error(error)
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(apiFailure(500, '服务器错误'))
  }
}

export const setReminderHandler = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId
    const activityId = parseInt(req.params.id as string)

    const activity = await activityRepo.findById(activityId)
    if (!activity) {
      return res.status(HTTP_STATUS.NOT_FOUND).json(apiFailure(API_ERROR_CODES.NOT_FOUND, '活动不存在'))
    }

    const joined = await activityRepo.hasUserJoined(activityId, userId)
    if (!joined) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json(apiFailure(400, '请先报名活动'))
    }

    // 提醒时间默认为活动开始前30分钟
    const startTime = new Date(activity.startTime)
    const remindAt = new Date(startTime.getTime() - 30 * 60 * 1000)

    if (remindAt <= new Date()) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json(apiFailure(400, '活动即将开始，无法设置提醒'))
    }

    const created = await activityRepo.createReminder(activityId, userId, remindAt.toISOString())
    if (!created) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json(apiFailure(400, '已设置过提醒'))
    }

    res.json(apiSuccess({ remindAt: remindAt.toISOString() }, '提醒设置成功'))
  } catch (error) {
    logger.error('设置提醒失败:', error)
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(apiFailure(500, '服务器错误'))
  }
}

export const cancelReminderHandler = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId
    const activityId = parseInt(req.params.id as string)

    const cancelled = await activityRepo.cancelReminder(activityId, userId)
    if (!cancelled) {
      return res.status(HTTP_STATUS.NOT_FOUND).json(apiFailure(API_ERROR_CODES.NOT_FOUND, '未找到提醒记录'))
    }

    res.json(apiSuccess(null, '已取消提醒'))
  } catch (error) {
    logger.error('取消提醒失败:', error)
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(apiFailure(500, '服务器错误'))
  }
}

export const getReminderStatusHandler = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId
    const activityId = parseInt(req.params.id as string)

    const hasReminder = await activityRepo.hasReminder(activityId, userId)
    res.json(apiSuccess({ hasReminder }, '获取提醒状态成功'))
  } catch (error) {
    logger.error('获取提醒状态失败:', error)
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(apiFailure(500, '服务器错误'))
  }
}

export const getActivityDetailWithParticipants = async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string)

    const activity = await activityRepo.findById(id)
    if (!activity) {
      return res.status(HTTP_STATUS.NOT_FOUND).json(apiFailure(API_ERROR_CODES.NOT_FOUND, '活动不存在'))
    }

    const participants = await activityRepo.getParticipants(id)

    res.json(apiSuccess({
      activity,
      participants,
    }, '获取活动详情成功'))
  } catch (error) {
    logger.error('获取活动详情失败:', error)
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(apiFailure(500, '服务器错误'))
  }
}

// 活动反馈
export const submitFeedbackHandler = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId
    const activityId = parseInt(req.params.id as string)
    const { rating, comment } = req.body

    if (rating == null || !Number.isInteger(rating) || rating < 1 || rating > 5) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json(apiFailure(400, '请提供 1-5 的评分'))
    }

    const activity = await activityRepo.findById(activityId)
    if (!activity) {
      return res.status(HTTP_STATUS.NOT_FOUND).json(apiFailure(API_ERROR_CODES.NOT_FOUND, '活动不存在'))
    }

    const joined = await activityRepo.hasUserJoined(activityId, userId)
    if (!joined) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json(apiFailure(400, '仅报名用户可提交反馈'))
    }

    // 活动未结束不允许反馈
    if (new Date(activity.endTime) > new Date()) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json(apiFailure(400, '活动结束后才能提交反馈'))
    }

    const result = await feedbackService.submitFeedback(activityId, userId, { rating, comment })
    if (result.duplicate) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json(apiFailure(400, '您已提交过反馈'))
    }

    res.status(HTTP_STATUS.CREATED).json(apiSuccess({ id: result.id }, '反馈提交成功'))
  } catch (error) {
    logger.error('提交反馈失败:', error)
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(apiFailure(500, '服务器错误'))
  }
}

export const getFeedbackHandler = async (req: Request, res: Response) => {
  try {
    const activityId = parseInt(req.params.id as string)
    const feedbacks = await feedbackService.getFeedbackByActivity(activityId)
    const stats = await feedbackService.getFeedbackStats(activityId)

    res.json(apiSuccess({ feedbacks, stats }, '获取反馈成功'))
  } catch (error) {
    logger.error('获取反馈失败:', error)
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(apiFailure(500, '服务器错误'))
  }
}

export const getUserFeedbackHandler = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId
    const activityId = parseInt(req.params.id as string)

    const feedback = await feedbackService.getUserFeedback(activityId, userId)
    res.json(apiSuccess({ feedback }, '获取用户反馈成功'))
  } catch (error) {
    logger.error('获取用户反馈失败:', error)
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(apiFailure(500, '服务器错误'))
  }
}

// 活动效果统计（管理端）—— 统计聚合下沉到 activityRepository.getStats（R15 修复：不再直连 DB）
export const getActivityStatsHandler = async (req: AuthRequest, res: Response) => {
  try {
    const { startDate, endDate } = req.query as Record<string, string>

    // 日期格式校验
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/
    if (startDate && !dateRegex.test(startDate)) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json(apiFailure(400, 'startDate 格式无效，请使用 YYYY-MM-DD 格式'))
    }
    if (endDate && !dateRegex.test(endDate)) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json(apiFailure(400, 'endDate 格式无效，请使用 YYYY-MM-DD 格式'))
    }

    const stats = await activityRepo.getStats(startDate, endDate)

    res.json(apiSuccess(stats, '获取活动统计成功'))
  } catch (error) {
    logger.error('获取活动统计失败:', error)
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(apiFailure(500, '服务器错误'))
  }
}