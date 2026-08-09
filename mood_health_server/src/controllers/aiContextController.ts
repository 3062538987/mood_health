import { HTTP_STATUS } from '../utils/httpStatus'
/**
 * AI 上下文分析控制器
 * 聚合用户上下文后进行 AI 分析
 */

import { Request, Response } from 'express'
import { buildAiContext, buildContextPrompt } from '../services/aiContextService'
import moodAnalysisService from '../utils/ai/moodAnalysisService'
import { apiFailure, apiSuccess } from '../utils/apiResponse'
import logger from '../utils/logger'

interface AuthRequest extends Request {
  user?: { userId: number; username: string; role: string }
}

export const analyzeWithContext = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(HTTP_STATUS.UNAUTHORIZED).json(apiFailure(401, '未登录'))
    }

    const { message, mood } = req.body

    // 聚合上下文
    const context = await buildAiContext(req.user.userId)
    const contextPrompt = buildContextPrompt(context)

    // 构建分析文本
    const analysisText = context.summary.totalMoodRecords > 0
      ? `用户上下文：\n${contextPrompt}\n\n用户当前描述：${message || '无'}`
      : message || '无'

    // 调用情绪分析
    const result = await moodAnalysisService.analyzeMood({
      text: analysisText,
      userId: req.user.userId,
      historicalData: context.recentMoods.map((m) => ({
        date: m.date,
        intensity: m.intensity,
        moodType: m.emotions,
      })),
    })

    // 调用四段式分析
    let fourSection = null
    try {
      fourSection = await moodAnalysisService.analyzeWithFourSection(
        contextPrompt,
        message || '',
      )
    } catch (fourErr) {
      logger.warn('四段式分析失败，将使用基础分析', { error: fourErr })
    }

    // suggestions 兜底：AI 返回空数组/缺失时退化为单条 suggestion，
    // 再兜底为空数组，确保该字段永远是 string[]（绝不 undefined），
    // 前端 AiSuggestCard 的 v-for 安全。注意不能用 `||`：空数组在 JS 中
    // 为真值，会让 `[result.suggestion]` 兜底永远不触发（AI 不返回 suggestions
    // 时用户反而拿到空列表）。
    const safeSuggestions: string[] =
      Array.isArray(result.suggestions) && result.suggestions.length > 0
        ? result.suggestions
        : typeof result.suggestion === 'string' && result.suggestion.trim()
          ? [result.suggestion]
          : []

    res.json(apiSuccess({
      analysis: result.analysis || result.mood,
      suggestions: safeSuggestions,
      mood: result.mood,
      mood_score: result.mood_score || 5,
      risk_level: result.risk_level || 'low',
      confidence: result.confidence,
      emotions: result.emotions,
      fourSection,
      dataScope: {
        moodRecordCount: context.summary.totalMoodRecords,
        dateRange: context.summary.dateRange,
        hasAssessment: context.summary.hasAssessment,
        latestAssessment: context.latestAssessment,
      },
      timestamp: result.timestamp,
    }, 'AI 分析成功'))
  } catch (error) {
    logger.error('上下文分析失败', { error, userId: req.user?.userId })
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(apiFailure(500, 'AI 分析失败，请稍后重试'))
  }
}