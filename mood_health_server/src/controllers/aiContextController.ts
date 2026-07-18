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
      return res.status(401).json(apiFailure(401, '未登录'))
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

    res.json(apiSuccess({
      analysis: result.analysis || result.mood,
      suggestions: result.suggestions || [result.suggestion],
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
    res.status(500).json(apiFailure(500, 'AI 分析失败，请稍后重试'))
  }
}