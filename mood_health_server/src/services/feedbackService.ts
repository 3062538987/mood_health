import { getMysqlPool } from '../config/mysql'
import { ResultSetHeader, RowDataPacket } from 'mysql2'

interface FeedbackRow extends RowDataPacket {
  id: number
  user_id: number
  analysis_history_id: number
  feedback_type: string
  comment: string | null
  created_at: Date
}

export interface FeedbackStats {
  total: number
  helpful: number
  notHelpful: number
  rate: number
}

export const createFeedbackService = () => {
  const submitFeedback = async (
    userId: number,
    analysisHistoryId: number,
    feedbackType: 'helpful' | 'not_helpful',
    comment?: string,
  ): Promise<{ id: number; duplicate: boolean }> => {
    const pool = getMysqlPool()

    try {
      const [result] = await pool.query<ResultSetHeader>(
        `INSERT INTO ai_feedback (user_id, analysis_history_id, feedback_type, comment)
         VALUES (?, ?, ?, ?)`,
        [userId, analysisHistoryId, feedbackType, comment || null]
      )
      return { id: Number(result.insertId), duplicate: false }
    } catch (error: any) {
      // 重复提交（唯一约束冲突）
      if (error?.code === 'ER_DUP_ENTRY') {
        return { id: 0, duplicate: true }
      }
      throw error
    }
  }

  const getList = async (userId: number) => {
    const pool = getMysqlPool()
    const [rows] = await pool.query<FeedbackRow[]>(
      `SELECT id, user_id, analysis_history_id, feedback_type, comment, created_at
       FROM ai_feedback
       WHERE user_id = ?
       ORDER BY created_at DESC
       LIMIT 50`,
      [userId]
    )
    return rows.map((row) => ({
      id: Number(row.id),
      userId: Number(row.user_id),
      analysisHistoryId: Number(row.analysis_history_id),
      feedbackType: row.feedback_type,
      comment: row.comment,
      createdAt: new Date(row.created_at).toISOString(),
    }))
  }

  const getStats = async (): Promise<FeedbackStats> => {
    const pool = getMysqlPool()
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT
         COUNT(*) as total,
         SUM(CASE WHEN feedback_type = 'helpful' THEN 1 ELSE 0 END) as helpful,
         SUM(CASE WHEN feedback_type = 'not_helpful' THEN 1 ELSE 0 END) as not_helpful
       FROM ai_feedback`
    )
    const total = Number(rows[0]?.total ?? 0)
    const helpful = Number(rows[0]?.helpful ?? 0)
    const notHelpful = Number(rows[0]?.not_helpful ?? 0)
    const rate = total > 0 ? Math.round((helpful / total) * 100) : 0

    return { total, helpful, notHelpful, rate }
  }

  return {
    submitFeedback,
    getList,
    getStats,
  }
}

export type FeedbackService = ReturnType<typeof createFeedbackService>