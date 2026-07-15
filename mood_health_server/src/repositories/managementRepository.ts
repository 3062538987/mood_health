import { RowDataPacket } from 'mysql2'
import { getMysqlPool } from '../config/mysql'

export interface ManagementDatabase {
  query<T>(sql: string, params?: unknown[]): Promise<[T, unknown]>
}

export type LegacyAdminRole = 'user' | 'admin' | 'super_admin'

export interface AdminUserItem {
  id: number
  username: string
  email: string
  role: LegacyAdminRole
  createdAt: string
}

export interface AdminMoodRecordItem {
  id: number
  userId: number
  username: string
  moodType: string[]
  intensity: number
  createdAt: string
}

export interface AdminMoodListOptions {
  page: number
  pageSize: number
  userId?: number
  username?: string
  startDate?: string
  endDate?: string
  moodType?: string
}

type AdminUserRow = RowDataPacket & {
  id: number
  username: string
  email: string
  role_code: string
  created_at: Date | string | null
}

type CountRow = RowDataPacket & {
  total: number
}

type AdminMoodRow = RowDataPacket & {
  id: number
  userId: number
  username: string | null
  moodTypes: string | null
  intensity: number | string | null
  createdAt: Date | string | null
}

const toIsoString = (value: Date | string | null): string => {
  if (!value) return ''
  return value instanceof Date ? value.toISOString() : String(value)
}

const toLegacyAdminRole = (roleCode: string): LegacyAdminRole => {
  if (roleCode === 'super_admin') return 'super_admin'
  if (roleCode === 'counselor') return 'admin'
  return 'user'
}

export const createManagementRepository = (db: ManagementDatabase = getMysqlPool()) => {
  const listAdminUsers = async (): Promise<AdminUserItem[]> => {
    const [rows] = await db.query<AdminUserRow[]>(`
      SELECT
        u.id,
        u.username,
        u.email,
        r.code AS role_code,
        u.created_at
      FROM users u
      JOIN roles r ON r.id = u.role_id
      ORDER BY u.id DESC
    `)

    return rows.map((row) => ({
      id: Number(row.id),
      username: String(row.username),
      email: String(row.email),
      role: toLegacyAdminRole(String(row.role_code)),
      createdAt: toIsoString(row.created_at),
    }))
  }

  const buildMoodFilters = (options: AdminMoodListOptions): { where: string; params: unknown[] } => {
    const conditions: string[] = []
    const params: unknown[] = []

    if (options.userId) {
      conditions.push('m.user_id = ?')
      params.push(options.userId)
    }
    if (options.username) {
      conditions.push('u.username LIKE ?')
      params.push(`%${options.username}%`)
    }
    if (options.startDate) {
      conditions.push('DATE(m.recorded_at) >= ?')
      params.push(options.startDate)
    }
    if (options.endDate) {
      conditions.push('DATE(m.recorded_at) <= ?')
      params.push(options.endDate)
    }
    if (options.moodType) {
      conditions.push('et.name LIKE ?')
      params.push(`%${options.moodType}%`)
    }

    return {
      where: conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '',
      params,
    }
  }

  const listAdminMoods = async (options: AdminMoodListOptions) => {
    const offset = (options.page - 1) * options.pageSize
    const filters = buildMoodFilters(options)

    const [countRows] = await db.query<CountRow[]>(
      `
        SELECT COUNT(DISTINCT m.id) AS total
        FROM moods m
        JOIN users u ON u.id = m.user_id
        LEFT JOIN mood_emotions me ON me.mood_id = m.id
        LEFT JOIN emotion_types et ON et.id = me.emotion_type_id
        ${filters.where}
      `,
      filters.params
    )

    const [rows] = await db.query<AdminMoodRow[]>(
      `
        SELECT
          m.id,
          m.user_id AS userId,
          u.username,
          GROUP_CONCAT(DISTINCT et.name ORDER BY et.name SEPARATOR ',') AS moodTypes,
          AVG(me.intensity) AS intensity,
          m.created_at AS createdAt
        FROM moods m
        JOIN users u ON u.id = m.user_id
        LEFT JOIN mood_emotions me ON me.mood_id = m.id
        LEFT JOIN emotion_types et ON et.id = me.emotion_type_id
        ${filters.where}
        GROUP BY m.id, m.user_id, u.username, m.created_at
        ORDER BY m.created_at DESC, m.id DESC
        LIMIT ? OFFSET ?
      `,
      [...filters.params, options.pageSize, offset]
    )

    return {
      list: rows.map((row) => ({
        id: Number(row.id),
        userId: Number(row.userId),
        username: String(row.username || ''),
        moodType: row.moodTypes
          ? String(row.moodTypes)
              .split(',')
              .map((item) => item.trim())
              .filter(Boolean)
          : [],
        intensity: Number(row.intensity || 0),
        createdAt: toIsoString(row.createdAt),
      })),
      total: Number(countRows[0]?.total || 0),
      page: options.page,
      pageSize: options.pageSize,
    }
  }

  return {
    listAdminUsers,
    listAdminMoods,
  }
}

export type ManagementRepository = ReturnType<typeof createManagementRepository>
