import { createMoodRepository, MoodEmotionInput, MoodRepository } from '../repositories/moodRepository'
import { BusinessError } from '../utils/errors'

type EncryptField = (value: string | null | undefined) => string | null
type DecryptField = (value: string | null | undefined) => string | null
type NowProvider = () => Date

export interface RecordMoodEmotionInput {
  emotionTypeId: number
  intensity: number
  isPrimary?: boolean
}

export interface RecordMoodInput {
  userId: number
  note: string | null
  trigger: string | null
  recordedAt: Date
  emotions: RecordMoodEmotionInput[]
  tagIds: number[]
}

export interface UpdateMoodServiceInput extends RecordMoodInput {
  id: number
}

interface MoodServiceDependencies {
  repository?: MoodRepository
  encryptField?: EncryptField
  decryptField?: DecryptField
  now?: NowProvider
}

export interface ListMoodOptions {
  page: number
  limit: number
  emotionTypeId?: number
}

export type MoodTrendRange = 'week' | 'month' | 'quarter'

const normalizeEmotions = (emotions: RecordMoodEmotionInput[]): MoodEmotionInput[] => {
  if (!Array.isArray(emotions) || emotions.length === 0) {
    throw new BusinessError('至少需要选择一种情绪')
  }

  let primaryCount = 0
  const normalized = emotions.map((emotion, index) => {
    if (!Number.isInteger(emotion.emotionTypeId) || emotion.emotionTypeId <= 0) {
      throw new BusinessError('情绪类型无效')
    }

    if (!Number.isInteger(emotion.intensity) || emotion.intensity < 1 || emotion.intensity > 10) {
      throw new BusinessError('情绪强度必须在 1-10 之间')
    }

    const isPrimary = emotion.isPrimary ?? index === 0
    if (isPrimary) {
      primaryCount += 1
    }

    return {
      emotionTypeId: emotion.emotionTypeId,
      intensity: emotion.intensity,
      isPrimary,
    }
  })

  if (primaryCount > 1) {
    throw new BusinessError('一条情绪记录最多只能有一个主要情绪')
  }

  return normalized
}

const toDateString = (date: Date): string => date.toISOString().split('T')[0]

const resolveTrendStartDate = (endDate: Date, range: MoodTrendRange): string => {
  const days = range === 'quarter' ? 90 : range === 'month' ? 30 : 7
  const startDate = new Date(endDate)
  startDate.setUTCDate(startDate.getUTCDate() - days)
  return toDateString(startDate)
}

const buildTrendSummary = (values: number[]): string => {
  if (values.length === 0) {
    return '该时间范围内没有情绪记录。'
  }

  const average = values.reduce((sum, value) => sum + value, 0) / values.length
  return `近期情绪记录平均强度为 ${Number(average.toFixed(1))}，请结合记录内容持续观察变化。`
}

const roundOneDecimal = (value: number): number => Number(value.toFixed(1))

export const createMoodService = (dependencies: MoodServiceDependencies = {}) => {
  const repository = dependencies.repository ?? createMoodRepository()
  const now = dependencies.now ?? (() => new Date())
  const encryptField =
    dependencies.encryptField ??
    ((value: string | null | undefined) => {
      const { encryptField: encryptFieldUtil } = require('../utils/encryption') as {
        encryptField: EncryptField
      }
      return encryptFieldUtil(value)
    })
  const decryptField =
    dependencies.decryptField ??
    ((value: string | null | undefined) => {
      const { decryptField: decryptFieldUtil } = require('../utils/encryption') as {
        decryptField: DecryptField
      }
      return decryptFieldUtil(value)
    })

  const recordMood = async (input: RecordMoodInput): Promise<number> => {
    const emotions = normalizeEmotions(input.emotions)

    return repository.createMood({
      userId: input.userId,
      noteCiphertext: encryptField(input.note),
      triggerCiphertext: encryptField(input.trigger),
      recordedAt: input.recordedAt,
      emotions,
      tagIds: input.tagIds,
    })
  }

  const listMoods = async (userId: number, options: ListMoodOptions) => {
    const shouldFilterByEmotion =
      Number.isInteger(options.emotionTypeId) && Number(options.emotionTypeId) > 0
    const [moods, total] = await Promise.all([
      shouldFilterByEmotion
        ? repository.listByUserAndEmotionType(userId, Number(options.emotionTypeId), options)
        : repository.listByUser(userId, options),
      shouldFilterByEmotion
        ? repository.countByUserAndEmotionType(userId, Number(options.emotionTypeId))
        : repository.countByUser(userId),
    ])

    return {
      list: moods.map((mood) => ({
        id: mood.id.toString(),
        userId: mood.userId.toString(),
        moodType: mood.emotions.map((emotion) => emotion.name),
        moodRatio: mood.emotions.map((emotion) => emotion.intensity * 10),
        emotions: mood.emotions.map((emotion) => ({
          emotionTypeId: emotion.emotionTypeId,
          name: emotion.name,
          icon: emotion.icon,
          intensity: emotion.intensity,
          isPrimary: emotion.isPrimary,
        })),
        tags: mood.tags.map((tag) => tag.name),
        tagIds: mood.tags.map((tag) => tag.id),
        event: decryptField(mood.noteCiphertext) || '',
        trigger: decryptField(mood.triggerCiphertext) || '',
        createTime: mood.createdAt.toISOString(),
      })),
      total,
      page: options.page,
      limit: options.limit,
    }
  }

  const updateMood = async (input: UpdateMoodServiceInput): Promise<boolean> => {
    const emotions = normalizeEmotions(input.emotions)

    return repository.updateMood({
      id: input.id,
      userId: input.userId,
      noteCiphertext: encryptField(input.note),
      triggerCiphertext: encryptField(input.trigger),
      recordedAt: input.recordedAt,
      emotions,
      tagIds: input.tagIds,
    })
  }

  const deleteMood = async (userId: number, moodId: number): Promise<boolean> => {
    return repository.deleteMood(userId, moodId)
  }

  const listEmotionTypes = async () => {
    const emotionTypes = await repository.listEmotionTypes()

    return emotionTypes.map((type) => ({
      id: type.id,
      name: type.name,
      icon: type.icon,
      category: type.category,
    }))
  }

  const listTags = async (userId: number) => {
    const tags = await repository.listTags(userId)

    return tags.map((tag) => ({
      id: tag.id,
      name: tag.name,
      user_id: tag.userId,
      is_system: tag.isSystem,
    }))
  }

  const createOrGetTag = async (name: string, userId: number) => {
    const trimmedName = name.trim()
    const id = await repository.createOrGetTag(trimmedName, userId)

    return { id, name: trimmedName }
  }

  const getMoodTrend = async (userId: number, range: MoodTrendRange) => {
    const end = now()
    const endDate = toDateString(end)
    const startDate = resolveTrendStartDate(end, range)
    const rows = await repository.listTrendRows(userId, startDate, endDate)
    const labels = Array.from(new Set(rows.map((row) => row.date))).sort()
    const emotionNames = Array.from(new Set(rows.map((row) => row.emotionName)))
    const datasets = emotionNames.map((emotionName) => ({
      name: emotionName,
      data: labels.map((date) => {
        const row = rows.find(
          (item) => item.date === date && item.emotionName === emotionName
        )
        return row ? row.averageIntensity : null
      }),
    }))

    return {
      labels,
      datasets,
      summary: buildTrendSummary(rows.map((row) => row.averageIntensity)),
    }
  }

  const getWeeklyReport = async (userId: number) => {
    const end = now()
    const endDate = toDateString(end)
    const startDate = resolveTrendStartDate(end, 'week')
    const rows = await repository.listWeeklyRows(userId, startDate, endDate)

    if (rows.length === 0) {
      return {
        averageIntensity: 0,
        dailyData: [],
        mostFrequentMood: '',
        summary: '本周暂无情绪记录。',
      }
    }

    const totalCount = rows.reduce((sum, row) => sum + row.recordCount, 0)
    const weightedIntensitySum = rows.reduce(
      (sum, row) => sum + row.averageIntensity * row.recordCount,
      0
    )
    const averageIntensity = roundOneDecimal(weightedIntensitySum / totalCount)
    const dailyMap = new Map<string, { intensitySum: number; count: number }>()
    const emotionCounts = new Map<string, number>()

    for (const row of rows) {
      const daily = dailyMap.get(row.date) ?? { intensitySum: 0, count: 0 }
      daily.intensitySum += row.averageIntensity * row.recordCount
      daily.count += row.recordCount
      dailyMap.set(row.date, daily)
      emotionCounts.set(row.emotionName, (emotionCounts.get(row.emotionName) ?? 0) + row.recordCount)
    }

    const dailyData = Array.from(dailyMap.entries())
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([date, value]) => ({
        date,
        averageIntensity: roundOneDecimal(value.intensitySum / value.count),
      }))
    const mostFrequentMood =
      Array.from(emotionCounts.entries()).sort((left, right) => right[1] - left[1])[0]?.[0] ?? ''

    return {
      averageIntensity,
      dailyData,
      mostFrequentMood,
      summary: `本周共记录 ${totalCount} 次情绪，平均强度为 ${averageIntensity}，请结合具体事件持续观察变化。`,
    }
  }

  return {
    recordMood,
    listMoods,
    updateMood,
    deleteMood,
    listEmotionTypes,
    listTags,
    createOrGetTag,
    getMoodTrend,
    getWeeklyReport,
  }
}

export type MoodService = ReturnType<typeof createMoodService>
