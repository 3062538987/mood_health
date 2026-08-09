import { HTTP_STATUS } from '../utils/httpStatus'
import { Response } from 'express'
import { body, query } from 'express-validator'
import { AuthRequest } from '../middleware/auth'
import { apiSuccess, apiFailure } from '../utils/apiResponse'
import aiAssessmentService from '../services/aiAssessmentService'
import aiMoodReportService from '../services/aiMoodReportService'

export const validateInterpretation = [
  body('scaleName').isString().notEmpty().withMessage('量表名称不能为空'),
  body('scaleType').isString().notEmpty().withMessage('量表类型不能为空'),
  body('totalScore').isInt({ min: 0, max: 10000 }).withMessage('总分必须是 0-10000 的整数'),
  body('maxScore').isInt({ min: 0, max: 10000 }).withMessage('满分必须是 0-10000 的整数'),
  body('itemScores').isArray({ min: 1, max: 500 }).withMessage('题目得分数组长度必须在1-500之间'),
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

    return res.status(HTTP_STATUS.OK).json(apiSuccess(result, 'AI 解读生成成功'))
  } catch (error: unknown) {
    if ((error as Error)?.message?.includes('AI 服务未启用')) {
      return res.status(HTTP_STATUS.SERVICE_UNAVAILABLE).json(apiFailure(503, (error as Error).message))
    }
    if ((error as Error)?.message?.includes('Prompt 模板')) {
      return res.status(HTTP_STATUS.NOT_FOUND).json(apiFailure(404, (error as Error).message))
    }
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(apiFailure(500, 'AI 解读生成失败'))
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

export const generateMoodReportHandler = async (req: AuthRequest, res: Response) => {
  try {
    const { userName, dateRange, recordCount, primaryEmotions, averageIntensity, mostFrequentMood, trend, highlights, lowPoints, emotionDistribution, type } = req.body

    const input = { userName, dateRange, recordCount, primaryEmotions, averageIntensity, mostFrequentMood, trend, highlights, lowPoints, emotionDistribution }

    const result = type === 'monthly'
      ? await aiMoodReportService.generateMonthlyReport(input)
      : await aiMoodReportService.generateWeeklyReport(input)

    return res.status(HTTP_STATUS.OK).json(apiSuccess(result, 'AI 报告生成成功'))
  } catch (error: unknown) {
    if ((error as Error)?.message?.includes('AI 服务未启用')) {
      return res.status(HTTP_STATUS.SERVICE_UNAVAILABLE).json(apiFailure(503, (error as Error).message))
    }
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(apiFailure(500, 'AI 报告生成失败'))
  }
}