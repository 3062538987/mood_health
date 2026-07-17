/**
 * AI 分析历史控制器
 * 提供 AI 分析记录的保存、列表和详情接口
 */

import { Request, Response } from 'express'
import { getMysqlPool } from '../config/mysql'
import logger from '../utils/logger'

interface AuthRequest extends Request {
  user?: { userId: number; username: string; role: string }
}

/**
 * 保存 AI 分析记录
 * POST /api/ai/history
 */
export const saveHistory = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ code: 401, message: '未登录' })
    }

    const { analysis_type, input_context, analysis_content, suggestion_content, risk_level, mood_record_id, assessment_session_id } = req.body

    if (!analysis_type || !analysis_content) {
      return res.status(400).json({ code: 1001, message: '缺少必要参数', data: { errors: [{ field: 'analysis_type', message: 'analysis_type 是必填项' }] } })
    }

    const pool = getMysqlPool()
    const [result] = await pool.query(
      `INSERT INTO ai_analysis_history (user_id, mood_record_id, assessment_session_id, analysis_type, input_context, analysis_content, suggestion_content, risk_level, request_status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'success')`,
      [
        req.user.userId,
        mood_record_id || null,
        assessment_session_id || null,
        analysis_type,
        input_context ? JSON.stringify(input_context) : null,
        JSON.stringify(analysis_content),
        suggestion_content ? JSON.stringify(suggestion_content) : null,
        risk_level || 'low',
      ],
    )

    const insertResult = result as { insertId: number }
    logger.info('AI 分析记录已保存', { userId: req.user.userId, id: insertResult.insertId })

    res.json({ code: 0, data: { id: insertResult.insertId } })
  } catch (error) {
    logger.error('保存 AI 分析记录失败', { error, userId: req.user?.userId })
    res.status(500).json({ code: 500, message: '保存失败' })
  }
}

/**
 * 获取 AI 分析历史列表
 * GET /api/ai/history?page=1&pageSize=20
 */
export const listHistory = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ code: 401, message: '未登录' })
    }

    const page = Math.max(1, parseInt(req.query.page as string) || 1)
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize as string) || 20))
    const offset = (page - 1) * pageSize

    const pool = getMysqlPool()
    const [countResult] = await pool.query(
      'SELECT COUNT(*) as total FROM ai_analysis_history WHERE user_id = ?',
      [req.user.userId],
    )
    const total = (countResult as Array<{ total: number }>)[0]?.total || 0

    const [rows] = await pool.query(
      `SELECT id, analysis_type, risk_level, request_status, created_at,
              JSON_EXTRACT(analysis_content, '$.summary') as analysis_summary
       FROM ai_analysis_history
       WHERE user_id = ?
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
      [req.user.userId, pageSize, offset],
    )

    res.json({
      code: 0,
      data: {
        list: (rows as Array<Record<string, unknown>>).map((row) => ({
          id: row.id,
          analysisType: row.analysis_type,
          riskLevel: row.risk_level,
          requestStatus: row.request_status,
          analysisSummary: typeof row.analysis_summary === 'string' ? row.analysis_summary.replace(/^"|"$/g, '') : '',
          createdAt: row.created_at,
        })),
        total,
        page,
        pageSize,
      },
    })
  } catch (error) {
    logger.error('获取 AI 分析历史列表失败', { error, userId: req.user?.userId })
    res.status(500).json({ code: 500, message: '获取历史记录失败' })
  }
}

/**
 * 获取 AI 分析历史详情
 * GET /api/ai/history/:id
 */
export const getHistoryDetail = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ code: 401, message: '未登录' })
    }

    const id = parseInt(String(req.params.id))
    if (isNaN(id)) {
      return res.status(400).json({ code: 1001, message: '无效的 ID' })
    }

    const pool = getMysqlPool()
    const [rows] = await pool.query(
      `SELECT id, user_id, mood_record_id, assessment_session_id, analysis_type,
              input_context, analysis_content, suggestion_content, risk_level,
              model_version, request_status, error_message, created_at
       FROM ai_analysis_history
       WHERE id = ?`,
      [id],
    )

    const record = (rows as Array<Record<string, unknown>>)[0]
    if (!record) {
      return res.status(404).json({ code: 404, message: '记录不存在' })
    }

    // 所有权校验
    if ((record.user_id as number) !== req.user.userId) {
      return res.status(404).json({ code: 404, message: '记录不存在' })
    }

    const parseJson = (val: unknown) => {
      if (typeof val === 'string') {
        try { return JSON.parse(val) } catch { return val }
      }
      return val
    }

    res.json({
      code: 0,
      data: {
        id: record.id,
        userId: record.user_id,
        moodRecordId: record.mood_record_id,
        assessmentSessionId: record.assessment_session_id,
        analysisType: record.analysis_type,
        inputContext: parseJson(record.input_context),
        analysisContent: parseJson(record.analysis_content),
        suggestionContent: parseJson(record.suggestion_content),
        riskLevel: record.risk_level,
        modelVersion: record.model_version,
        requestStatus: record.request_status,
        errorMessage: record.error_message,
        createdAt: record.created_at,
      },
    })
  } catch (error) {
    logger.error('获取 AI 分析历史详情失败', { error, id: req.params.id })
    res.status(500).json({ code: 500, message: '获取详情失败' })
  }
}