import { Response } from 'express'
import { AuthRequest } from '../middleware/auth'
import {
  createMood,
  createMoodWithRelations,
  getMoodsByUser,
  getMoodsWithRelations,
  findMoodById,
  findMoodWithRelationsById,
  updateMood,
} from '../models/moodModel'
import { createAdviceHistory, getAdviceHistoryByUser } from '../models/adviceModel'
import { clearMoodCache } from '../utils/cache'
import logger from '../utils/logger'
import { apiFailure, apiSuccess } from '../utils/apiResponse'
import { createMoodService } from '../services/moodService'

const moodService = createMoodService()

export const recordMood = async (req: AuthRequest, res: Response) => {
  try {
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
      emotions,
      tagIds,
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

    const rawIntensity = Array.isArray(moodRatio)
      ? moodRatio[0]
      : (moodRatio ?? intensity ?? intensity_score ?? level)

    if (!moodType || rawIntensity === undefined) {
      return res.status(400).json(apiFailure(400, '情绪类型和强度为必填'))
    }

    const moodTypeStr = Array.isArray(moodType) ? moodType.join(',') : moodType
    const resolvedIntensity = Number(rawIntensity)

    if (!Number.isFinite(resolvedIntensity) || resolvedIntensity < 1 || resolvedIntensity > 10) {
      return res.status(400).json(apiFailure(400, '强度必须在1-10之间'))
    }

    const date = recordDate || new Date().toISOString().split('T')[0]
    const tagsStr = Array.isArray(tags) ? tags.join(',') : tags || ''

    await createMood(
      userId,
      moodTypeStr,
      resolvedIntensity,
      event || '',
      tagsStr,
      trigger || '',
      date
    )
    await clearMoodCache(userId)
    res.status(201).json(apiSuccess(null, '记录成功'))
  } catch (error) {
    console.error(error)
    res.status(500).json(apiFailure(500, '服务器错误'))
  }
}

export const getMoodList = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId
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
    console.error(error)
    res.status(500).json(apiFailure(500, '服务器错误'))
  }
}

export const getWeeklyReportHandler = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId
    const report = await moodService.getWeeklyReport(userId)
    res.json(apiSuccess(report, '获取情绪周报成功'))
  } catch (error) {
    console.error(error)
    res.status(500).json(apiFailure(500, '服务器错误'))
  }
}

export const updateMoodHandler = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId
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

    const moodTypeStr = Array.isArray(moodType) ? moodType.join(',') : moodType
    const tagsStr = Array.isArray(tags) ? tags.join(',') : tags || ''

    const mood = await findMoodById(moodId, userId)
    if (!mood) {
      return res.status(404).json(apiFailure(404, '记录不存在'))
    }

    const updated = await updateMood(
      moodId,
      moodTypeStr || mood.mood_type,
      intensity || mood.intensity,
      note || '',
      tagsStr,
      trigger || '',
      userId
    )

    if (!updated) {
      return res.status(404).json(apiFailure(404, '记录不存在'))
    }

    await clearMoodCache(userId)
    res.json(apiSuccess(null, '更新成功'))
  } catch (error) {
    console.error(error)
    res.status(500).json(apiFailure(500, '服务器错误'))
  }
}

export const deleteMoodHandler = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId
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
    console.error(error)
    res.status(500).json(apiFailure(500, '服务器错误'))
  }
}

export const getMoodTrend = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId
    const range = (req.query.range as string) || 'week'

    if (!['week', 'month', 'quarter'].includes(range)) {
      return res.status(400).json(apiFailure(400, '无效的时间范围'))
    }

    const trendData = await moodService.getMoodTrend(userId, range as 'week' | 'month' | 'quarter')
    res.json(apiSuccess(trendData, '获取情绪趋势成功'))
  } catch (error) {
    console.error(error)
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
    res.json({ code: 0, data: formattedTypes, message: '获取成功' })
  } catch (error) {
    console.error(error)
    res.status(500).json({ code: 500, message: '服务器错误' })
  }
}

export const getTagsHandler = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId
    const tags = await moodService.listTags(userId)
    res.json({ code: 0, data: tags, message: '获取成功' })
  } catch (error) {
    console.error(error)
    res.status(500).json({ code: 500, message: '服务器错误' })
  }
}

export const createTagHandler = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId
    const { name } = req.body

    if (!name || typeof name !== 'string') {
      return res.status(400).json({ code: 400, message: '标签名称不能为空' })
    }

    const tag = await moodService.createOrGetTag(name.trim(), userId)
    res.status(201).json({
      code: 0,
      data: tag,
      message: '创建成功',
    })
  } catch (error) {
    console.error(error)
    res.status(500).json({ code: 500, message: '服务器错误' })
  }
}

export const getMoodAnalysisHandler = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId
    const range = (req.query.range as string) || 'month'

    if (!['week', 'month', 'quarter'].includes(range)) {
      return res.status(400).json(apiFailure(400, '无效的时间范围'))
    }

    const analysis = await moodService.getMoodAnalysis(userId, range as 'week' | 'month' | 'quarter')
    res.json(apiSuccess(analysis, '获取情绪统计成功'))
  } catch (error) {
    console.error(error)
    res.status(500).json(apiFailure(500, '服务器错误'))
  }
}

export const saveAdviceHandler = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId
    const { moodRecordId, analysis, suggestions } = req.body

    if (!analysis || typeof analysis !== 'string') {
      return res.status(400).json({ code: 400, message: '分析内容不能为空' })
    }

    if (!suggestions || !Array.isArray(suggestions)) {
      return res.status(400).json({ code: 400, message: '建议列表不能为空' })
    }

    const normalizedMoodRecordId =
      moodRecordId === undefined || moodRecordId === null ? undefined : Number(moodRecordId)
    if (
      normalizedMoodRecordId !== undefined &&
      (!Number.isInteger(normalizedMoodRecordId) || normalizedMoodRecordId <= 0)
    ) {
      return res.status(400).json({ code: 400, message: 'moodRecordId 必须是正整数' })
    }

    await createAdviceHistory(userId, normalizedMoodRecordId, analysis, suggestions)
    res.status(201).json({ code: 0, message: '保存成功' })
  } catch (error) {
    const err = error as {
      message?: string
      originalError?: { info?: { message?: string } }
    }
    const dbMessage = err.originalError?.info?.message || err.message || '未知异常'

    logger.error('saveAdviceHandler 执行失败', {
      userId: req.user?.userId,
      body: {
        moodRecordId: req.body?.moodRecordId,
        analysisLength: typeof req.body?.analysis === 'string' ? req.body.analysis.length : 0,
        suggestionsCount: Array.isArray(req.body?.suggestions) ? req.body.suggestions.length : 0,
      },
      dbMessage,
      error,
    })

    const message =
      dbMessage.includes('FOREIGN KEY') || dbMessage.includes('REFERENCE')
        ? '关联的心情记录不存在，无法保存建议'
        : 'AI 建议保存失败，请稍后重试'
    res.status(500).json({ code: 500, message })
  }
}

export const getAdviceHistoryHandler = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId
    const page = parseInt(req.query.page as string) || 1
    const pageSize = parseInt(req.query.pageSize as string) || 20

    const result = await getAdviceHistoryByUser(userId, page, pageSize)
    res.json({ code: 0, data: result })
  } catch (error) {
    const err = error as {
      message?: string
      originalError?: { info?: { message?: string } }
    }
    const dbMessage = err.originalError?.info?.message || err.message || '未知异常'

    logger.error('getAdviceHistoryHandler 执行失败', {
      userId: req.user?.userId,
      page: req.query.page,
      pageSize: req.query.pageSize,
      dbMessage,
      error,
    })

    res.status(500).json({ code: 500, message: 'AI 建议历史获取失败，请稍后重试' })
  }
}
