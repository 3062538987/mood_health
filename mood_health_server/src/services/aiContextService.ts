/**
 * AI 上下文聚合服务
 * 聚合用户近期情绪记录和测评结果，构建 AI 分析上下文
 */

import { createMoodRepository } from '../repositories/moodRepository'
import { createAssessmentRepository } from '../repositories/assessmentRepository'
import logger from '../utils/logger'

export interface AggregatedContext {
  recentMoods: Array<{
    id: number
    date: string
    emotions: string[]
    intensity: number
    description: string | null
    trigger: string | null
  }>
  latestAssessment: {
    id: number
    instrumentName: string
    score: number
    riskLevel: string
    submittedAt: string
  } | null
  summary: {
    totalMoodRecords: number
    dateRange: string
    hasAssessment: boolean
  }
}

const moodRepo = createMoodRepository()
const assessmentRepo = createAssessmentRepository()

export const buildAiContext = async (userId: number): Promise<AggregatedContext> => {
  const endDate = new Date()
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - 7)

  const startDateStr = startDate.toISOString().split('T')[0]
  const endDateStr = endDate.toISOString().split('T')[0]

  try {
    // 获取近 7 天情绪分析行
    const analysisRows = await moodRepo.listAnalysisRows(userId, startDateStr, endDateStr)

    // 按 mood_id 分组
    const moodMap = new Map<number, {
      id: number
      date: string
      emotions: string[]
      intensity: number
      intensitySum: number
      intensityCount: number
      description: string | null
      trigger: string | null
    }>()

    for (const row of analysisRows) {
      const existing = moodMap.get(row.moodId)
      if (existing) {
        existing.emotions.push(row.emotionName)
        existing.intensitySum += row.intensity
        existing.intensityCount += 1
      } else {
        moodMap.set(row.moodId, {
          id: row.moodId,
          date: row.date,
          emotions: [row.emotionName],
          intensity: 0,
          intensitySum: row.intensity,
          intensityCount: 1,
          description: null,
          trigger: row.triggerCiphertext,
        })
      }
    }

    // 计算平均强度，限制最多 50 条
    const recentMoods = Array.from(moodMap.values())
      .slice(0, 50)
      .map((m) => ({
        id: m.id,
        date: m.date,
        emotions: [...new Set(m.emotions)],
        intensity: Math.round((m.intensitySum / m.intensityCount) * 10) / 10,
        description: m.description,
        trigger: m.trigger,
      }))

    // 获取最近一次测评结果
    let latestAssessment: AggregatedContext['latestAssessment'] = null
    try {
      const history = await assessmentRepo.listUserAssessmentHistory(userId)
      if (history.length > 0) {
        const latest = history[0]
        latestAssessment = {
          id: latest.id,
          instrumentName: latest.title,
          score: latest.score,
          riskLevel: 'normal',
          submittedAt: typeof latest.created_at === 'string'
            ? latest.created_at
            : new Date(latest.created_at).toISOString(),
        }
      }
    } catch (err) {
      logger.warn('获取测评历史失败，继续生成上下文', { error: err, userId })
    }

    const summary = {
      totalMoodRecords: recentMoods.length,
      dateRange: `${startDateStr} ~ ${endDateStr}`,
      hasAssessment: latestAssessment !== null,
    }

    logger.info('AI 上下文聚合完成', { userId, summary })

    return {
      recentMoods,
      latestAssessment,
      summary,
    }
  } catch (error) {
    logger.error('AI 上下文聚合失败', { error, userId })
    // 返回空上下文作兜底
    return {
      recentMoods: [],
      latestAssessment: null,
      summary: {
        totalMoodRecords: 0,
        dateRange: `${startDateStr} ~ ${endDateStr}`,
        hasAssessment: false,
      },
    }
  }
}

/**
 * 构建 AI Prompt 上下文文本
 */
export const buildContextPrompt = (context: AggregatedContext): string => {
  const parts: string[] = []

  if (context.summary.totalMoodRecords > 0) {
    parts.push(`近 7 天（${context.summary.dateRange}）共记录 ${context.summary.totalMoodRecords} 次情绪：`)
    for (const mood of context.recentMoods) {
      const emotionsText = mood.emotions.join('、')
      const triggerText = mood.trigger ? `（触发：${mood.trigger}）` : ''
      parts.push(`- ${mood.date}: ${emotionsText}，强度 ${mood.intensity}/10${triggerText}`)
    }
  } else {
    parts.push('用户近期无情绪记录，请基于当前对话内容给出建议。')
  }

  if (context.latestAssessment) {
    parts.push(
      `最近一次测评：${context.latestAssessment.instrumentName}，得分 ${context.latestAssessment.score}，于 ${context.latestAssessment.submittedAt} 完成。`,
    )
  }

  return parts.join('\n')
}