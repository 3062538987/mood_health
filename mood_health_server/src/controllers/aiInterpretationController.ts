import { Response } from 'express'
import { body, query } from 'express-validator'
import { AuthRequest } from '../middleware/auth'
import { apiSuccess, apiFailure } from '../utils/apiResponse'
import aiAssessmentService from '../services/aiAssessmentService'
import aiMoodReportService from '../services/aiMoodReportService'
import { callDirect } from '../utils/ai/aiCallService'

export const validateInterpretation = [
  body('scaleName').isString().notEmpty().withMessage('量表名称不能为空'),
  body('scaleType').isString().notEmpty().withMessage('量表类型不能为空'),
  body('totalScore').isInt({ min: 0 }).withMessage('总分必须是非负整数'),
  body('maxScore').isInt({ min: 0 }).withMessage('满分必须是非负整数'),
  body('itemScores').isArray({ min: 1 }).withMessage('题目得分不能为空'),
  body('itemScores.*.label').isString().notEmpty().withMessage('题目标签不能为空'),
  body('itemScores.*.score').isInt({ min: 0 }).withMessage('题目得分必须是非负整数'),
  body('riskLevel').isString().notEmpty().withMessage('风险等级不能为空'),
]

export const interpretAssessmentHandler = async (req: AuthRequest, res: Response) => {
  try {
    const { scaleName, scaleType, totalScore, maxScore, itemScores, riskLevel } = req.body

    const result = await aiAssessmentService.generateInterpretation({
      scaleName,
      scaleType,
      totalScore,
      maxScore,
      itemScores,
      riskLevel,
    })

    return res.status(200).json(apiSuccess(result, 'AI 解读生成成功'))
  } catch (error: any) {
    if (error?.message?.includes('AI 服务未启用')) {
      return res.status(503).json(apiFailure(503, error.message))
    }
    if (error?.message?.includes('Prompt 模板')) {
      return res.status(404).json(apiFailure(404, error.message))
    }
    return res.status(500).json(apiFailure(500, 'AI 解读生成失败'))
  }
}

export const validateMoodReport = [
  body('userName').isString().notEmpty().withMessage('用户名不能为空'),
  body('dateRange').isString().notEmpty().withMessage('时间范围不能为空'),
  body('recordCount').isInt({ min: 0 }).withMessage('记录数必须是非负整数'),
  body('primaryEmotions').isString().notEmpty().withMessage('主要情绪不能为空'),
  body('averageIntensity').isFloat({ min: 0 }).withMessage('平均强度必须是非负数'),
  body('mostFrequentMood').isString().notEmpty().withMessage('最常见情绪不能为空'),
  body('type').isIn(['weekly', 'monthly']).withMessage('报告类型必须是 weekly 或 monthly'),
]

export const validateCounseling = [
  body('message').isString().trim().isLength({ min: 1, max: 1000 }).withMessage('消息内容必须为1-1000字'),
  body('context').optional().isArray({ max: 10 }).withMessage('上下文不能超过10条消息'),
  body('context.*.role').optional().isIn(['user', 'assistant']).withMessage('上下文角色非法'),
  body('context.*.content').optional().isString().isLength({ min: 1, max: 1000 }).withMessage('上下文内容非法'),
  body('mood').optional().isArray({ max: 5 }).withMessage('情绪标签不能超过5个'),
]

const hasRiskContent = (message: string) =>
  /自杀|轻生|不想活|伤害自己|割腕|结束生命|活不下去/.test(message)

export const counselingHandler = async (req: AuthRequest, res: Response) => {
  try {
    const { message, context = [], mood = [] } = req.body as {
      message: string
      context?: Array<{ role: 'user' | 'assistant'; content: string }>
      mood?: string[]
    }
    const riskDetected = hasRiskContent(message)
    const contextText = context
      .map((item) => `${item.role === 'user' ? '学生' : '助手'}：${item.content}`)
      .join('\n')
    const moodText = mood.length > 0 ? mood.join('、') : '未提供'

    const systemPrompt = [
      '你是大学生情绪健康系统中的心理支持助手。',
      '你只能提供情绪支持、倾听、压力管理和求助建议，不做医学诊断，不替代专业心理咨询。',
      '如果用户表达自伤、自杀或伤害他人的风险，必须建议其立刻联系身边可信任的人、学校心理中心或当地紧急服务。',
      '回复要温和、具体、简短，优先给出1-3个可执行的小步骤。',
    ].join('\n')
    const userPrompt = [
      contextText ? `对话上下文：\n${contextText}` : '',
      `当前情绪标签：${moodText}`,
      `学生消息：${message}`,
    ]
      .filter(Boolean)
      .join('\n\n')

    const reply = await callDirect(systemPrompt, userPrompt, {
      temperature: 0.6,
      maxTokens: 800,
    })

    return res.status(200).json(
      apiSuccess(
        {
          response: reply,
          riskLevel: riskDetected ? 'high' : 'low',
          hasRiskContent: riskDetected,
        },
        'AI 咨询回复生成成功'
      )
    )
  } catch (error: any) {
    if (
      error?.message?.includes('AI 服务未启用') ||
      error?.message?.includes('AI API Key') ||
      error?.message?.includes('AI 调用失败')
    ) {
      return res.status(503).json(apiFailure(503, error.message))
    }
    return res.status(500).json(apiFailure(500, 'AI 咨询回复生成失败'))
  }
}

export const generateMoodReportHandler = async (req: AuthRequest, res: Response) => {
  try {
    const { userName, dateRange, recordCount, primaryEmotions, averageIntensity, mostFrequentMood, trend, highlights, lowPoints, emotionDistribution, type } = req.body

    const input = { userName, dateRange, recordCount, primaryEmotions, averageIntensity, mostFrequentMood, trend, highlights, lowPoints, emotionDistribution }

    const result = type === 'monthly'
      ? await aiMoodReportService.generateMonthlyReport(input)
      : await aiMoodReportService.generateWeeklyReport(input)

    return res.status(200).json(apiSuccess(result, 'AI 报告生成成功'))
  } catch (error: any) {
    if (error?.message?.includes('AI 服务未启用')) {
      return res.status(503).json(apiFailure(503, error.message))
    }
    return res.status(500).json(apiFailure(500, 'AI 报告生成失败'))
  }
}
