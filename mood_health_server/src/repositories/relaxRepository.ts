import { ResultSetHeader, RowDataPacket } from 'mysql2'
import { getMysqlPool } from '../config/mysql'

export interface RelaxDatabase {
  query<T>(sql: string, params?: unknown[]): Promise<[T, unknown]>
}

export interface RelaxRecordDto {
  id: number
  userId: number
  activityType: string
  startTime: string
  endTime: string
  metrics: Record<string, unknown>
  moodTag: string | null
  createdAt: string
}

export interface CreateRelaxRecordInput {
  activityType: string
  startTime: string
  endTime: string
  metrics?: Record<string, unknown>
  moodTag?: string | null
}

export interface RelaxStatisticsDto {
  todayDuration: number
  thisWeekCount: number
  mostUsedActivity: string
  activityBreakdown: Array<{ type: string; count: number; duration: number }>
}

export interface RelaxQueryParams {
  startDate?: string
  endDate?: string
  activityType?: string
  page?: number
  pageSize?: number
}

type RelaxRecordRow = RowDataPacket & {
  id: number
  user_id: number
  activity_type: string
  start_time: Date | string
  end_time: Date | string
  metrics: string | Record<string, unknown> | null
  mood_tag: string | null
  created_at: Date | string
}

const toIsoString = (value: Date | string): string =>
  value instanceof Date ? value.toISOString() : String(value)

const parseMetrics = (raw: unknown): Record<string, unknown> => {
  if (!raw) return {}
  if (typeof raw === 'object' && !Array.isArray(raw)) return raw as Record<string, unknown>
  if (typeof raw === 'string') {
    try { return JSON.parse(raw) } catch { return {} }
  }
  return {}
}

const mapRecord = (row: RelaxRecordRow): RelaxRecordDto => ({
  id: row.id,
  userId: row.user_id,
  activityType: row.activity_type,
  startTime: toIsoString(row.start_time),
  endTime: toIsoString(row.end_time),
  metrics: parseMetrics(row.metrics),
  moodTag: row.mood_tag,
  createdAt: toIsoString(row.created_at),
})

export const createRelaxRepository = (db: RelaxDatabase = getMysqlPool()) => {
  const create = async (userId: number, input: CreateRelaxRecordInput): Promise<RelaxRecordDto> => {
    const [result] = await db.query<ResultSetHeader>(
      `INSERT INTO relax_records (user_id, activity_type, start_time, end_time, metrics, mood_tag)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        userId,
        input.activityType,
        new Date(input.startTime).toISOString().slice(0, 23).replace('T', ' '),
        new Date(input.endTime).toISOString().slice(0, 23).replace('T', ' '),
        JSON.stringify(input.metrics || {}),
        input.moodTag ?? null,
      ]
    )

    const [rows] = await db.query<RelaxRecordRow[]>(
      'SELECT * FROM relax_records WHERE id = ? LIMIT 1',
      [result.insertId]
    )
    return mapRecord(rows[0])
  }

  const findAll = async (userId: number, params: RelaxQueryParams): Promise<{ records: RelaxRecordDto[]; total: number }> => {
    const page = params.page && params.page > 0 ? Math.floor(params.page) : 1
    const pageSize = params.pageSize && params.pageSize > 0 ? Math.min(Math.floor(params.pageSize), 100) : 20
    const filters: string[] = ['user_id = ?']
    const values: unknown[] = [userId]

    if (params.startDate) {
      filters.push('start_time >= ?')
      values.push(new Date(params.startDate).toISOString().slice(0, 23).replace('T', ' '))
    }
    if (params.endDate) {
      filters.push('start_time <= ?')
      values.push(new Date(params.endDate).toISOString().slice(0, 23).replace('T', ' '))
    }
    if (params.activityType) {
      filters.push('activity_type = ?')
      values.push(params.activityType)
    }

    const where = filters.join(' AND ')

    const [countRows] = await db.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS total FROM relax_records WHERE ${where}`,
      values
    )
    const total = Number(countRows[0]?.total || 0)

    const [rows] = await db.query<RelaxRecordRow[]>(
      `SELECT * FROM relax_records WHERE ${where} ORDER BY start_time DESC LIMIT ? OFFSET ?`,
      [...values, pageSize, (page - 1) * pageSize]
    )
    return { records: rows.map(mapRecord), total }
  }

  const findById = async (userId: number, id: number): Promise<RelaxRecordDto | null> => {
    const [rows] = await db.query<RelaxRecordRow[]>(
      'SELECT * FROM relax_records WHERE id = ? AND user_id = ? LIMIT 1',
      [id, userId]
    )
    return rows[0] ? mapRecord(rows[0]) : null
  }

  const getStatistics = async (userId: number, params: { startDate?: string; endDate?: string }): Promise<RelaxStatisticsDto> => {
    const { records } = await findAll(userId, { ...params, page: 1, pageSize: 500 })
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

  return { create, findAll, findById, getStatistics }
}

export type RelaxRepository = ReturnType<typeof createRelaxRepository>