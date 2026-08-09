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
    } catch (error: unknown) {
      // 重复提交（唯一约束冲突）
      if ((error as { code?: string })?.code === 'ER_DUP_ENTRY') {
        return { id: 0, duplicate: true }
      }
      throw error
    }
  }

  return {
    submitFeedback,
  }
}

export type FeedbackService = ReturnType<typeof createFeedbackService>
