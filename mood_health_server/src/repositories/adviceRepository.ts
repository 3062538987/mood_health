import { getMysqlPool } from '../config/mysql'
import { RowDataPacket, ResultSetHeader } from 'mysql2'

export interface AdviceHistoryRow {
  id: number
  userId: number
  moodRecordId: number | null
  analysis: string
  suggestions: string
  createdAt: string
}

export interface AdviceHistoryItem {
  id: number
  userId: number
  moodRecordId?: number
  analysis: string
  suggestions: string[]
  createdAt: string
}

export const createAdviceRepository = (db = getMysqlPool()) => {
  const save = async (input: {
    userId: number
    moodRecordId?: number
    analysis: string
    suggestions: string[]
  }): Promise<number> => {
    const [result] = await db.query<ResultSetHeader>(
      `INSERT INTO advice_history (user_id, mood_record_id, analysis, suggestions, created_at)
       VALUES (?, ?, ?, ?, NOW())`,
      [
        input.userId,
        input.moodRecordId ?? null,
        input.analysis,
        JSON.stringify(input.suggestions),
      ],
    )
    return result.insertId
  }

  const listByUser = async (
    userId: number,
    page: number,
    pageSize: number,
  ): Promise<{ list: AdviceHistoryItem[]; total: number }> => {
    const offset = (page - 1) * pageSize
    const [countRows] = await db.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS total FROM advice_history WHERE user_id = ?`,
      [userId],
    )
    const total = Number(countRows[0]?.total ?? 0)
    const [rows] = await db.query<RowDataPacket[]>(
      `SELECT * FROM advice_history WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [userId, pageSize, offset],
    )
    const list: AdviceHistoryItem[] = rows.map((r) => ({
      id: r.id,
      userId: r.user_id,
      moodRecordId: r.mood_record_id ?? undefined,
      analysis: r.analysis,
      suggestions: typeof r.suggestions === 'string' ? JSON.parse(r.suggestions) : [],
      createdAt: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
    }))
    return { list, total }
  }

  return { save, listByUser }
}

export type AdviceRepository = ReturnType<typeof createAdviceRepository>
