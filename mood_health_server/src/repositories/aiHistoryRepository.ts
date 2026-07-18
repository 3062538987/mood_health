import { ResultSetHeader, RowDataPacket } from 'mysql2'
import { getMysqlPool } from '../config/mysql'
import logger from '../utils/logger'

export interface SaveHistoryInput {
  userId: number
  moodRecordId?: number | null
  assessmentSessionId?: number | null
  analysisType: string
  inputContext?: Record<string, unknown> | null
  analysisContent: Record<string, unknown>
  suggestionContent?: Record<string, unknown> | null
  riskLevel?: string
  scene?: string | null
  modelSource?: string | null
  promptVersion?: string | null
  securityStatus?: string
}

export interface HistoryListParams {
  userId: number
  page: number
  pageSize: number
}

export interface HistoryListItem {
  id: number
  analysisType: string
  riskLevel: string
  requestStatus: string
  analysisSummary: string
  scene: string | null
  securityStatus: string
  createdAt: string
}

export interface HistoryDetailRecord {
  id: number
  userId: number
  moodRecordId: number | null
  assessmentSessionId: number | null
  analysisType: string
  inputContext: unknown
  analysisContent: unknown
  suggestionContent: unknown
  riskLevel: string
  modelVersion: string | null
  requestStatus: string
  errorMessage: string | null
  scene: string | null
  modelSource: string | null
  promptVersion: string | null
  securityStatus: string
  createdAt: string
}

export const createAiHistoryRepository = () => {
  const pool = getMysqlPool()

  const saveHistory = async (input: SaveHistoryInput): Promise<number> => {
    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO ai_analysis_history (user_id, mood_record_id, assessment_session_id, analysis_type, input_context, analysis_content, suggestion_content, risk_level, request_status, scene, model_source, prompt_version, security_status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'success', ?, ?, ?, ?)`,
      [
        input.userId,
        input.moodRecordId ?? null,
        input.assessmentSessionId ?? null,
        input.analysisType,
        input.inputContext ? JSON.stringify(input.inputContext) : null,
        JSON.stringify(input.analysisContent),
        input.suggestionContent ? JSON.stringify(input.suggestionContent) : null,
        input.riskLevel || 'low',
        input.scene ?? null,
        input.modelSource ?? null,
        input.promptVersion ?? null,
        input.securityStatus || 'passed',
      ],
    )
    logger.info('AI 分析记录已保存', { userId: input.userId, id: result.insertId })
    return result.insertId
  }

  const listHistory = async (params: HistoryListParams): Promise<{ list: HistoryListItem[]; total: number }> => {
    const offset = (params.page - 1) * params.pageSize

    const [countResult] = await pool.query<RowDataPacket[]>(
      'SELECT COUNT(*) as total FROM ai_analysis_history WHERE user_id = ?',
      [params.userId],
    )
    const total = countResult[0]?.total || 0

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT id, analysis_type, risk_level, request_status, created_at, scene, security_status,
              JSON_EXTRACT(analysis_content, '$.summary') as analysis_summary
       FROM ai_analysis_history
       WHERE user_id = ?
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
      [params.userId, params.pageSize, offset],
    )

    return {
      list: rows.map((row) => ({
        id: row.id as number,
        analysisType: row.analysis_type as string,
        riskLevel: row.risk_level as string,
        requestStatus: row.request_status as string,
        analysisSummary: typeof row.analysis_summary === 'string' ? (row.analysis_summary as string).replace(/^"|"$/g, '') : '',
        scene: row.scene as string | null,
        securityStatus: row.security_status as string || 'passed',
        createdAt: row.created_at as string,
      })),
      total,
    }
  }

  const getHistoryDetail = async (id: number): Promise<HistoryDetailRecord | null> => {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT id, user_id, mood_record_id, assessment_session_id, analysis_type,
              input_context, analysis_content, suggestion_content, risk_level,
              model_version, request_status, error_message, scene, model_source,
              prompt_version, security_status, created_at
       FROM ai_analysis_history
       WHERE id = ?`,
      [id],
    )

    if (rows.length === 0) return null

    const row = rows[0]
    return {
      id: row.id as number,
      userId: row.user_id as number,
      moodRecordId: row.mood_record_id as number | null,
      assessmentSessionId: row.assessment_session_id as number | null,
      analysisType: row.analysis_type as string,
      inputContext: row.input_context,
      analysisContent: row.analysis_content,
      suggestionContent: row.suggestion_content,
      riskLevel: row.risk_level as string,
      modelVersion: row.model_version as string | null,
      requestStatus: row.request_status as string,
      errorMessage: row.error_message as string | null,
      scene: row.scene as string | null,
      modelSource: row.model_source as string | null,
      promptVersion: row.prompt_version as string | null,
      securityStatus: row.security_status as string || 'passed',
      createdAt: row.created_at as string,
    }
  }

  return { saveHistory, listHistory, getHistoryDetail }
}