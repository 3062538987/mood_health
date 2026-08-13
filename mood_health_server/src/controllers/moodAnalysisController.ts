import { HTTP_STATUS } from '../utils/httpStatus'
/**
 * 五周期情绪分析版本控制器
 */
import { Response } from 'express'
import { AuthRequest } from '../middleware/auth'
import { apiFailure, apiSuccess, API_ERROR_CODES } from '../utils/apiResponse'
import {
  createMoodAnalysisDataService,
  VALID_PERIODS,
  AnalysisPeriod,
  AnalysisVersion,
} from '../services/moodAnalysisDataService'
import { analyzeMood } from '../services/analysisDispatcher'
import logger from '../utils/logger'

const moodAnalysisDataService = createMoodAnalysisDataService()

function guardUserId(req: AuthRequest, res: Response): number | null {
  if (!req.user) {
    res.status(HTTP_STATUS.UNAUTHORIZED).json(apiFailure(401, '未登录'))
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
 * 将数据库状态映射到前端约定的状态词汇
 * DB: pending | processing | completed | failed | stale
 * FE: pending | processing | succeeded | retryable_failed | failed_final | superseded
 */
type NormalizedStatus =
  | 'pending'
  | 'processing'
  | 'succeeded'
  | 'retryable_failed'
  | 'failed_final'
  | 'superseded'

function normalizeStatus(status: AnalysisVersion['status']): NormalizedStatus {
  switch (status) {
    case 'completed':
      return 'succeeded'
    case 'failed':
      return 'retryable_failed'
    case 'stale':
      return 'superseded'
    default:
      return status
  }
}

/**
 * 将内部 AnalysisVersion 映射为前端 AnalysisResponse 形状
 * - status 使用前端词汇
 * - analysisContent（FastAPI 原始结果）即前端所需的 result
 */
function toAnalysisResponse(version: AnalysisVersion) {
  return {
    id: String(version.id),
    period: version.period,
    status: normalizeStatus(version.status),
    result: version.analysisContent ?? undefined,
    job: undefined,
    createdAt: version.createdAt,
    updatedAt: version.updatedAt,
  }
}

function toAnalysisHistoryItem(version: AnalysisVersion, isLatest: boolean) {
  const summary = version.analysisContent?.summary
  return {
    id: String(version.id),
    period: version.period,
    dataVersion: version.dataVersion,
    status: normalizeStatus(version.status),
    createdAt: version.createdAt,
    summary: typeof summary === 'string' ? summary : undefined,
    recordCount: version.recordCount,
    dateRange: `${version.dataRangeStart} 至 ${version.dataRangeEnd}`,
    usesJournalExcerpt: false,
    isStale: version.isStale,
    isLatest,
  }
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
      return res.status(HTTP_STATUS.BAD_REQUEST).json(apiFailure(API_ERROR_CODES.BAD_REQUEST, '缺少 period 参数'))
    }

    const parsedPeriod = parsePeriod(period)
    if (!parsedPeriod) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json(apiFailure(API_ERROR_CODES.BAD_REQUEST, `无效的周期参数，仅支持: ${VALID_PERIODS.join(', ')}`))
    }

    const result = await moodAnalysisDataService.createOrReuseAnalysis(userId, parsedPeriod)
    res.status(result.reused ? 200 : 201).json(apiSuccess(toAnalysisResponse(result.version), result.reason))
  } catch (error: unknown) {
    if ((error as { code?: string })?.code === 'NO_RECORDS') {
      return res.status(HTTP_STATUS.OK).json(apiSuccess(null, '该周期内无情绪记录'))
    }
    logger.error('[createAnalysis] Error:', error)
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(apiFailure(500, '创建分析任务失败'))
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
      return res.status(HTTP_STATUS.BAD_REQUEST).json(apiFailure(API_ERROR_CODES.BAD_REQUEST, '缺少 period 参数'))
    }

    const parsedPeriod = parsePeriod(period)
    if (!parsedPeriod) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json(apiFailure(API_ERROR_CODES.BAD_REQUEST, `无效的周期参数，仅支持: ${VALID_PERIODS.join(', ')}`))
    }

    const version = await moodAnalysisDataService.getLatestAnalysis(userId, parsedPeriod)

    if (!version) {
      return res.json(apiSuccess(null, '暂无分析记录'))
    }

    res.json(apiSuccess(toAnalysisResponse(version), '获取成功'))
  } catch (error) {
    logger.error('[getLatestAnalysis] Error:', error)
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(apiFailure(500, '获取分析失败'))
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
      return res.status(HTTP_STATUS.BAD_REQUEST).json(apiFailure(API_ERROR_CODES.BAD_REQUEST, '缺少 period 参数'))
    }

    const parsedPeriod = parsePeriod(period)
    if (!parsedPeriod) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json(apiFailure(API_ERROR_CODES.BAD_REQUEST, `无效的周期参数，仅支持: ${VALID_PERIODS.join(', ')}`))
    }

    const page = Math.max(1, parseInt(req.query.page as string) || 1)
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize as string) || 20))

    const result = await moodAnalysisDataService.listAnalyses(userId, parsedPeriod, page, pageSize)
    res.json(apiSuccess({
      data: result.list.map((version, index) => toAnalysisHistoryItem(version, page === 1 && index === 0)),
      total: result.total,
      page,
      pageSize,
    }, '获取成功'))
  } catch (error) {
    logger.error('[listAnalyses] Error:', error)
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(apiFailure(500, '获取分析列表失败'))
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
      return res.status(HTTP_STATUS.BAD_REQUEST).json(apiFailure(API_ERROR_CODES.BAD_REQUEST, '无效的分析 ID'))
    }

    const version = await moodAnalysisDataService.getAnalysisById(id, userId)

    if (!version) {
      return res.status(HTTP_STATUS.NOT_FOUND).json(apiFailure(404, '分析记录不存在'))
    }

    res.json(apiSuccess(toAnalysisResponse(version), '获取成功'))
  } catch (error) {
    logger.error('[getAnalysisById] Error:', error)
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(apiFailure(500, '获取分析详情失败'))
  }
}

/**
 * POST /api/mood-analyses/:id
 * 触发（或重试）指定分析版本的 AI 分析，并将结果落库（pending/processing → succeeded）
 * 前端 retryAnalysis 调用此接口
 */
export const runAnalysis = async (req: AuthRequest, res: Response) => {
  try {
    const userId = guardUserId(req, res)
    if (userId === null) return

    const id = parseInt(String(req.params.id))
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json(apiFailure(API_ERROR_CODES.BAD_REQUEST, '无效的分析 ID'))
    }

    const version = await moodAnalysisDataService.getAnalysisById(id, userId)
    if (!version) {
      return res.status(HTTP_STATUS.NOT_FOUND).json(apiFailure(404, '分析记录不存在'))
    }

    // 已完成且数据未变 → 直接返回缓存结果，避免重复消耗 AI 额度
    if (version.status === 'completed') {
      return res.json(apiSuccess(toAnalysisResponse(version), '分析已完成'))
    }

    // 标记处理中，避免并发重复触发
    await moodAnalysisDataService.updateStatus(id, 'processing')

    try {
      await analyzeMood({
        userId,
        period: version.period,
        versionId: id,
        journalExcerpt: (req.body && req.body.journalExcerpt) ?? null,
        journalConsent: Boolean(req.body && req.body.journalConsent),
      })

      const updated = await moodAnalysisDataService.getAnalysisById(id, userId)
      return res.json(apiSuccess(toAnalysisResponse(updated!), '分析完成'))
    } catch (aiError: unknown) {
      const message = (aiError as Error)?.message ? String((aiError as Error).message) : 'AI 分析失败'
      await moodAnalysisDataService.updateStatus(id, 'failed', null, message)
      logger.error('[runAnalysis] AI 分析失败: versionId=%d, error=%s', id, message)
      return res.status(HTTP_STATUS.BAD_GATEWAY).json(apiFailure(502, `AI 分析失败：${message}`))
    }
  } catch (error) {
    logger.error('[runAnalysis] Error:', error)
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(apiFailure(500, '运行分析失败'))
  }
}

/**
 * DELETE /api/mood-analyses/:id
 * 删除指定分析版本（仅本人；super_admin 可删任意）
 */
export const deleteAnalysisHandler = async (req: AuthRequest, res: Response) => {
  try {
    const userId = guardUserId(req, res)
    if (userId === null) return

    const id = parseInt(String(req.params.id))
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json(apiFailure(API_ERROR_CODES.BAD_REQUEST, '无效的分析 ID'))
    }

    const isSuperAdmin = req.user?.role === 'super_admin'
    const deleted = await moodAnalysisDataService.deleteAnalysis(id, userId, isSuperAdmin)
    if (!deleted) {
      return res.status(HTTP_STATUS.NOT_FOUND).json(apiFailure(404, '分析记录不存在或无权限'))
    }
    return res.json(apiSuccess(null, '删除成功'))
  } catch (error) {
    logger.error('[deleteAnalysisHandler] Error:', error)
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(apiFailure(500, '删除分析失败'))
  }
}
