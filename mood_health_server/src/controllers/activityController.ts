import { Request, Response } from 'express'
import { AuthRequest } from '../middleware/auth'
import { RowDataPacket } from 'mysql2'
import { getMysqlPool } from '../config/mysql'
import { setCache, getCache, clearActivityCache } from '../utils/cache'
import {
  createActivityRepository,
  type ActivityFilter,
} from '../repositories/activityRepository'
import { createActivityFeedbackService } from '../services/activityFeedbackService'

const activityRepo = createActivityRepository()
const feedbackService = createActivityFeedbackService()

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
    console.error('获取活动列表失败:', error)
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
    console.error(error)
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

    await activityRepo.join(activityId, userId)
    await clearActivityCache()

    res.json({ code: 0, message: '报名成功' })
  } catch (error: any) {
    console.error('报名活动失败:', error)

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

    await activityRepo.cancelJoin(activityId, userId)
    await clearActivityCache()

    res.json({ code: 0, message: '已取消报名' })
  } catch (error: any) {
    console.error('取消报名失败:', error)

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
    console.error(error)
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
    console.error(error)
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
    console.error(error)
    res.status(500).json({ code: 500, message: '服务器错误' })
  }
}

export const setReminderHandler = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId
    const activityId = parseInt(req.params.id as string)

    const activity = await activityRepo.findById(activityId)
    if (!activity) {
      return res.status(404).json({ code: 404, message: '活动不存在' })
    }

    const joined = await activityRepo.hasUserJoined(activityId, userId)
    if (!joined) {
      return res.status(400).json({ code: 400, message: '请先报名活动' })
    }

    // 提醒时间默认为活动开始前30分钟
    const startTime = new Date(activity.startTime)
    const remindAt = new Date(startTime.getTime() - 30 * 60 * 1000)

    if (remindAt <= new Date()) {
      return res.status(400).json({ code: 400, message: '活动即将开始，无法设置提醒' })
    }

    const created = await activityRepo.createReminder(activityId, userId, remindAt.toISOString())
    if (!created) {
      return res.status(400).json({ code: 400, message: '已设置过提醒' })
    }

    res.json({ code: 0, message: '提醒设置成功', data: { remindAt: remindAt.toISOString() } })
  } catch (error) {
    console.error('设置提醒失败:', error)
    res.status(500).json({ code: 500, message: '服务器错误' })
  }
}

export const cancelReminderHandler = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId
    const activityId = parseInt(req.params.id as string)

    const cancelled = await activityRepo.cancelReminder(activityId, userId)
    if (!cancelled) {
      return res.status(404).json({ code: 404, message: '未找到提醒记录' })
    }

    res.json({ code: 0, message: '已取消提醒' })
  } catch (error) {
    console.error('取消提醒失败:', error)
    res.status(500).json({ code: 500, message: '服务器错误' })
  }
}

export const getReminderStatusHandler = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId
    const activityId = parseInt(req.params.id as string)

    const hasReminder = await activityRepo.hasReminder(activityId, userId)
    res.json({ code: 0, data: { hasReminder } })
  } catch (error) {
    console.error('获取提醒状态失败:', error)
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
    console.error('获取活动详情失败:', error)
    res.status(500).json({ code: 500, message: '服务器错误' })
  }
}

// 活动反馈
export const submitFeedbackHandler = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId
    const activityId = parseInt(req.params.id as string)
    const { rating, comment } = req.body

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ code: 400, message: '请提供 1-5 的评分' })
    }

    const activity = await activityRepo.findById(activityId)
    if (!activity) {
      return res.status(404).json({ code: 404, message: '活动不存在' })
    }

    const joined = await activityRepo.hasUserJoined(activityId, userId)
    if (!joined) {
      return res.status(400).json({ code: 400, message: '仅报名用户可提交反馈' })
    }

    // 活动未结束不允许反馈
    if (new Date(activity.endTime) > new Date()) {
      return res.status(400).json({ code: 400, message: '活动结束后才能提交反馈' })
    }

    const result = await feedbackService.submitFeedback(activityId, userId, { rating, comment })
    if (result.duplicate) {
      return res.status(400).json({ code: 400, message: '您已提交过反馈' })
    }

    res.status(201).json({ code: 0, message: '反馈提交成功', data: { id: result.id } })
  } catch (error) {
    console.error('提交反馈失败:', error)
    res.status(500).json({ code: 500, message: '服务器错误' })
  }
}

export const getFeedbackHandler = async (req: Request, res: Response) => {
  try {
    const activityId = parseInt(req.params.id as string)
    const feedbacks = await feedbackService.getFeedbackByActivity(activityId)
    const stats = await feedbackService.getFeedbackStats(activityId)

    res.json({
      code: 0,
      data: { feedbacks, stats },
    })
  } catch (error) {
    console.error('获取反馈失败:', error)
    res.status(500).json({ code: 500, message: '服务器错误' })
  }
}

export const getUserFeedbackHandler = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId
    const activityId = parseInt(req.params.id as string)

    const feedback = await feedbackService.getUserFeedback(activityId, userId)
    res.json({ code: 0, data: { feedback } })
  } catch (error) {
    console.error('获取用户反馈失败:', error)
    res.status(500).json({ code: 500, message: '服务器错误' })
  }
}

// 活动效果统计（管理端）
export const getActivityStatsHandler = async (req: AuthRequest, res: Response) => {
  try {
    const pool = getMysqlPool()
    const { startDate, endDate } = req.query as Record<string, string>

    let dateFilter = ''
    const params: unknown[] = []
    if (startDate) {
      dateFilter += ' AND a.start_time >= ?'
      params.push(startDate)
    }
    if (endDate) {
      dateFilter += ' AND a.start_time <= ?'
      params.push(endDate)
    }

    // 总活动数
    const [totalRows] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) as total FROM activities a WHERE 1=1${dateFilter}`,
      params
    )
    const totalActivities = Number(totalRows[0]?.total ?? 0)

    // 总报名数
    const [joinRows] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) as total FROM activity_participants ap
       JOIN activities a ON ap.activity_id = a.id WHERE 1=1${dateFilter}`,
      params
    )
    const totalParticipants = Number(joinRows[0]?.total ?? 0)

    // 平均报名率
    const avgRate = totalActivities > 0
      ? Math.round((totalParticipants / (totalActivities || 1)) * 100) / 100
      : 0

    // 反馈统计
    const [feedbackStatsRows] = await pool.query<RowDataPacket[]>(
      `SELECT
         COUNT(*) as total,
         COALESCE(AVG(af.rating), 0) as avg_rating
       FROM activity_feedback af
       JOIN activities a ON af.activity_id = a.id WHERE 1=1${dateFilter}`,
      params
    )
    const totalFeedback = Number(feedbackStatsRows[0]?.total ?? 0)
    const avgRating = Math.round(Number(feedbackStatsRows[0]?.avg_rating) * 10) / 10

    // 评分分布
    const [ratingDistRows] = await pool.query<RowDataPacket[]>(
      `SELECT
         SUM(CASE WHEN af.rating = 1 THEN 1 ELSE 0 END) as r1,
         SUM(CASE WHEN af.rating = 2 THEN 1 ELSE 0 END) as r2,
         SUM(CASE WHEN af.rating = 3 THEN 1 ELSE 0 END) as r3,
         SUM(CASE WHEN af.rating = 4 THEN 1 ELSE 0 END) as r4,
         SUM(CASE WHEN af.rating = 5 THEN 1 ELSE 0 END) as r5
       FROM activity_feedback af
       JOIN activities a ON af.activity_id = a.id WHERE 1=1${dateFilter}`,
      params
    )

    res.json({
      code: 0,
      data: {
        totalActivities,
        totalParticipants,
        averageParticipants: avgRate,
        totalFeedback,
        averageRating: avgRating,
        ratingDistribution: {
          1: Number(ratingDistRows[0]?.r1 ?? 0),
          2: Number(ratingDistRows[0]?.r2 ?? 0),
          3: Number(ratingDistRows[0]?.r3 ?? 0),
          4: Number(ratingDistRows[0]?.r4 ?? 0),
          5: Number(ratingDistRows[0]?.r5 ?? 0),
        },
      },
    })
  } catch (error) {
    console.error('获取活动统计失败:', error)
    res.status(500).json({ code: 500, message: '服务器错误' })
  }
}