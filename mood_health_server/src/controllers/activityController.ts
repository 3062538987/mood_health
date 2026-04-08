import { Request, Response } from 'express'
import { AuthRequest } from '../middleware/auth'
import { setCache, getCache, clearActivityCache } from '../utils/cache'
import {
  getActivities,
  getActivitiesCount,
  getActivityById,
  joinActivity,
  cancelJoinActivity,
  getUserJoinedActivities,
  hasUserJoined,
  createActivity,
  updateActivity,
  deleteActivity,
  getActivityParticipants,
  type ActivityFilter,
} from '../models/activityModel'

export const getActivityList = async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1
    const limit = parseInt(req.query.limit as string) || 10

    // 构建筛选条件
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

    // 有筛选条件时不使用缓存
    const hasFilter = Object.keys(filter).length > 0
    const cacheKey = `activities:list:${page}:${limit}:${JSON.stringify(filter)}`

    if (!hasFilter) {
      const cached = await getCache(cacheKey)
      if (cached) {
        return res.json(cached)
      }
    }

    // 并行获取活动列表和总数
    const [activities, total] = await Promise.all([
      getActivities(page, limit, filter),
      getActivitiesCount(filter),
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
      // 兼容仍直接读取 response.pagination 的调用方
      pagination,
    }

    // 无筛选条件时缓存结果
    if (!hasFilter) {
      await setCache(cacheKey, response, 600)
    }

    res.json(response)
  } catch (error) {
    console.error('获取活动列表失败:', error)
    res.status(500).json({ code: 500, message: '服务器错误' })
  }
}

export const getActivityDetail = async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string)
    const activity = await getActivityById(id)
    if (!activity) {
      return res.status(404).json({ code: 404, message: '活动不存在' })
    }
    res.json({ code: 0, data: activity })
  } catch (error) {
    console.error(error)
    res.status(500).json({ code: 500, message: '服务器错误' })
  }
}

/**
 * 清除活动列表缓存
 */
export const joinActivityHandler = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId
    const activityId = parseInt(req.params.id as string)

    const activity = await getActivityById(activityId)
    if (!activity) {
      return res.status(404).json({ code: 404, message: '活动不存在' })
    }

    const alreadyJoined = await hasUserJoined(activityId, userId)
    if (alreadyJoined) {
      return res.status(400).json({ code: 400, message: '您已经报名过该活动' })
    }

    await joinActivity(activityId, userId)

    // 报名成功后清除活动列表缓存
    await clearActivityCache()

    res.json({ code: 0, message: '报名成功' })
  } catch (error: any) {
    console.error('报名活动失败:', error)

    // 处理特定的业务错误
    switch (error.message) {
      case 'ACTIVITY_FULL':
        return res.status(400).json({
          code: 400,
          message: '报名失败，活动名额已满',
        })
      case 'ALREADY_JOINED':
        return res.status(400).json({
          code: 400,
          message: '您已经报名过该活动',
        })
      case 'TRANSACTION_TIMEOUT':
        return res.status(500).json({
          code: 500,
          message: '报名超时，请稍后重试',
        })
      default:
        return res.status(500).json({
          code: 500,
          message: '报名失败，请稍后重试',
        })
    }
  }
}

export const cancelJoinActivityHandler = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId
    const activityId = parseInt(req.params.id as string)

    const activity = await getActivityById(activityId)
    if (!activity) {
      return res.status(404).json({ code: 404, message: '活动不存在' })
    }

    const alreadyJoined = await hasUserJoined(activityId, userId)
    if (!alreadyJoined) {
      return res.status(400).json({ code: 400, message: '您尚未报名该活动' })
    }

    await cancelJoinActivity(activityId, userId)

    // 取消报名后清除活动列表缓存
    await clearActivityCache()

    res.json({ code: 0, message: '已取消报名' })
  } catch (error: any) {
    console.error('取消报名失败:', error)

    switch (error.message) {
      case 'NOT_JOINED':
        return res.status(400).json({
          code: 400,
          message: '您尚未报名该活动',
        })
      case 'TRANSACTION_TIMEOUT':
        return res.status(500).json({
          code: 500,
          message: '取消报名超时，请稍后重试',
        })
      default:
        return res.status(500).json({
          code: 500,
          message: '取消报名失败，请稍后重试',
        })
    }
  }
}

export const getMyJoinedActivities = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId
    const activities = await getUserJoinedActivities(userId)
    res.json({ code: 0, data: activities })
  } catch (error) {
    console.error(error)
    res.status(500).json({ code: 500, message: '服务器错误' })
  }
}

export const createActivityHandler = async (req: AuthRequest, res: Response) => {
  try {
    const { title, description, startTime, endTime, maxParticipants, location, imageUrl } = req.body

    if (!title || !startTime || !endTime || !maxParticipants || !location) {
      return res.status(400).json({ code: 400, message: '请提供完整的活动信息' })
    }

    const activityId = await createActivity(
      title,
      description || '',
      startTime,
      endTime,
      maxParticipants,
      location,
      imageUrl
    )

    // 清除活动列表缓存
    await clearActivityCache()

    res.status(201).json({ code: 0, message: '活动创建成功', data: { id: activityId } })
  } catch (error) {
    console.error(error)
    res.status(500).json({ code: 500, message: '服务器错误' })
  }
}

export const updateActivityHandler = async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id as string)
    const { title, description, startTime, endTime, maxParticipants, location, imageUrl } = req.body

    const activity = await getActivityById(id)
    if (!activity) {
      return res.status(404).json({ code: 404, message: '活动不存在' })
    }

    await updateActivity(
      id,
      title || activity.title,
      description || activity.description,
      startTime || activity.start_time,
      endTime || activity.end_time,
      maxParticipants || activity.max_participants,
      location || activity.location,
      imageUrl || activity.image_url
    )

    // 清除活动列表缓存
    await clearActivityCache()

    res.json({ code: 0, message: '活动更新成功' })
  } catch (error) {
    console.error(error)
    res.status(500).json({ code: 500, message: '服务器错误' })
  }
}

export const deleteActivityHandler = async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id as string)

    const activity = await getActivityById(id)
    if (!activity) {
      return res.status(404).json({ code: 404, message: '活动不存在' })
    }

    await deleteActivity(id)

    // 清除活动列表缓存
    await clearActivityCache()

    res.json({ code: 0, message: '活动删除成功' })
  } catch (error) {
    console.error(error)
    res.status(500).json({ code: 500, message: '服务器错误' })
  }
}

/**
 * 获取活动详情（包含参与者列表）
 */
export const getActivityDetailWithParticipants = async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string)

    // 获取活动详情
    const activity = await getActivityById(id)
    if (!activity) {
      return res.status(404).json({ code: 404, message: '活动不存在' })
    }

    // 获取参与者列表
    const participants = await getActivityParticipants(id)

    res.json({
      code: 0,
      data: {
        activity,
        participants,
      },
    })
  } catch (error) {
    console.error('获取活动详情失败:', error)
    res.status(500).json({ code: 500, message: '服务器错误' })
  }
}
