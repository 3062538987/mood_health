import { sqliteAll, sqliteGet, sqliteRun } from '../config/sqlite'
import logger from '../utils/logger'

export interface RelaxRecordInput {
  activityType: string
  startTime: string
  endTime: string
  metrics?: Record<string, unknown>
  moodTag?: string
}

export interface RelaxRecordEntity {
  id: string
  userId: string
  activityType: string
  startTime: string
  endTime: string
  metrics: Record<string, unknown>
  moodTag?: string
}

export interface RelaxStatisticsEntity {
  todayDuration: number
  thisWeekCount: number
  mostUsedActivity: string
  activityBreakdown: Array<{ type: string; count: number; duration: number }>
}

let relaxSchemaChecked = false

const parseMetrics = (raw: unknown): Record<string, unknown> => {
  if (!raw) return {}
  if (typeof raw === 'object') return raw as Record<string, unknown>
  if (typeof raw !== 'string') return {}
  try {
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {}
  } catch {
    return {}
  }
}

const mapRecord = (row: Record<string, unknown>): RelaxRecordEntity => ({
  id: String(row.id),
  userId: String(row.userId),
  activityType: String(row.activityType),
  startTime: new Date(String(row.startTime)).toISOString(),
  endTime: new Date(String(row.endTime)).toISOString(),
  metrics: parseMetrics(row.metrics),
  moodTag: row.moodTag ? String(row.moodTag) : undefined,
})

const ensureRelaxSchema = () => {
  if (relaxSchemaChecked) return
  sqliteRun(`
    CREATE TABLE IF NOT EXISTS relax_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      activity_type TEXT NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      metrics TEXT,
      mood_tag TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `)
  sqliteRun('CREATE INDEX IF NOT EXISTS idx_relax_records_user_id ON relax_records(user_id)')
  sqliteRun(
    'CREATE INDEX IF NOT EXISTS idx_relax_records_start_time ON relax_records(start_time DESC)'
  )
  relaxSchemaChecked = true
}

const selectFields = `
  id,
  user_id AS userId,
  activity_type AS activityType,
  start_time AS startTime,
  end_time AS endTime,
  metrics,
  mood_tag AS moodTag
`

export const saveRelaxRecord = async (
  userId: number,
  record: RelaxRecordInput
): Promise<RelaxRecordEntity> => {
  ensureRelaxSchema()
  const result = sqliteRun(
    `INSERT INTO relax_records (user_id, activity_type, start_time, end_time, metrics, mood_tag)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      userId,
      record.activityType,
      new Date(record.startTime).toISOString(),
      new Date(record.endTime).toISOString(),
      JSON.stringify(record.metrics || {}),
      record.moodTag || null,
    ]
  )
  const row = sqliteGet(`SELECT ${selectFields} FROM relax_records WHERE id = ?`, [
    Number(result.lastInsertRowid),
  ]) as Record<string, unknown>
  return mapRecord(row)
}

export const getRelaxRecords = async (
  userId: number,
  params: {
    startDate?: string
    endDate?: string
    activityType?: string
    page?: number
    pageSize?: number
  }
): Promise<{ records: RelaxRecordEntity[]; total: number }> => {
  ensureRelaxSchema()
  const page = params.page && params.page > 0 ? Math.floor(params.page) : 1
  const pageSize =
    params.pageSize && params.pageSize > 0 ? Math.min(Math.floor(params.pageSize), 100) : 20
  const filters = ['user_id = ?']
  const values: unknown[] = [userId]

  if (params.startDate) {
    filters.push('datetime(start_time) >= datetime(?)')
    values.push(new Date(params.startDate).toISOString())
  }
  if (params.endDate) {
    filters.push('datetime(start_time) <= datetime(?)')
    values.push(new Date(params.endDate).toISOString())
  }
  if (params.activityType) {
    filters.push('activity_type = ?')
    values.push(params.activityType)
  }

  const where = filters.join(' AND ')
  const count = sqliteGet(`SELECT COUNT(*) AS total FROM relax_records WHERE ${where}`, values) as
    | { total: number }
    | undefined
  const rows = sqliteAll(
    `SELECT ${selectFields} FROM relax_records WHERE ${where}
     ORDER BY datetime(start_time) DESC LIMIT ? OFFSET ?`,
    [...values, pageSize, (page - 1) * pageSize]
  ) as Array<Record<string, unknown>>
  return { records: rows.map(mapRecord), total: Number(count?.total || 0) }
}

export const getRelaxRecordById = async (
  userId: number,
  id: number
): Promise<RelaxRecordEntity | null> => {
  ensureRelaxSchema()
  const row = sqliteGet(
    `SELECT ${selectFields} FROM relax_records WHERE id = ? AND user_id = ?`,
    [id, userId]
  ) as Record<string, unknown> | undefined
  return row ? mapRecord(row) : null
}

export const getRelaxStatistics = async (
  userId: number,
  params: { startDate?: string; endDate?: string }
): Promise<RelaxStatisticsEntity> => {
  const { records } = await getRelaxRecords(userId, { ...params, page: 1, pageSize: 500 })
  const today = new Date().toISOString().slice(0, 10)
  const weekAgo = new Date()
  weekAgo.setDate(weekAgo.getDate() - 7)
  const totals = new Map<string, { count: number; duration: number }>()
  let todayDuration = 0
  let thisWeekCount = 0

  for (const record of records) {
    const duration = Math.max(
      0,
      new Date(record.endTime).getTime() - new Date(record.startTime).getTime()
    )
    const item = totals.get(record.activityType) || { count: 0, duration: 0 }
    item.count += 1
    item.duration += duration
    totals.set(record.activityType, item)
    if (record.startTime.slice(0, 10) === today) todayDuration += duration
    if (new Date(record.startTime) >= weekAgo) thisWeekCount += 1
  }

  let mostUsedActivity = ''
  let maxCount = 0
  const activityBreakdown = Array.from(totals.entries()).map(([type, value]) => {
    if (value.count > maxCount) {
      mostUsedActivity = type
      maxCount = value.count
    }
    return { type, ...value }
  })
  return { todayDuration, thisWeekCount, mostUsedActivity, activityBreakdown }
}

export const logRelaxError = (
  message: string,
  error: unknown,
  extra?: Record<string, unknown>
) => logger.error(message, { ...extra, error })
