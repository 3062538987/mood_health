import { createMoodRepository, MoodEmotionInput, MoodRepository } from '../repositories/moodRepository'
import { BusinessError } from '../utils/errors'
import { encryptField as encryptFieldUtil, decryptField as decryptFieldUtil } from '../utils/encryption'

// 情绪类型内存缓存（几乎不变的数据）
let emotionTypesCache: { data: Array<{ id: number; name: string; code: string; icon: string | null; category: string | null }>; timestamp: number } | null = null
const EMOTION_TYPES_CACHE_TTL = 10 * 60 * 1000 // 10 分钟

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
  includeNote: boolean
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
type EmotionCategory = 'positive' | 'negative' | 'neutral'

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
const roundTwoDecimals = (value: number): number => Number(value.toFixed(2))

const EMOTION_COLORS: Record<string, string> = {
  positive: '#52c41a',
  negative: '#f5222d',
  neutral: '#1890ff',
}

const EMOTION_COLOR_LIST = [
  '#52c41a', '#1890ff', '#fa8c16', '#722ed1', '#f5222d',
  '#13c2c2', '#eb2f96', '#a0d911', '#faad14', '#2f54eb',
]

const resolvePeriodRange = (period: 'day' | 'week' | 'month' | 'year'): { startDate: string; endDate: string } => {
  const now = new Date()
  const endDate = now.toISOString().split('T')[0]
  const start = new Date(now)

  switch (period) {
    case 'day':
      start.setDate(start.getDate())
      break
    case 'week':
      start.setDate(start.getDate() - 7)
      break
    case 'month':
      start.setDate(start.getDate() - 30)
      break
    case 'year':
      start.setMonth(start.getMonth() - 12)
      break
  }

  return { startDate: start.toISOString().split('T')[0], endDate }
}

const buildAnalysisRecommendations = (
  negativeRatio: number,
  trendDirection: 'improving' | 'declining' | 'stable',
  consecutiveLowDays: number
): string[] => {
  const recommendations = ['继续保持情绪记录习惯，结合具体事件观察变化。']

  if (negativeRatio >= 0.6) {
    recommendations.push('近期负向情绪占比较高，建议安排放松、运动或与可信任的人交流。')
  }

  if (trendDirection === 'declining') {
    recommendations.push('近期情绪强度呈下降趋势，建议回顾近期压力来源并适当调整节奏。')
  }

  if (consecutiveLowDays >= 3) {
    recommendations.push('连续多天出现低强度负向情绪，建议及时寻求辅导员或专业人员支持。')
  }

  return recommendations
}

export const createMoodService = (dependencies: MoodServiceDependencies = {}) => {
  const repository = dependencies.repository ?? createMoodRepository()
  const now = dependencies.now ?? (() => new Date())
  const encryptField =
    dependencies.encryptField ?? encryptFieldUtil
  const decryptField =
    dependencies.decryptField ?? decryptFieldUtil

  const recordMood = async (input: RecordMoodInput): Promise<{ recordId: number; analysisJob: { id: number; status: string } | null }> => {
    const emotions = normalizeEmotions(input.emotions)

    const result = await repository.createMood({
      userId: input.userId,
      noteCiphertext: encryptField(input.note),
      triggerCiphertext: encryptField(input.trigger),
      includeNote: input.includeNote,
      recordedAt: input.recordedAt,
      emotions,
      tagIds: input.tagIds,
    })

    return {
      recordId: result.moodId,
      analysisJob: null,
    }
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
      includeNote: input.includeNote,
      recordedAt: input.recordedAt,
      emotions,
      tagIds: input.tagIds,
    })
  }

  const deleteMood = async (userId: number, moodId: number): Promise<boolean> => {
    return repository.deleteMood(userId, moodId)
  }

  const listEmotionTypes = async () => {
    // 使用内存缓存减少数据库查询
    const now = Date.now()
    if (emotionTypesCache && (now - emotionTypesCache.timestamp) < EMOTION_TYPES_CACHE_TTL) {
      return emotionTypesCache.data
    }

    const emotionTypes = await repository.listEmotionTypes()

    const data = emotionTypes.map((type) => ({
      id: type.id,
      code: type.code,
      name: type.name,
      icon: type.icon,
      category: type.category,
    }))

    emotionTypesCache = { data, timestamp: now }
    return data
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
    const normalizedName = name.trim()
    if (!normalizedName) {
      throw new BusinessError('标签名称不能为空')
    }
    const id = await repository.createOrGetTag(normalizedName, userId)
    return { id, name: normalizedName }
  }

  const createOrGetTagsBatch = async (names: string[], userId: number) => {
    return repository.createOrGetTagsBatch(names, userId)
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

  const getMoodAnalysis = async (userId: number, range: 'week' | 'month') => {
    const end = now()
    const endDate = toDateString(end)
    const startDate = resolveTrendStartDate(end, range)
    const rows = await repository.listAnalysisRows(userId, startDate, endDate)

    if (rows.length === 0) {
      return {
        avgIntensity: 0,
        positiveRatio: 0,
        negativeRatio: 0,
        neutralRatio: 0,
        consecutiveLowDays: 0,
        dominantEmotion: null,
        emotionDistribution: [],
        triggerStats: {},
        recommendations: ['继续记录情绪，积累足够数据后再查看统计分析。'],
        trendDirection: 'stable' as const,
        recordCount: 0,
        dateRange: { start: startDate, end: endDate },
      }
    }

    const recordCount = rows.length
    const avgIntensity = roundTwoDecimals(rows.reduce((sum, row) => sum + row.intensity, 0) / recordCount)
    const categoryCounts: Record<EmotionCategory, number> = { positive: 0, negative: 0, neutral: 0 }
    const emotionCounts = new Map<string, number>()
    const triggerStats: Record<string, Record<string, number>> = {}

    for (const row of rows) {
      categoryCounts[row.emotionCategory] += 1
      emotionCounts.set(row.emotionName, (emotionCounts.get(row.emotionName) ?? 0) + 1)
      const trigger = decryptField(row.triggerCiphertext)?.trim()
      if (trigger) {
        const emotions = triggerStats[trigger] ?? {}
        emotions[row.emotionName] = (emotions[row.emotionName] ?? 0) + 1
        triggerStats[trigger] = emotions
      }
    }

    const emotionDistribution = Array.from(emotionCounts.entries())
      .map(([name, count]) => ({ name, count, percentage: roundTwoDecimals(count / recordCount) }))
      .sort((left, right) => right.count - left.count || left.name.localeCompare(right.name))
    const dominantEmotion = emotionDistribution[0]?.name ?? null

    const dailyIntensity = new Map<string, number[]>()
    for (const row of rows) {
      const values = dailyIntensity.get(row.date) ?? []
      values.push(row.intensity)
      dailyIntensity.set(row.date, values)
    }
    const dailyAverages = Array.from(dailyIntensity.entries())
      .map(([date, values]) => ({ date, value: values.reduce((sum, value) => sum + value, 0) / values.length }))
      .sort((left, right) => left.date.localeCompare(right.date))

    let consecutiveLowDays = 0
    for (let index = dailyAverages.length - 1; index >= 0 && dailyAverages[index].value < 5; index -= 1) {
      consecutiveLowDays += 1
    }

    const midpoint = Math.max(1, Math.floor(dailyAverages.length / 2))
    const averageSlice = (items: typeof dailyAverages) =>
      items.length === 0 ? 0 : items.reduce((sum, item) => sum + item.value, 0) / items.length
    const intensityChange = averageSlice(dailyAverages.slice(midpoint)) - averageSlice(dailyAverages.slice(0, midpoint))
    const trendDirection: 'improving' | 'declining' | 'stable' =
      intensityChange > 0.5 ? 'improving' : intensityChange < -0.5 ? 'declining' : 'stable'
    const negativeRatio = roundTwoDecimals(categoryCounts.negative / recordCount)

    return {
      avgIntensity,
      positiveRatio: roundTwoDecimals(categoryCounts.positive / recordCount),
      negativeRatio,
      neutralRatio: roundTwoDecimals(categoryCounts.neutral / recordCount),
      consecutiveLowDays,
      dominantEmotion,
      emotionDistribution,
      triggerStats,
      recommendations: buildAnalysisRecommendations(negativeRatio, trendDirection, consecutiveLowDays),
      trendDirection,
      recordCount,
      dateRange: { start: startDate, end: endDate },
    }
  }

  const getPeriodComparison = async (userId: number, period: 'week' | 'month') => {
    const rows = await repository.getPeriodComparison(userId, period)
    const currentRow = rows.find((r) => r.period_label === 'current')
    const previousRow = rows.find((r) => r.period_label === 'previous')

    const thisPeriod = {
      count: currentRow?.record_count ?? 0,
      avgIntensity: currentRow?.avg_intensity ?? 0,
    }
    const lastPeriod = {
      count: previousRow?.record_count ?? 0,
      avgIntensity: previousRow?.avg_intensity ?? 0,
    }

    const countChange = lastPeriod.count > 0
      ? roundTwoDecimals((thisPeriod.count - lastPeriod.count) / lastPeriod.count)
      : thisPeriod.count > 0 ? 1 : 0
    const intensityDiff = roundOneDecimal(thisPeriod.avgIntensity - lastPeriod.avgIntensity)

    const changeDescription = thisPeriod.count === 0 && lastPeriod.count === 0
      ? '两个周期均无记录，开始记录后可查看趋势对比。'
      : lastPeriod.count === 0
        ? `本期新增 ${thisPeriod.count} 条记录，暂无上期数据可对比。`
        : thisPeriod.count === 0
          ? '本期暂无记录。'
          : countChange > 0
            ? `记录次数较上期增加 ${Math.round(countChange * 100)}%，平均强度变化 ${intensityDiff >= 0 ? '+' : ''}${intensityDiff}`
            : countChange < 0
              ? `记录次数较上期减少 ${Math.round(Math.abs(countChange) * 100)}%，平均强度变化 ${intensityDiff >= 0 ? '+' : ''}${intensityDiff}`
              : `记录次数与上期持平，平均强度变化 ${intensityDiff >= 0 ? '+' : ''}${intensityDiff}`

    return {
      thisPeriod,
      lastPeriod,
      change: {
        countRate: countChange,
        intensityDiff,
      },
      changeDescription,
    }
  }

  const getMoodInsight = async (
    userId: number,
    period: 'day' | 'week' | 'month' | 'year'
  ) => {
    const { startDate, endDate } = resolvePeriodRange(period)
    const rows = await repository.getInsightData(userId, startDate, endDate)

    if (rows.length === 0) {
      return {
        summary: { totalDays: 0, totalRecords: 0, mainEmotion: '', mainEmotionCode: '', avgIntensity: 0 },
        distribution: [],
        trend: [],
        polarity: { positive: 0, neutral: 0, negative: 0 },
        periodComparison: [],
      }
    }

    // 合并单次遍历：同时计算概览、情绪分布、趋势、极性、周期对比
    let totalRecords = 0
    let totalIntensity = 0
    const dateSet = new Set<string>()
    const emotionMap = new Map<string, { name: string; code: string; icon: string; category: string; count: number; totalIntensity: number }>()
    const dateMap = new Map<string, { intensities: number[]; emotions: string[]; count: number }>()
    let positive = 0, neutral = 0, negative = 0
    const weekMap = new Map<string, { positive: number; neutral: number; negative: number }>()

    for (const row of rows) {
      totalRecords += row.recordCount
      totalIntensity += row.avgIntensity * row.recordCount
      dateSet.add(row.date)

      // 情绪分布
      const emotionKey = row.emotionName
      const existing = emotionMap.get(emotionKey) || { name: row.emotionName, code: row.emotionCode, icon: row.emotionIcon, category: row.emotionCategory, count: 0, totalIntensity: 0 }
      existing.count += row.recordCount
      existing.totalIntensity += row.avgIntensity * row.recordCount
      emotionMap.set(emotionKey, existing)

      // 趋势
      const d = dateMap.get(row.date) || { intensities: [], emotions: [], count: 0 }
      d.intensities.push(row.avgIntensity)
      d.emotions.push(row.emotionName)
      d.count += row.recordCount
      dateMap.set(row.date, d)

      // 极性
      if (row.emotionCategory === 'positive') positive += row.recordCount
      else if (row.emotionCategory === 'negative') negative += row.recordCount
      else neutral += row.recordCount

      // 周期对比
      const dObj = new Date(row.date)
      const weekLabel = `第${Math.ceil((dObj.getDate()) / 7)}周`
      const w = weekMap.get(weekLabel) || { positive: 0, neutral: 0, negative: 0 }
      if (row.emotionCategory === 'positive') w.positive += row.recordCount
      else if (row.emotionCategory === 'negative') w.negative += row.recordCount
      else w.neutral += row.recordCount
      weekMap.set(weekLabel, w)
    }

    const avgIntensity = roundOneDecimal(totalIntensity / totalRecords)

    const emotionList = Array.from(emotionMap.values()).sort((a, b) => b.count - a.count)
    const mainEmotion = emotionList[0]
    const distribution = emotionList.map((e, i) => ({
      name: e.name,
      code: e.code,
      icon: e.icon,
      count: e.count,
      percent: roundTwoDecimals(e.count / totalRecords * 100),
      color: EMOTION_COLORS[e.category] || EMOTION_COLOR_LIST[i % EMOTION_COLOR_LIST.length],
    }))

    const trend = Array.from(dateMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, val]) => {
        const dayAvg = roundOneDecimal(val.intensities.reduce((s, v) => s + v, 0) / val.intensities.length)
        const emotionCounts = new Map<string, number>()
        val.emotions.forEach((e) => emotionCounts.set(e, (emotionCounts.get(e) || 0) + 1))
        let dominantEmotion = ''
        let maxCount = 0
        emotionCounts.forEach((count, name) => {
          if (count > maxCount) { maxCount = count; dominantEmotion = name }
        })
        return { date, avgIntensity: dayAvg, dominantEmotion, recordCount: val.count }
      })

    const total = positive + neutral + negative
    const polarity = {
      positive: total > 0 ? Math.round((positive / total) * 100) : 0,
      neutral: total > 0 ? Math.round((neutral / total) * 100) : 0,
      negative: total > 0 ? Math.round((negative / total) * 100) : 0,
    }

    const periodComparison = Array.from(weekMap.entries()).map(([label, val]) => ({ label, ...val }))

    return {
      summary: {
        totalDays: dateSet.size,
        totalRecords,
        mainEmotion: mainEmotion?.name || '',
        mainEmotionCode: mainEmotion?.code || '',
        avgIntensity,
      },
      distribution,
      trend,
      polarity,
      periodComparison,
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
    createOrGetTagsBatch,
    getMoodTrend,
    getWeeklyReport,
    getMoodAnalysis,
    getPeriodComparison,
    getMoodInsight,
  }
}

export type MoodService = ReturnType<typeof createMoodService>
