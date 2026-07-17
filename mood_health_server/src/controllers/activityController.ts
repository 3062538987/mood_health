import { Request, Response } from 'express'
import { AuthRequest } from '../middleware/auth'
import { setCache, getCache, clearActivityCache } from '../utils/cache'
import logger from '../utils/logger'
import {
  createActivityRepository,
  type ActivityFilter,
} from '../repositories/activityRepository'

const activityRepo = createActivityRepository()

export const getActivityList = async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1
    const limit = parseInt(req.query.limit as string) || 10

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

    const response = {
      code: 0,
      data: {
        list: activities,
        pagination,
      },
      pagination,
    }

    if (!hasFilter) {
      await setCache(cacheKey, response, 600)
    }

    res.json(response)
  } catch (error) {
    logger.error('获取活动列表失败', { error: error instanceof Error ? error.message : 'unknown_error' })
    res.status(500).json({ code: 500, message: '服务器错误' })
  }
}

export const getActivityDetail = async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string)
    const activity = await activityRepo.findById(id)
    if (!activity) {
      return res.status(404).json({ code: 404, message: '活动不存在' })
    }
    res.json({ code: 0, data: activity })
  } catch (error) {
    logger.error('获取活动详情失败', { error: error instanceof Error ? error.message : 'unknown_error' })
    res.status(500).json({ code: 500, message: '服务器错误' })
  }
}

export const joinActivityHandler = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId
    const activityId = parseInt(req.params.id as string)

    const activity = await activityRepo.findById(activityId)
    if (!activity) {
      return res.status(404).json({ code: 404, message: '活动不存在' })
    }

    const alreadyJoined = await activityRepo.hasUserJoined(activityId, userId)
    if (alreadyJoined) {
      return res.status(400).json({ code: 400, message: '您已经报名过该活动' })
    }

    await activityRepo.join(activityId, userId)
    await clearActivityCache()

    res.json({ code: 0, message: '报名成功' })
  } catch (error: any) {
    logger.error('报名活动失败', { error: error instanceof Error ? error.message : 'unknown_error' })

    switch (error.message) {
      case 'ACTIVITY_FULL':
        return res.status(400).json({ code: 400, message: '报名失败，活动名额已满' })
      case 'ALREADY_JOINED':
        return res.status(400).json({ code: 400, message: '您已经报名过该活动' })
      case 'TRANSACTION_TIMEOUT':
        return res.status(500).json({ code: 500, message: '报名超时，请稍后重试' })
      default:
        return res.status(500).json({ code: 500, message: '报名失败，请稍后重试' })
    }
  }
}

export const cancelJoinActivityHandler = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId
    const activityId = parseInt(req.params.id as string)

    const activity = await activityRepo.findById(activityId)
    if (!activity) {
      return res.status(404).json({ code: 404, message: '活动不存在' })
    }

    const alreadyJoined = await activityRepo.hasUserJoined(activityId, userId)
    if (!alreadyJoined) {
      return res.status(400).json({ code: 400, message: '您尚未报名该活动' })
    }

    await activityRepo.cancelJoin(activityId, userId)
    await clearActivityCache()

    res.json({ code: 0, message: '已取消报名' })
  } catch (error: any) {
    logger.error('取消报名失败', { error: error instanceof Error ? error.message : 'unknown_error' })

    switch (error.message) {
      case 'NOT_JOINED':
        return res.status(400).json({ code: 400, message: '您尚未报名该活动' })
      case 'TRANSACTION_TIMEOUT':
        return res.status(500).json({ code: 500, message: '取消报名超时，请稍后重试' })
      default:
        return res.status(500).json({ code: 500, message: '取消报名失败，请稍后重试' })
    }
  }
}

export const getMyJoinedActivities = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId
    const activities = await activityRepo.getUserJoinedActivities(userId)
    res.json({ code: 0, data: activities })
  } catch (error) {
    logger.error('获取我的活动失败', { error: error instanceof Error ? error.message : 'unknown_error' })
    res.status(500).json({ code: 500, message: '服务器错误' })
  }
}

export const createActivityHandler = async (req: AuthRequest, res: Response) => {
  try {
    const { title, description, startTime, endTime, maxParticipants, location, imageUrl } = req.body

    if (!title || !startTime || !endTime || !maxParticipants || !location) {
      return res.status(400).json({ code: 400, message: '请提供完整的活动信息' })
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

    res.status(201).json({ code: 0, message: '活动创建成功', data: { id: activityId } })
  } catch (error) {
    logger.error('创建活动失败', { error: error instanceof Error ? error.message : 'unknown_error' })
    res.status(500).json({ code: 500, message: '服务器错误' })
  }
}

export const updateActivityHandler = async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id as string)
    const { title, description, startTime, endTime, maxParticipants, location, imageUrl } = req.body

    const activity = await activityRepo.findById(id)
    if (!activity) {
      return res.status(404).json({ code: 404, message: '活动不存在' })
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

    res.json({ code: 0, message: '活动更新成功' })
  } catch (error) {
    logger.error('更新活动失败', { error: error instanceof Error ? error.message : 'unknown_error' })
    res.status(500).json({ code: 500, message: '服务器错误' })
  }
}

export const deleteActivityHandler = async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id as string)

    const activity = await activityRepo.findById(id)
    if (!activity) {
      return res.status(404).json({ code: 404, message: '活动不存在' })
    }

    await activityRepo.remove(id)
    await clearActivityCache()

    res.json({ code: 0, message: '活动删除成功' })
  } catch (error) {
    logger.error('删除活动失败', { error: error instanceof Error ? error.message : 'unknown_error' })
    res.status(500).json({ code: 500, message: '服务器错误' })
  }
}

export const getActivityDetailWithParticipants = async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string)

    const activity = await activityRepo.findById(id)
    if (!activity) {
      return res.status(404).json({ code: 404, message: '活动不存在' })
    }

    const participants = await activityRepo.getParticipants(id)

    res.json({
      code: 0,
      data: {
        activity,
        participants,
      },
    })
  } catch (error) {
    logger.error('获取活动详情失败', { error: error instanceof Error ? error.message : 'unknown_error' })
    res.status(500).json({ code: 500, message: '服务器错误' })
  }
}