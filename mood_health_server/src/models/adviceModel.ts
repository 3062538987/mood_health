import { sqliteAll, sqliteGet, sqliteRun } from '../config/sqlite'
import logger from '../utils/logger'

export interface AdviceHistory {
  id: number
  userId: number
  moodRecordId?: number
  analysis: string
  suggestions: string[]
  createdAt: Date
}

let tableChecked = false

const ensureAdviceHistoryTable = () => {
  if (tableChecked) return
  sqliteRun(`
    CREATE TABLE IF NOT EXISTS advice_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      mood_record_id INTEGER,
      analysis TEXT NOT NULL,
      suggestions TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `)
  sqliteRun('CREATE INDEX IF NOT EXISTS idx_advice_history_user_id ON advice_history(user_id)')
  sqliteRun(
    'CREATE INDEX IF NOT EXISTS idx_advice_history_created_at ON advice_history(created_at DESC)'
  )
  tableChecked = true
}

const getDbErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : '数据库访问失败'

const normalizeSuggestions = (raw: unknown): string[] => {
  if (Array.isArray(raw)) return raw.map(String).filter(Boolean)
  if (typeof raw !== 'string' || !raw.trim()) return []
  try {
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) return parsed.map(String).filter(Boolean)
  } catch {
    // 历史非 JSON 文本作为单条建议展示。
  }
  return [raw.trim()]
}

export const createAdviceHistory = async (
  userId: number,
  moodRecordId: number | undefined,
  analysis: string,
  suggestions: string[]
): Promise<number> => {
  try {
    ensureAdviceHistoryTable()
    const result = sqliteRun(
      `INSERT INTO advice_history (user_id, mood_record_id, analysis, suggestions)
       VALUES (?, ?, ?, ?)`,
      [
        userId,
        moodRecordId || null,
        analysis.trim().slice(0, 1000),
        JSON.stringify(suggestions.filter((item) => item.trim().length > 0)),
      ]
    )
    return Number(result.lastInsertRowid)
  } catch (error) {
    logger.error('保存 AI 建议历史失败', {
      userId,
      moodRecordId,
      dbMessage: getDbErrorMessage(error),
      error,
    })
    throw error
  }
}

export const getAdviceHistoryByUser = async (
  userId: number,
  page: number = 1,
  pageSize: number = 20
): Promise<{ list: AdviceHistory[]; total: number }> => {
  try {
    ensureAdviceHistoryTable()
    const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1
    const safePageSize =
      Number.isFinite(pageSize) && pageSize > 0 ? Math.min(Math.floor(pageSize), 100) : 20
    const count = sqliteGet('SELECT COUNT(*) AS total FROM advice_history WHERE user_id = ?', [
      userId,
    ]) as { total: number } | undefined
    const rows = sqliteAll(
      `
        SELECT id, user_id AS userId, mood_record_id AS moodRecordId,
               analysis, suggestions, created_at AS createdAt
        FROM advice_history
        WHERE user_id = ?
        ORDER BY datetime(created_at) DESC
        LIMIT ? OFFSET ?
      `,
      [userId, safePageSize, (safePage - 1) * safePageSize]
    ) as Array<{
      id: number
      userId: number
      moodRecordId?: number
      analysis: string
      suggestions: unknown
      createdAt: string | Date
    }>
    return {
      list: rows.map((row) => ({
        ...row,
        suggestions: normalizeSuggestions(row.suggestions),
        createdAt: new Date(row.createdAt),
      })),
      total: Number(count?.total || 0),
    }
  } catch (error) {
    logger.error('查询 AI 建议历史失败', {
      userId,
      page,
      pageSize,
      dbMessage: getDbErrorMessage(error),
      error,
    })
    throw error
  }
}
