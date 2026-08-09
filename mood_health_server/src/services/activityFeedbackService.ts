import { getMysqlPool } from '../config/mysql'
import { ResultSetHeader, RowDataPacket } from 'mysql2'

interface FeedbackRow extends RowDataPacket {
  id: number
  activity_id: number
  user_id: number
  rating: number
  comment: string | null
  created_at: Date
}

export interface ActivityFeedbackInput {
  rating: number
  comment?: string
}

export interface ActivityFeedbackDto {
  id: number
  activityId: number
  userId: number
  rating: number
  comment: string | null
  createdAt: string
}

export interface ActivityFeedbackStats {
  averageRating: number
  totalCount: number
  ratingDistribution: Record<number, number>
}

export const createActivityFeedbackService = () => {
  const submitFeedback = async (
    activityId: number,
    userId: number,
    input: ActivityFeedbackInput,
  ): Promise<{ id: number; duplicate: boolean }> => {
    const pool = getMysqlPool()

    try {
      const [result] = await pool.query<ResultSetHeader>(
        `INSERT INTO activity_feedback (activity_id, user_id, rating, comment)
         VALUES (?, ?, ?, ?)`,
        [activityId, userId, input.rating, input.comment || null]
      )
      return { id: Number(result.insertId), duplicate: false }
    } catch (error: unknown) {
      if ((error as { code?: string })?.code === 'ER_DUP_ENTRY') {
        return { id: 0, duplicate: true }
      }
      throw error
    }
  }

  const getFeedbackByActivity = async (activityId: number): Promise<ActivityFeedbackDto[]> => {
    const pool = getMysqlPool()
    const [rows] = await pool.query<FeedbackRow[]>(
      `SELECT id, activity_id, user_id, rating, comment, created_at
       FROM activity_feedback
       WHERE activity_id = ?
       ORDER BY created_at DESC`,
      [activityId]
    )
    return rows.map((row) => ({
      id: Number(row.id),
      activityId: Number(row.activity_id),
      userId: Number(row.user_id),
      rating: Number(row.rating),
      comment: row.comment,
      createdAt: new Date(row.created_at).toISOString(),
    }))
  }

  const getUserFeedback = async (activityId: number, userId: number): Promise<ActivityFeedbackDto | null> => {
    const pool = getMysqlPool()
    const [rows] = await pool.query<FeedbackRow[]>(
      `SELECT id, activity_id, user_id, rating, comment, created_at
       FROM activity_feedback
       WHERE activity_id = ? AND user_id = ?
       LIMIT 1`,
      [activityId, userId]
    )
    if (!rows.length) return null
    const row = rows[0]
    return {
      id: Number(row.id),
      activityId: Number(row.activity_id),
      userId: Number(row.user_id),
      rating: Number(row.rating),
      comment: row.comment,
      createdAt: new Date(row.created_at).toISOString(),
    }
  }

  const getFeedbackStats = async (activityId: number): Promise<ActivityFeedbackStats> => {
    const pool = getMysqlPool()
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT
         AVG(rating) as avg_rating,
         COUNT(*) as total,
         SUM(CASE WHEN rating = 1 THEN 1 ELSE 0 END) as r1,
         SUM(CASE WHEN rating = 2 THEN 1 ELSE 0 END) as r2,
         SUM(CASE WHEN rating = 3 THEN 1 ELSE 0 END) as r3,
         SUM(CASE WHEN rating = 4 THEN 1 ELSE 0 END) as r4,
         SUM(CASE WHEN rating = 5 THEN 1 ELSE 0 END) as r5
       FROM activity_feedback
       WHERE activity_id = ?`,
      [activityId]
    )
    const row = rows[0]
    return {
      averageRating: row ? Math.round(Number(row.avg_rating) * 10) / 10 : 0,
      totalCount: row ? Number(row.total) : 0,
      ratingDistribution: {
        1: row ? Number(row.r1) : 0,
        2: row ? Number(row.r2) : 0,
        3: row ? Number(row.r3) : 0,
        4: row ? Number(row.r4) : 0,
        5: row ? Number(row.r5) : 0,
      },
    }
  }

  return {
    submitFeedback,
    getFeedbackByActivity,
    getUserFeedback,
    getFeedbackStats,
  }
}

export type ActivityFeedbackService = ReturnType<typeof createActivityFeedbackService>