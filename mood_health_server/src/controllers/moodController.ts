import { Response } from 'express'
import { AuthRequest } from '../middleware/auth'
import { clearMoodCache } from '../utils/cache'
import { apiFailure, apiSuccess } from '../utils/apiResponse'
import { createMoodService } from '../services/moodService'
import { createMoodAlertService } from '../services/moodAlertService'
import logger from '../utils/logger'

const moodService = createMoodService()
const moodAlertService = createMoodAlertService()

function guardUserId(req: AuthRequest, res: Response): number | null {
  if (!req.user) {
    res.status(401).json(apiFailure(401, '未登录'))
    return null
  }
  return req.user.userId
}

export const recordMood = async (req: AuthRequest, res: Response) => {
  try {
    const userId = guardUserId(req, res)
    if (userId === null) return
    const {
      moodType,
      moodRatio,
      intensity,
      intensity_score,
      level,
      event,
      tags,
      trigger,
      recordDate,
      emotions,
      tagIds,
      includeNote,
    } = req.body

    if (emotions && Array.isArray(emotions) && emotions.length > 0) {
      for (const emotion of emotions) {
        if (!emotion.emotionTypeId || emotion.intensity === undefined) {
          return res.status(400).json(apiFailure(400, '情绪数据格式错误'))
        }
        if (emotion.intensity < 1 || emotion.intensity > 10) {
          return res.status(400).json(apiFailure(400, '强度必须在1-10之间'))
        }
      }

      const date = recordDate || new Date().toISOString().split('T')[0]
      const resolvedTagIds = tagIds || []

      const result = await moodService.recordMood({
        userId,
        note: event || '',
        trigger: trigger || '',
        includeNote: includeNote === true,
        recordedAt: new Date(`${date}T00:00:00.000Z`),
        emotions,
        tagIds: resolvedTagIds,
      })
      clearMoodCache(userId).catch((err) => logger.warn('清除缓存失败(非阻塞)', { error: (err as Error).message }))
      return res.status(201).json(apiSuccess(result, '记录成功'))
    }

    const rawIntensity = Array.isArray(moodRatio)
      ? moodRatio[0]
      : (moodRatio ?? intensity ?? intensity_score ?? level)

    if (!moodType || rawIntensity === undefined) {
      return res.status(400).json(apiFailure(400, '情绪类型和强度为必填'))
    }

    const moodTypeNames = (Array.isArray(moodType) ? moodType : String(moodType).split(/[,，、]/))
      .map((item) => String(item).trim())
      .filter(Boolean)
    const resolvedIntensity = Number(rawIntensity)

    if (!Number.isFinite(resolvedIntensity) || resolvedIntensity < 1 || resolvedIntensity > 10) {
      return res.status(400).json(apiFailure(400, '强度必须在1-10之间'))
    }

    const date = recordDate || new Date().toISOString().split('T')[0]
    const emotionTypes = await moodService.listEmotionTypes()
    const matchedEmotions = moodTypeNames.map((name) => emotionTypes.find((type) => type.name === name || type.code === name))

    if (matchedEmotions.some((emotion) => !emotion)) {
      return res.status(400).json(apiFailure(400, '情绪类型不存在'))
    }

    const tagNames = (Array.isArray(tags) ? tags : String(tags || '').split(/[,，、]/))
      .map((item) => String(item).trim())
      .filter(Boolean)
    if (tagNames.length > 20) {
      return res.status(400).json(apiFailure(400, '标签数量不能超过20个'))
    }
    const tagIdMap = await moodService.createOrGetTagsBatch(tagNames, userId)
    const mappedTagIds = tagNames.map((name: string) => tagIdMap.get(name)!).filter(Boolean)
    const resolvedTags = mappedTagIds.map((id: number) => ({ id }))

    const result = await moodService.recordMood({
      userId,
      note: event || '',
      trigger: trigger || '',
      includeNote: includeNote === true,
      recordedAt: new Date(`${date}T00:00:00.000Z`),
      emotions: matchedEmotions.map((emotion, index) => ({
        emotionTypeId: emotion!.id,
        intensity: resolvedIntensity,
        isPrimary: index === 0,
      })),
      tagIds: resolvedTags.map((tag) => tag.id),
    })
    clearMoodCache(userId).catch((err) => logger.warn('清除缓存失败(非阻塞)', { error: (err as Error).message }))
    res.status(201).json(apiSuccess(result, '记录成功'))
  } catch (error) {
    logger.error('请求处理异常', { error: (error as Error).message })
    res.status(500).json(apiFailure(500, '服务器错误'))
  }
}
export const getMoodList = async (req: AuthRequest, res: Response) => {
  try {
    const userId = guardUserId(req, res)
    if (userId === null) return
    const page = Math.max(1, parseInt(req.query.page as string) || 1)
    const limit = Math.min(100, Math.max(1, parseInt(req.query.size as string) || parseInt(req.query.limit as string) || 20))
    const emotionTypeId = req.query.emotionTypeId
      ? parseInt(req.query.emotionTypeId as string)
      : null


    const result = await moodService.listMoods(userId, {
      page,
      limit,
      ...(emotionTypeId ? { emotionTypeId } : {}),
    })
    res.json(apiSuccess(result, '获取情绪记录成功'))
  } catch (error) {
    logger.error('请求处理异常', { error: (error as Error).message })
    res.status(500).json(apiFailure(500, '服务器错误'))
  }
}
export const getWeeklyReportHandler = async (req: AuthRequest, res: Response) => {
  try {
    const userId = guardUserId(req, res)
    if (userId === null) return
    const report = await moodService.getWeeklyReport(userId)
    res.json(apiSuccess(report, '获取情绪周报成功'))
  } catch (error) {
    logger.error('请求处理异常', { error: (error as Error).message })
    res.status(500).json(apiFailure(500, '服务器错误'))
  }
}

export const updateMoodHandler = async (req: AuthRequest, res: Response) => {
  try {
    const userId = guardUserId(req, res)
    if (userId === null) return
    const moodId = parseInt(req.params.id as string)
    const { moodType, intensity, note, event, tags, trigger, emotions, tagIds, recordDate, includeNote } = req.body

    if (!Number.isInteger(moodId) || moodId <= 0) {
      return res.status(400).json(apiFailure(400, '无效的记录 ID'))
    }

    if (emotions && Array.isArray(emotions) && emotions.length > 0) {
      for (const emotion of emotions) {
        if (emotion.intensity < 1 || emotion.intensity > 10) {
          return res.status(400).json(apiFailure(400, '强度必须在1-10之间'))
        }
      }

      const date = recordDate || new Date().toISOString().split('T')[0]

      const updated = await moodService.updateMood({
        id: moodId,
        userId,
        note: event ?? note ?? '',
        trigger: trigger || '',
        includeNote: includeNote === true,
        recordedAt: new Date(`${date}T00:00:00.000Z`),
        emotions,
        tagIds: tagIds || [],
      })

      if (!updated) {
        return res.status(404).json(apiFailure(404, '记录不存在'))
      }

      clearMoodCache(userId).catch((err) => logger.warn('清除缓存失败(非阻塞)', { error: (err as Error).message }))
      return res.json(apiSuccess(null, '更新成功'))
    }

    const moodTypeNames = (Array.isArray(moodType) ? moodType : String(moodType || '').split(/[,，、]/))
      .map((item) => String(item).trim())
      .filter(Boolean)
    const resolvedIntensity = Number(intensity)

    if (moodTypeNames.length === 0 || !Number.isFinite(resolvedIntensity)) {
      return res.status(400).json(apiFailure(400, '情绪类型和强度为必填'))
    }

    if (resolvedIntensity < 1 || resolvedIntensity > 10) {
      return res.status(400).json(apiFailure(400, '强度必须在1-10之间'))
    }

    const emotionTypes = await moodService.listEmotionTypes()
    const matchedEmotions = moodTypeNames.map((name) => emotionTypes.find((type) => type.name === name || type.code === name))

    if (matchedEmotions.some((emotion) => !emotion)) {
      return res.status(400).json(apiFailure(400, '情绪类型不存在'))
    }

    const date = recordDate || new Date().toISOString().split('T')[0]
    const tagNames = (Array.isArray(tags) ? tags : String(tags || '').split(/[,，、]/))
      .map((item) => String(item).trim())
      .filter(Boolean)
    if (tagNames.length > 20) {
      return res.status(400).json(apiFailure(400, '标签数量不能超过20个'))
    }
    const tagIdMap = await moodService.createOrGetTagsBatch(tagNames, userId)
    const mappedTagIds = tagNames.map((name: string) => tagIdMap.get(name)!).filter(Boolean)
    const resolvedTags = mappedTagIds.map((id: number) => ({ id }))

    const updated = await moodService.updateMood({
      id: moodId,
      userId,
      note: event ?? note ?? '',
      trigger: trigger || '',
      includeNote: includeNote === true,
      recordedAt: new Date(`${date}T00:00:00.000Z`),
      emotions: matchedEmotions.map((emotion, index) => ({
        emotionTypeId: emotion!.id,
        intensity: resolvedIntensity,
        isPrimary: index === 0,
      })),
      tagIds: resolvedTags.map((tag) => tag.id),
    })

    if (!updated) {
      return res.status(404).json(apiFailure(404, '记录不存在'))
    }

    clearMoodCache(userId).catch((err) => logger.warn('清除缓存失败(非阻塞)', { error: (err as Error).message }))
    res.json(apiSuccess(null, '更新成功'))
  } catch (error) {
    logger.error('请求处理异常', { error: (error as Error).message })
    res.status(500).json(apiFailure(500, '服务器错误'))
  }
}

export const deleteMoodHandler = async (req: AuthRequest, res: Response) => {
  try {
    const userId = guardUserId(req, res)
    if (userId === null) return
    const moodId = parseInt(req.params.id as string)

    if (!Number.isInteger(moodId) || moodId <= 0) {
      return res.status(400).json(apiFailure(400, '无效的记录 ID'))
    }

    const deleted = await moodService.deleteMood(userId, moodId)

    if (!deleted) {
      return res.status(404).json(apiFailure(404, '记录不存在'))
    }

    clearMoodCache(userId).catch((err) => logger.warn('清除缓存失败(非阻塞)', { error: (err as Error).message }))
    res.json(apiSuccess(null, '删除成功'))
  } catch (error) {
    logger.error('请求处理异常', { error: (error as Error).message })
    res.status(500).json(apiFailure(500, '服务器错误'))
  }
}

export const getMoodTrend = async (req: AuthRequest, res: Response) => {
  try {
    const userId = guardUserId(req, res)
    if (userId === null) return
    const range = (req.query.range as string) || 'week'

    if (!['week', 'month', 'quarter'].includes(range)) {
      return res.status(400).json(apiFailure(400, '无效的时间范围'))
    }

    const trendData = await moodService.getMoodTrend(userId, range as 'week' | 'month' | 'quarter')
    res.json(apiSuccess(trendData, '获取情绪趋势成功'))
  } catch (error) {
    logger.error('请求处理异常', { error: (error as Error).message })
    res.status(500).json(apiFailure(500, '服务器错误'))
  }
}

export const getMoodTypes = async (req: AuthRequest, res: Response) => {
  try {
    const emotionTypes = await moodService.listEmotionTypes()
    const formattedTypes = emotionTypes.map((type) => ({
      id: type.id,
      name: type.name,
      icon: type.icon,
      category: type.category,
    }))
    res.json(apiSuccess(formattedTypes, '获取成功'))
  } catch (error) {
    logger.error('请求处理异常', { error: (error as Error).message })
    res.status(500).json(apiFailure(500, '服务器错误'))
  }
}

export const getTagsHandler = async (req: AuthRequest, res: Response) => {
  try {
    const userId = guardUserId(req, res)
    if (userId === null) return
    const tags = await moodService.listTags(userId)
    res.json(apiSuccess(tags, '获取成功'))
  } catch (error) {
    logger.error('请求处理异常', { error: (error as Error).message })
    res.status(500).json(apiFailure(500, '服务器错误'))
  }
}

export const createTagHandler = async (req: AuthRequest, res: Response) => {
  try {
    const userId = guardUserId(req, res)
    if (userId === null) return
    const { name } = req.body

    if (!name || typeof name !== 'string') {
      return res.status(400).json(apiFailure(400, '标签名称不能为空'))
    }

    if (name.trim().length > 50) {
      return res.status(400).json(apiFailure(400, '标签名称不能超过50个字符'))
    }

    const tag = await moodService.createOrGetTag(name.trim(), userId)
    res.status(201).json(apiSuccess(tag, '创建成功'))
  } catch (error) {
    logger.error('请求处理异常', { error: (error as Error).message })
    res.status(500).json(apiFailure(500, '服务器错误'))
  }
}

export const getMoodComparison = async (req: AuthRequest, res: Response) => {
  try {
    const userId = guardUserId(req, res)
    if (userId === null) return
    const period = (req.query.period as string) || 'week'

    if (!['week', 'month'].includes(period)) {
      return res.status(400).json(apiFailure(400, '无效的周期参数，仅支持 week 或 month'))
    }

    const comparison = await moodService.getPeriodComparison(userId, period as 'week' | 'month')
    res.json(apiSuccess(comparison, '获取周期对比成功'))
  } catch (error) {
    logger.error('请求处理异常', { error: (error as Error).message })
    res.status(500).json(apiFailure(500, '服务器错误'))
  }
}

export const getMoodAlerts = async (req: AuthRequest, res: Response) => {
  try {
    const userId = guardUserId(req, res)
    if (userId === null) return
    // 先检测新提醒，再获取所有提醒
    await moodAlertService.detectAlerts(userId)
    const alerts = await moodAlertService.getAlerts(userId)
    res.json(apiSuccess(alerts, '获取提醒成功'))
  } catch (error) {
    logger.error('请求处理异常', { error: (error as Error).message })
    res.status(500).json(apiFailure(500, '服务器错误'))
  }
}

export const markAlertRead = async (req: AuthRequest, res: Response) => {
  try {
    const userId = guardUserId(req, res)
    if (userId === null) return
    const alertId = parseInt(String(req.params.id))

    if (!Number.isInteger(alertId) || alertId <= 0) {
      return res.status(400).json(apiFailure(400, '无效的提醒 ID'))
    }

    const updated = await moodAlertService.markAsRead(userId, alertId)
    if (!updated) {
      return res.status(404).json(apiFailure(404, '提醒不存在'))
    }

    res.json(apiSuccess(null, '已标记为已读'))
  } catch (error) {
    logger.error('请求处理异常', { error: (error as Error).message })
    res.status(500).json(apiFailure(500, '服务器错误'))
  }
}

export const getMoodAnalysisHandler = async (req: AuthRequest, res: Response) => {
  try {
    const userId = guardUserId(req, res)
    if (userId === null) return
    const range = (req.query.range as string) || 'month'

    if (!['week', 'month', 'quarter'].includes(range)) {
      return res.status(400).json(apiFailure(400, '无效的时间范围'))
    }

    const analysis = await moodService.getMoodAnalysis(userId, range as 'week' | 'month' | 'quarter')
    res.json(apiSuccess(analysis, '获取情绪统计成功'))
  } catch (error) {
    logger.error('请求处理异常', { error: (error as Error).message })
    res.status(500).json(apiFailure(500, '服务器错误'))
  }
}

export const getMoodInsightHandler = async (req: AuthRequest, res: Response) => {
  try {
    const userId = guardUserId(req, res)
    if (userId === null) return
    const period = (req.query.period as string) || 'week'

    if (!['day', 'week', 'month', 'year'].includes(period)) {
      return res.status(400).json(apiFailure(400, '无效的时间范围，支持 day/week/month/year'))
    }

    const insight = await moodService.getMoodInsight(userId, period as 'day' | 'week' | 'month' | 'year')
    res.json(apiSuccess(insight))
  } catch (error) {
    logger.error('请求处理异常', { error: (error as Error).message })
    res.status(500).json(apiFailure(500, '服务器错误'))
  }
}

