/**
 * AI 情绪报告服务
 * 使用 Prompt 模板生成周报/月报的 AI 版本
 */

import { callWithTemplate, isAiAvailable } from '../utils/ai/aiCallService'
import logger from '../utils/logger'

interface MoodReportInput {
  userName: string
  dateRange: string
  recordCount: number
  primaryEmotions: string
  averageIntensity: number
  mostFrequentMood: string
  trend: string
  highlights?: string
  lowPoints?: string
  emotionDistribution?: string
}

interface MoodReportOutput {
  content: string
  generatedAt: string
}

/**
 * 生成 AI 周度情绪报告
 */
export const generateWeeklyReport = async (input: MoodReportInput): Promise<MoodReportOutput> => {
  if (!isAiAvailable()) {
    throw new Error('AI 服务未启用，请设置 AI_ENABLED=true 并配置 API Key')
  }

  const variables = {
    userName: input.userName,
    dateRange: input.dateRange,
    recordCount: String(input.recordCount),
    primaryEmotions: input.primaryEmotions,
    trend: input.trend ||
      `平均强度 ${input.averageIntensity}，最常见情绪为「${input.mostFrequentMood}」`,
  }

  logger.info(`Generating AI weekly report for user: ${input.userName}`)

  const content = await callWithTemplate('周度情绪报告', variables, { temperature: 0.7 })

  return { content, generatedAt: new Date().toISOString() }
}

/**
 * 生成 AI 月度情绪报告
 */
export const generateMonthlyReport = async (input: MoodReportInput): Promise<MoodReportOutput> => {
  if (!isAiAvailable()) {
    throw new Error('AI 服务未启用，请设置 AI_ENABLED=true 并配置 API Key')
  }

  const variables = {
    userName: input.userName,
    dateRange: input.dateRange,
    recordCount: String(input.recordCount),
    emotionDistribution: input.emotionDistribution || input.primaryEmotions,
    trend: input.trend ||
      `平均强度 ${input.averageIntensity}，最常见情绪为「${input.mostFrequentMood}」`,
    highlights: input.highlights || '本周暂无特别的高光时刻，继续记录可以发现更多模式。',
    lowPoints: input.lowPoints || '本周暂无明显的低谷时刻。',
  }

  logger.info(`Generating AI monthly report for user: ${input.userName}`)

  const content = await callWithTemplate('月度情绪报告', variables, { temperature: 0.7 })

  return { content, generatedAt: new Date().toISOString() }
}

export default { generateWeeklyReport, generateMonthlyReport }