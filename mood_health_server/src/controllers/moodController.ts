import { Response } from 'express'
import { AuthRequest } from '../middleware/auth'
import { clearMoodCache } from '../utils/cache'
import { apiFailure, apiSuccess } from '../utils/apiResponse'
import logger from '../utils/logger'
import { createMoodService } from '../services/moodService'

const moodService = createMoodService()

const recordMoodWithEmotions = async (req: AuthRequest, res: Response) => {
  const userId = req.user!.userId
  const { emotions, event, trigger, recordDate, tagIds } = req.body

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

  await moodService.recordMood({
    userId,
    note: event || '',
    trigger: trigger || '',
    recordedAt: new Date(`${date}T00:00:00.000Z`),
    emotions,
    tagIds: resolvedTagIds,
  })
  await clearMoodCache(userId)
  return res.status(201).json(apiSuccess(null, '记录成功'))
}

// @deprecated
const recordMoodLegacy = async (req: AuthRequest, res: Response) => {
  const userId = req.user!.userId
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
  } = req.body

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
  const resolvedTags = await Promise.all(tagNames.map((name) => moodService.createOrGetTag(name, userId)))

  await moodService.recordMood({
    userId,
    note: event || '',
    trigger: trigger || '',
    recordedAt: new Date(`${date}T00:00:00.000Z`),
    emotions: matchedEmotions.map((emotion, index) => ({
      emotionTypeId: emotion!.id,
      intensity: resolvedIntensity,
      isPrimary: index === 0,
    })),
    tagIds: resolvedTags.map((tag) => tag.id),
  })
  await clearMoodCache(userId)
  res.status(201).json(apiSuccess(null, '记录成功'))
}

export const recordMood = async (req: AuthRequest, res: Response) => {
  try {
    if (!req) {
      return res.status(401).json(apiFailure(401, '未登录'))
    }
    if (!req.user) {
      return res.status(401).json(apiFailure(401, '未登录'))
    }
    if (req.body.emotions && Array.isArray(req.body.emotions) && req.body.emotions.length > 0) {
      return recordMoodWithEmotions(req, res)
    }
    return recordMoodLegacy(req, res)
  } catch (error) {
    logger.error('记录情绪失败', { error: error instanceof Error ? error.message : 'unknown_error', userId: req?.user?.userId })
    res.status(500).json(apiFailure(500, '服务器错误'))
  }
}
export const getMoodList = async (req: AuthRequest, res: Response) => {
  try {
    if (!req) {
      return res.status(401).json(apiFailure(401, '未登录'))
    }
    if (!req.user) {
      return res.status(401).json(apiFailure(401, '未登录'))
    }
    const userId = req.user.userId
    const page = parseInt(req.query.page as string) || 1
    const limit = parseInt(req.query.size as string) || parseInt(req.query.limit as string) || 20
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
    logger.error('获取情绪列表失败', { error: error instanceof Error ? error.message : 'unknown_error', userId: req?.user?.userId })
    res.status(500).json(apiFailure(500, '服务器错误'))
  }
}
export const getWeeklyReportHandler = async (req: AuthRequest, res: Response) => {
  try {
    if (!req) {
      return res.status(401).json(apiFailure(401, '未登录'))
    }
    if (!req.user) {
      return res.status(401).json(apiFailure(401, '未登录'))
    }
    const userId = req.user.userId
    const report = await moodService.getWeeklyReport(userId)
    res.json(apiSuccess(report, '获取情绪周报成功'))
  } catch (error) {
    logger.error('获取周报失败', { error: error instanceof Error ? error.message : 'unknown_error', userId: req?.user?.userId })
    res.status(500).json(apiFailure(500, '服务器错误'))
  }
}

export const updateMoodHandler = async (req: AuthRequest, res: Response) => {
  try {
    if (!req) {
      return res.status(401).json(apiFailure(401, '未登录'))
    }
    if (!req.user) {
      return res.status(401).json(apiFailure(401, '未登录'))
    }
    const userId = req.user.userId
    const moodId = parseInt(req.params.id as string)
    const { moodType, intensity, note, event, tags, trigger, emotions, tagIds, recordDate } = req.body

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
        recordedAt: new Date(`${date}T00:00:00.000Z`),
        emotions,
        tagIds: tagIds || [],
      })

      if (!updated) {
        return res.status(404).json(apiFailure(404, '记录不存在'))
      }

      await clearMoodCache(userId)
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
    const resolvedTags = await Promise.all(tagNames.map((name) => moodService.createOrGetTag(name, userId)))

    const updated = await moodService.updateMood({
      id: moodId,
      userId,
      note: event ?? note ?? '',
      trigger: trigger || '',
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

    await clearMoodCache(userId)
    res.json(apiSuccess(null, '更新成功'))
  } catch (error) {
    logger.error('更新情绪记录失败', { error: error instanceof Error ? error.message : 'unknown_error', userId: req?.user?.userId })
    res.status(500).json(apiFailure(500, '服务器错误'))
  }
}

export const deleteMoodHandler = async (req: AuthRequest, res: Response) => {
  try {
    if (!req) {
      return res.status(401).json(apiFailure(401, '未登录'))
    }
    if (!req.user) {
      return res.status(401).json(apiFailure(401, '未登录'))
    }
    const userId = req.user.userId
    const moodId = parseInt(req.params.id as string)

    if (!Number.isInteger(moodId) || moodId <= 0) {
      return res.status(400).json(apiFailure(400, '无效的记录 ID'))
    }

    const deleted = await moodService.deleteMood(userId, moodId)

    if (!deleted) {
      return res.status(404).json(apiFailure(404, '记录不存在'))
    }

    await clearMoodCache(userId)
    res.json(apiSuccess(null, '删除成功'))
  } catch (error) {
    logger.error('删除情绪记录失败', { error: error instanceof Error ? error.message : 'unknown_error', userId: req?.user?.userId })
    res.status(500).json(apiFailure(500, '服务器错误'))
  }
}

export const getMoodTrend = async (req: AuthRequest, res: Response) => {
  try {
    if (!req) {
      return res.status(401).json(apiFailure(401, '未登录'))
    }
    if (!req.user) {
      return res.status(401).json(apiFailure(401, '未登录'))
    }
    const userId = req.user.userId
    const range = (req.query.range as string) || 'week'

    if (!['week', 'month', 'quarter'].includes(range)) {
      return res.status(400).json(apiFailure(400, '无效的时间范围'))
    }

    const trendData = await moodService.getMoodTrend(userId, range as 'week' | 'month' | 'quarter')
    res.json(apiSuccess(trendData, '获取情绪趋势成功'))
  } catch (error) {
    logger.error('获取情绪趋势失败', { error: error instanceof Error ? error.message : 'unknown_error', userId: req?.user?.userId })
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
    logger.error('获取情绪类型失败', { error })
    res.status(500).json(apiFailure(500, '服务器错误'))
  }
}

export const getTagsHandler = async (req: AuthRequest, res: Response) => {
  try {
    if (!req) {
      return res.status(401).json(apiFailure(401, '未登录'))
    }
    if (!req.user) {
      return res.status(401).json(apiFailure(401, '未登录'))
    }
    const userId = req.user.userId
    const tags = await moodService.listTags(userId)
    res.json(apiSuccess(tags, '获取成功'))
  } catch (error) {
    logger.error('获取标签失败', { error, userId: req?.user?.userId })
    res.status(500).json(apiFailure(500, '服务器错误'))
  }
}

export const createTagHandler = async (req: AuthRequest, res: Response) => {
  try {
    if (!req) {
      return res.status(401).json(apiFailure(401, '未登录'))
    }
    if (!req.user) {
      return res.status(401).json(apiFailure(401, '未登录'))
    }
    const userId = req.user.userId
    const { name } = req.body

    if (!name || typeof name !== 'string') {
      return res.status(400).json(apiFailure(400, '标签名称不能为空'))
    }

    const tag = await moodService.createOrGetTag(name.trim(), userId)
    res.status(201).json(apiSuccess(tag, '创建成功'))
  } catch (error) {
    logger.error('创建标签失败', { error, userId: req?.user?.userId })
    res.status(500).json(apiFailure(500, '服务器错误'))
  }
}

export const getMoodAnalysisHandler = async (req: AuthRequest, res: Response) => {
  try {
    if (!req) {
      return res.status(401).json(apiFailure(401, '未登录'))
    }
    if (!req.user) {
      return res.status(401).json(apiFailure(401, '未登录'))
    }
    const userId = req.user.userId
    const range = (req.query.range as string) || 'month'

    if (!['week', 'month', 'quarter'].includes(range)) {
      return res.status(400).json(apiFailure(400, '无效的时间范围'))
    }

    const analysis = await moodService.getMoodAnalysis(userId, range as 'week' | 'month' | 'quarter')
    res.json(apiSuccess(analysis, '获取情绪统计成功'))
  } catch (error) {
    logger.error('获取情绪分析失败', { error: error instanceof Error ? error.message : 'unknown_error', userId: req?.user?.userId })
    res.status(500).json(apiFailure(500, '服务器错误'))
  }
}

