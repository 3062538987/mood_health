/**
 * 五周期情绪分析版本控制器
 */
import { Response } from 'express'
import { AuthRequest } from '../middleware/auth'
import { apiFailure, apiSuccess, API_ERROR_CODES } from '../utils/apiResponse'
import { createMoodAnalysisDataService, VALID_PERIODS, AnalysisPeriod } from '../services/moodAnalysisDataService'
import logger from '../utils/logger'

const moodAnalysisDataService = createMoodAnalysisDataService()

function guardUserId(req: AuthRequest, res: Response): number | null {
  if (!req.user) {
    res.status(401).json(apiFailure(401, '未登录'))
    return null
  }
  return req.user.userId
}

function parsePeriod(period: string): AnalysisPeriod | null {
  if (VALID_PERIODS.includes(period as AnalysisPeriod)) {
    return period as AnalysisPeriod
  }
  return null
}

/**
 * POST /api/mood-analyses
 * 创建或复用指定周期的分析任务
 */
export const createAnalysis = async (req: AuthRequest, res: Response) => {
  try {
    const userId = guardUserId(req, res)
    if (userId === null) return

    const { period } = req.body

    if (!period || typeof period !== 'string') {
      return res.status(400).json(apiFailure(API_ERROR_CODES.BAD_REQUEST, '缺少 period 参数'))
    }

    const parsedPeriod = parsePeriod(period)
    if (!parsedPeriod) {
      return res.status(400).json(apiFailure(API_ERROR_CODES.BAD_REQUEST, `无效的周期参数，仅支持: ${VALID_PERIODS.join(', ')}`))
    }

    const result = await moodAnalysisDataService.createOrReuseAnalysis(userId, parsedPeriod)
    res.status(result.reused ? 200 : 201).json(apiSuccess(result, result.reason))
  } catch (error: any) {
    if (error?.code === 'NO_RECORDS') {
      return res.status(200).json(apiSuccess(null, '该周期内无情绪记录'))
    }
    logger.error('[createAnalysis] Error:', error)
    res.status(500).json(apiFailure(500, '创建分析任务失败'))
  }
}

/**
 * GET /api/mood-analyses/latest?period=
 * 获取最新分析版本
 */
export const getLatestAnalysis = async (req: AuthRequest, res: Response) => {
  try {
    const userId = guardUserId(req, res)
    if (userId === null) return

    const period = String(req.query.period || '') as string | undefined
    if (!period) {
      return res.status(400).json(apiFailure(API_ERROR_CODES.BAD_REQUEST, '缺少 period 参数'))
    }

    const parsedPeriod = parsePeriod(period)
    if (!parsedPeriod) {
      return res.status(400).json(apiFailure(API_ERROR_CODES.BAD_REQUEST, `无效的周期参数，仅支持: ${VALID_PERIODS.join(', ')}`))
    }

    const version = await moodAnalysisDataService.getLatestAnalysis(userId, parsedPeriod)

    if (!version) {
      return res.status(404).json(apiFailure(404, '暂无分析记录'))
    }

    res.json(apiSuccess(version, '获取成功'))
  } catch (error) {
    logger.error('[getLatestAnalysis] Error:', error)
    res.status(500).json(apiFailure(500, '获取分析失败'))
  }
}

/**
 * GET /api/mood-analyses?period=&page=&pageSize=
 * 分页列出分析版本
 */
export const listAnalyses = async (req: AuthRequest, res: Response) => {
  try {
    const userId = guardUserId(req, res)
    if (userId === null) return

    const period = String(req.query.period || '') as string | undefined
    if (!period) {
      return res.status(400).json(apiFailure(API_ERROR_CODES.BAD_REQUEST, '缺少 period 参数'))
    }

    const parsedPeriod = parsePeriod(period)
    if (!parsedPeriod) {
      return res.status(400).json(apiFailure(API_ERROR_CODES.BAD_REQUEST, `无效的周期参数，仅支持: ${VALID_PERIODS.join(', ')}`))
    }

    const page = Math.max(1, parseInt(req.query.page as string) || 1)
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize as string) || 20))

    const result = await moodAnalysisDataService.listAnalyses(userId, parsedPeriod, page, pageSize)
    res.json(apiSuccess(result, '获取成功'))
  } catch (error) {
    logger.error('[listAnalyses] Error:', error)
    res.status(500).json(apiFailure(500, '获取分析列表失败'))
  }
}

/**
 * GET /api/mood-analyses/:id
 * 获取分析详情（按 id + userId 过滤）
 */
export const getAnalysisById = async (req: AuthRequest, res: Response) => {
  try {
    const userId = guardUserId(req, res)
    if (userId === null) return

    const id = parseInt(String(req.params.id))
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json(apiFailure(API_ERROR_CODES.BAD_REQUEST, '无效的分析 ID'))
    }

    const version = await moodAnalysisDataService.getAnalysisById(id, userId)

    if (!version) {
      return res.status(404).json(apiFailure(404, '分析记录不存在'))
    }

    res.json(apiSuccess(version, '获取成功'))
  } catch (error) {
    logger.error('[getAnalysisById] Error:', error)
    res.status(500).json(apiFailure(500, '获取分析详情失败'))
  }
}