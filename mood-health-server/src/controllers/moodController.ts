import { Response } from 'express'
import { AuthRequest } from '../middleware/auth'
import pool from '../config/database'
import sql from 'mssql'
import {
  createMood,
  createMoodWithRelations,
  getMoodsByUser,
  getMoodsWithRelations,
  getWeeklyReport,
  getMoodTrend as getMoodTrendModel,
  findMoodById,
  findMoodWithRelationsById,
  updateMood,
  updateMoodWithRelations,
  deleteMood,
  getEmotionTypes,
  getTags,
  createOrGetTag,
  getMoodsByEmotionType,
  getMoodAnalysis,
} from '../models/moodModel'
import { createAdviceHistory, getAdviceHistoryByUser } from '../models/adviceModel'
import { clearMoodCache } from '../utils/cache'
import logger from '../utils/logger'

export const recordMood = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId
    const { moodType, moodRatio, event, tags, trigger, recordDate, emotions, tagIds } = req.body

    if (emotions && Array.isArray(emotions) && emotions.length > 0) {
      for (const emotion of emotions) {
        if (!emotion.emotionTypeId || emotion.intensity === undefined) {
          return res.status(400).json({ code: 400, message: '情绪数据格式错误' })
        }
        if (emotion.intensity < 1 || emotion.intensity > 10) {
          return res.status(400).json({ code: 400, message: '强度必须在1-10之间' })
        }
      }

      const date = recordDate || new Date().toISOString().split('T')[0]
      const resolvedTagIds = tagIds || []

      await createMoodWithRelations(
        userId,
        emotions,
        event || '',
        resolvedTagIds,
        trigger || '',
        date
      )
      await clearMoodCache(userId)
      return res.status(201).json({ code: 0, message: '记录成功' })
    }

    if (!moodType || !moodRatio) {
      return res.status(400).json({ code: 400, message: '情绪类型和强度为必填' })
    }

    const moodTypeStr = Array.isArray(moodType) ? moodType.join(',') : moodType
    const intensity = moodRatio[0] || 3

    if (intensity < 1 || intensity > 10) {
      return res.status(400).json({ code: 400, message: '强度必须在1-10之间' })
    }

    const date = recordDate || new Date().toISOString().split('T')[0]
    const tagsStr = Array.isArray(tags) ? tags.join(',') : tags || ''

    await createMood(userId, moodTypeStr, intensity, event || '', tagsStr, trigger || '', date)
    await clearMoodCache(userId)
    res.status(201).json({ code: 0, message: '记录成功' })
  } catch (error) {
    console.error(error)
    res.status(500).json({ code: 500, message: '服务器错误' })
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

    let moods
    if (emotionTypeId) {
      moods = await getMoodsByEmotionType(userId, emotionTypeId, page, limit)
    } else {
      moods = await getMoodsWithRelations(userId, page, limit)
    }

    const formattedMoods = moods.map((mood) => {
      if (mood.emotions && mood.emotions.length > 0) {
        return {
          id: mood.id.toString(),
          userId: mood.user_id.toString(),
          moodType: mood.emotions.map((e) => e.emotion_name),
          moodRatio: mood.emotions.map((e) => e.intensity * 10),
          emotions: mood.emotions.map((e) => ({
            emotionTypeId: e.emotion_type_id,
            name: e.emotion_name,
            icon: e.emotion_icon,
            intensity: e.intensity,
          })),
          tags: mood.tagList ? mood.tagList.map((t) => t.name) : [],
          tagIds: mood.tagList ? mood.tagList.map((t) => t.id) : [],
          event: mood.note || '',
          trigger: mood.trigger || '',
          createTime: mood.created_at.toISOString(),
        }
      }

      return {
        id: mood.id.toString(),
        userId: mood.user_id.toString(),
        moodType: mood.mood_type ? mood.mood_type.split(',') : [],
        moodRatio: mood.intensity ? [mood.intensity * 10] : [],
        tags: mood.tags ? mood.tags.split(',') : [],
        event: mood.note || '',
        trigger: mood.trigger || '',
        createTime: mood.created_at.toISOString(),
      }
    })

    const countResult = await pool
      .request()
      .input('userId', sql.Int, userId)
      .query('SELECT COUNT(*) as total FROM moods WHERE user_id = @userId')
    const total = countResult.recordset[0].total

    res.json({ code: 0, data: { list: formattedMoods, total } })
  } catch (error) {
    console.error(error)
    res.status(500).json({ code: 500, message: '服务器错误' })
  }
}

export const getWeeklyReportHandler = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId
    const report = await getWeeklyReport(userId)
    res.json({ code: 0, data: report })
  } catch (error) {
    console.error(error)
    res.status(500).json({ code: 500, message: '服务器错误' })
  }
}

export const updateMoodHandler = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId
    const moodId = parseInt(req.params.id as string)
    const { moodType, intensity, note, tags, trigger, emotions, tagIds } = req.body

    if (!Number.isInteger(moodId) || moodId <= 0) {
      return res.status(400).json({ code: 400, message: '无效的记录 ID' })
    }

    if (emotions && Array.isArray(emotions) && emotions.length > 0) {
      for (const emotion of emotions) {
        if (emotion.intensity < 1 || emotion.intensity > 10) {
          return res.status(400).json({ code: 400, message: '强度必须在1-10之间' })
        }
      }

      const updated = await updateMoodWithRelations(
        moodId,
        emotions,
        note || '',
        tagIds || [],
        trigger || '',
        userId
      )

      if (!updated) {
        return res.status(404).json({ code: 404, message: '记录不存在' })
      }

      await clearMoodCache(userId)
      return res.json({ code: 0, message: '更新成功' })
    }

    const moodTypeStr = Array.isArray(moodType) ? moodType.join(',') : moodType
    const tagsStr = Array.isArray(tags) ? tags.join(',') : tags || ''

    const mood = await findMoodById(moodId, userId)
    if (!mood) {
      return res.status(404).json({ code: 404, message: '记录不存在' })
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
      return res.status(404).json({ code: 404, message: '记录不存在' })
    }

    await clearMoodCache(userId)
    res.json({ code: 0, message: '更新成功' })
  } catch (error) {
    console.error(error)
    res.status(500).json({ code: 500, message: '服务器错误' })
  }
}

export const deleteMoodHandler = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId
    const moodId = parseInt(req.params.id as string)

    if (!Number.isInteger(moodId) || moodId <= 0) {
      return res.status(400).json({ code: 400, message: '无效的记录 ID' })
    }

    const deleted = await deleteMood(moodId, userId)

    if (!deleted) {
      return res.status(404).json({ code: 404, message: '记录不存在' })
    }

    await clearMoodCache(userId)
    res.json({ code: 0, message: '删除成功' })
  } catch (error) {
    console.error(error)
    res.status(500).json({ code: 500, message: '服务器错误' })
  }
}

export const getMoodTrend = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId
    const range = (req.query.range as string) || 'week'

    if (!['week', 'month', 'quarter'].includes(range)) {
      return res.status(400).json({ code: 400, message: '无效的时间范围' })
    }

    const trendData = await getMoodTrendModel(userId, range)
    res.json({ code: 0, data: trendData })
  } catch (error) {
    console.error(error)
    res.status(500).json({ code: 500, message: '服务器错误' })
  }
}

export const getMoodTypes = async (req: AuthRequest, res: Response) => {
  try {
    const emotionTypes = await getEmotionTypes()
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
    const tags = await getTags(userId)
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

    const tagId = await createOrGetTag(name.trim(), userId)
    res.status(201).json({
      code: 0,
      data: { id: tagId, name: name.trim() },
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
      return res.status(400).json({ code: 400, message: '无效的时间范围' })
    }

    const analysis = await getMoodAnalysis(userId, range)
    res.json({ code: 0, data: analysis })
  } catch (error) {
    console.error(error)
    res.status(500).json({ code: 500, message: '服务器错误' })
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
