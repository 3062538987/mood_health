/**
 * AI 分析历史控制器
 * 提供 AI 分析记录的保存、列表和详情接口
 */

import { Request, Response } from 'express'
import { createAiHistoryRepository } from '../repositories/aiHistoryRepository'
import logger from '../utils/logger'
import { apiFailure, apiSuccess, API_ERROR_CODES } from '../utils/apiResponse'

interface AuthRequest extends Request {
  user?: { userId: number; username: string; role: string }
}

const aiHistoryRepo = createAiHistoryRepository()

/**
 * 保存 AI 分析记录
 * POST /api/ai/history
 */
export const saveHistory = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json(apiFailure(401, '未登录'))
    }

    const { analysis_type, input_context, analysis_content, suggestion_content, risk_level, mood_record_id, assessment_session_id, scene, model_source, prompt_version, security_status } = req.body

    if (!analysis_type || !analysis_content) {
      return res.status(400).json(apiFailure(API_ERROR_CODES.BAD_REQUEST, '缺少必要参数'))
    }

    const id = await aiHistoryRepo.saveHistory({
      userId: req.user.userId,
      moodRecordId: mood_record_id || null,
      assessmentSessionId: assessment_session_id || null,
      analysisType: analysis_type,
      inputContext: input_context || null,
      analysisContent: analysis_content,
      suggestionContent: suggestion_content || null,
      riskLevel: risk_level || 'low',
      scene: scene || null,
      modelSource: model_source || null,
      promptVersion: prompt_version || null,
      securityStatus: security_status || 'passed',
    })

    res.json(apiSuccess({ id }, '保存成功'))
  } catch (error) {
    logger.error('保存 AI 分析记录失败', { error, userId: req.user?.userId })
    res.status(500).json(apiFailure(500, '保存失败'))
  }
}

/**
 * 获取 AI 分析历史列表
 * GET /api/ai/history?page=1&pageSize=20
 */
export const listHistory = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json(apiFailure(401, '未登录'))
    }

    const page = Math.max(1, parseInt(req.query.page as string) || 1)
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize as string) || 20))

    const result = await aiHistoryRepo.listHistory({ userId: req.user.userId, page, pageSize })

    res.json(apiSuccess({
      list: result.list,
      total: result.total,
      page,
      pageSize,
    }, '获取历史记录成功'))
  } catch (error) {
    logger.error('获取 AI 分析历史列表失败', { error, userId: req.user?.userId })
    res.status(500).json(apiFailure(500, '获取历史记录失败'))
  }
}

/**
 * 获取 AI 分析历史详情
 * GET /api/ai/history/:id
 */
export const getHistoryDetail = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json(apiFailure(401, '未登录'))
    }

    const id = parseInt(String(req.params.id))
    if (isNaN(id)) {
      return res.status(400).json(apiFailure(API_ERROR_CODES.BAD_REQUEST, '无效的 ID'))
    }

    const record = await aiHistoryRepo.getHistoryDetail(id)
    if (!record) {
      return res.status(404).json(apiFailure(API_ERROR_CODES.NOT_FOUND, '记录不存在'))
    }

    // 所有权校验
    if (record.userId !== req.user.userId) {
      return res.status(404).json(apiFailure(API_ERROR_CODES.NOT_FOUND, '记录不存在'))
    }

    const parseJson = (val: unknown) => {
      if (typeof val === 'string') {
        try { return JSON.parse(val) } catch { return val }
      }
      return val
    }

    res.json(apiSuccess({
      id: record.id,
      userId: record.userId,
      moodRecordId: record.moodRecordId,
      assessmentSessionId: record.assessmentSessionId,
      analysisType: record.analysisType,
      inputContext: parseJson(record.inputContext),
      analysisContent: parseJson(record.analysisContent),
      suggestionContent: parseJson(record.suggestionContent),
      riskLevel: record.riskLevel,
      modelVersion: record.modelVersion,
      requestStatus: record.requestStatus,
      errorMessage: record.errorMessage,
      scene: record.scene,
      modelSource: record.modelSource,
      promptVersion: record.promptVersion,
      securityStatus: record.securityStatus,
      createdAt: record.createdAt,
    }, '获取详情成功'))
  } catch (error) {
    logger.error('获取 AI 分析历史详情失败', { error, id: req.params.id })
    res.status(500).json(apiFailure(500, '获取详情失败'))
  }
}