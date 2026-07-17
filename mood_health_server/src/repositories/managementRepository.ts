import { ResultSetHeader, RowDataPacket } from 'mysql2'
import { createUserRepository } from './userRepository'
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

type RoleIdRow = RowDataPacket & {
  id: number
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

const toMysqlRoleCode = (role: LegacyAdminRole): string => {
  if (role === 'super_admin') return 'super_admin'
  if (role === 'admin') return 'counselor'
  return 'student'
}

const toAdminUserItem = (row: AdminUserRow): AdminUserItem => ({
  id: Number(row.id),
  username: String(row.username),
  email: String(row.email),
  role: toLegacyAdminRole(String(row.role_code)),
  createdAt: toIsoString(row.created_at),
})

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

    return rows.map(toAdminUserItem)
  }

  const findAdminUserById = async (userId: number): Promise<AdminUserItem | null> => {
    const [rows] = await db.query<AdminUserRow[]>(
      `
      SELECT
        u.id,
        u.username,
        u.email,
        r.code AS role_code,
        u.created_at
      FROM users u
      JOIN roles r ON r.id = u.role_id
      WHERE u.id = ?
      LIMIT 1
      `,
      [userId]
    )

    return rows.length > 0 ? toAdminUserItem(rows[0]) : null
  }

  const updateUserRole = async (userId: number, role: LegacyAdminRole): Promise<boolean> => {
    const [roleRows] = await db.query<RoleIdRow[]>(
      'SELECT id FROM roles WHERE code = ? LIMIT 1',
      [toMysqlRoleCode(role)]
    )
    if (roleRows.length === 0) return false

    const [result] = await db.query<ResultSetHeader>(
      `
      UPDATE users
      SET role_id = ?, updated_at = UTC_TIMESTAMP(3)
      WHERE id = ?
      `,
      [roleRows[0].id, userId]
    )
    return result.affectedRows > 0
  }

  const deleteUserById = async (userId: number): Promise<boolean> => {
    const userRepo = createUserRepository(db)
    const result = await userRepo.deleteUser(userId)
    return result.deleted
  }

  const disableUser = async (userId: number): Promise<boolean> => {
    const userRepo = createUserRepository(db)
    return userRepo.disableUser(userId)
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

  const getKpiStats = async (startDate?: string, endDate?: string) => {
    const dateFilter = (startDate && endDate)
      ? 'WHERE created_at >= ? AND created_at <= ?'
      : ''
    const dateParams = (startDate && endDate) ? [startDate, endDate] : []

    const [userRows] = await db.query<CountRow[]>(
      `SELECT COUNT(*) as total FROM users ${dateFilter}`,
      dateParams,
    )
    const [newUserRows] = await db.query<CountRow[]>(
      `SELECT COUNT(*) as total FROM users ${dateFilter}`,
      dateParams,
    )
    const [moodRows] = await db.query<CountRow[]>(
      `SELECT COUNT(*) as total FROM moods ${dateFilter}`,
      dateParams,
    )
    const [moodUserRows] = await db.query<CountRow[]>(
      `SELECT COUNT(DISTINCT user_id) as total FROM moods ${dateFilter}`,
      dateParams,
    )
    const [assessmentRows] = await db.query<CountRow[]>(
      `SELECT COUNT(*) as total FROM assessment_sessions ${dateFilter}`,
      dateParams,
    )
    const [assessmentUserRows] = await db.query<CountRow[]>(
      `SELECT COUNT(DISTINCT user_id) as total FROM assessment_sessions ${dateFilter}`,
      dateParams,
    )
    const [postRows] = await db.query<CountRow[]>(
      `SELECT COUNT(*) as total FROM posts ${dateFilter}`,
      dateParams,
    )
    const [pendingPostRows] = await db.query<CountRow[]>(
      `SELECT COUNT(*) as total FROM posts WHERE status = 'pending' ${startDate && endDate ? 'AND created_at >= ? AND created_at <= ?' : ''}`,
      dateParams,
    )
    const [activityRows] = await db.query<CountRow[]>(
      `SELECT COUNT(*) as total FROM activities ${dateFilter}`,
      dateParams,
    )
    const [activityParticipantRows] = await db.query<CountRow[]>(
      `SELECT COUNT(DISTINCT user_id) as total FROM activity_participants ${dateFilter}`,
      dateParams,
    )
    const [aiRows] = await db.query<CountRow[]>(
      `SELECT COUNT(*) as total FROM ai_analysis_history ${dateFilter}`,
      dateParams,
    )
    const [aiUserRows] = await db.query<CountRow[]>(
      `SELECT COUNT(DISTINCT user_id) as total FROM ai_analysis_history ${dateFilter}`,
      dateParams,
    )
    const [relaxRows] = await db.query<CountRow[]>(
      `SELECT COUNT(*) as total FROM relax_records ${dateFilter}`,
      dateParams,
    )

    return {
      totalUsers: Number(userRows[0]?.total || 0),
      newUsers: Number(newUserRows[0]?.total || 0),
      totalMoodRecords: Number(moodRows[0]?.total || 0),
      moodRecordUsers: Number(moodUserRows[0]?.total || 0),
      totalAssessments: Number(assessmentRows[0]?.total || 0),
      assessmentUsers: Number(assessmentUserRows[0]?.total || 0),
      totalPosts: Number(postRows[0]?.total || 0),
      pendingPosts: Number(pendingPostRows[0]?.total || 0),
      totalActivities: Number(activityRows[0]?.total || 0),
      activityParticipants: Number(activityParticipantRows[0]?.total || 0),
      totalAiCalls: Number(aiRows[0]?.total || 0),
      aiUsers: Number(aiUserRows[0]?.total || 0),
      totalRelaxSessions: Number(relaxRows[0]?.total || 0),
    }
  }

  const getMoodTrend = async (startDate: string, endDate: string, granularity: 'day' | 'week' = 'day') => {
    const groupFormat = granularity === 'week' ? '%Y-%u' : '%Y-%m-%d'
    const [rows] = await db.query<Array<RowDataPacket & { date: string; count: number; avgIntensity: number }>>(
      `SELECT DATE_FORMAT(created_at, '${groupFormat}') as date, COUNT(*) as count, AVG(intensity) as avgIntensity
       FROM moods
       WHERE created_at >= ? AND created_at <= ?
       GROUP BY DATE_FORMAT(created_at, '${groupFormat}')
       ORDER BY date`,
      [startDate, endDate],
    )
    return rows.map((r) => ({
      date: r.date,
      count: Number(r.count),
      avgIntensity: Math.round(Number(r.avgIntensity || 0) * 10) / 10,
    }))
  }

  const getMoodDistribution = async (startDate: string, endDate: string) => {
    const [rows] = await db.query<Array<RowDataPacket & { type: string; count: number }>>(
      `SELECT et.name as type, COUNT(*) as count
       FROM mood_emotions me
       JOIN emotion_types et ON et.id = me.emotion_type_id
       JOIN moods m ON m.id = me.mood_id
       WHERE m.created_at >= ? AND m.created_at <= ?
       GROUP BY et.name
       ORDER BY count DESC`,
      [startDate, endDate],
    )
    return rows.map((r) => ({
      type: r.type,
      count: Number(r.count),
    }))
  }

  const getAssessmentDistribution = async (startDate: string, endDate: string, instrumentId?: number) => {
    let instrumentFilter = ''
    const params: unknown[] = [startDate, endDate]
    if (instrumentId) {
      instrumentFilter = 'AND a.instrument_id = ?'
      params.push(instrumentId)
    }

    const [instrumentRows] = await db.query<Array<RowDataPacket & { id: number; name: string; count: number }>>(
      `SELECT a.instrument_id as id, ai.title as name, COUNT(*) as count
       FROM assessment_sessions a
       LEFT JOIN assessment_instruments ai ON ai.id = a.instrument_id
       WHERE a.created_at >= ? AND a.created_at <= ? ${instrumentFilter}
       GROUP BY a.instrument_id, ai.title
       ORDER BY count DESC`,
      params,
    )

    const [scoreRows] = await db.query<Array<RowDataPacket & { range: string; count: number }>>(
      `SELECT
         CASE
           WHEN total_score < 10 THEN '0-10'
           WHEN total_score < 20 THEN '10-20'
           WHEN total_score < 30 THEN '20-30'
           ELSE '30+'
         END as \`range\`,
         COUNT(*) as count
       FROM assessment_sessions
       WHERE created_at >= ? AND created_at <= ? ${instrumentFilter}
       GROUP BY CASE
         WHEN total_score < 10 THEN '0-10'
         WHEN total_score < 20 THEN '10-20'
         WHEN total_score < 30 THEN '20-30'
         ELSE '30+'
       END`,
      params,
    )

    const [riskRows] = await db.query<Array<RowDataPacket & { level: string; count: number }>>(
      `SELECT risk_level as level, COUNT(*) as count
       FROM assessment_sessions
       WHERE created_at >= ? AND created_at <= ? ${instrumentFilter}
       GROUP BY risk_level`,
      params,
    )

    return {
      instruments: instrumentRows.map((r) => ({ id: Number(r.id), name: r.name || '未知', count: Number(r.count) })),
      scoreRanges: scoreRows.map((r) => ({ range: r.range, count: Number(r.count) })),
      riskLevels: riskRows.map((r) => ({ level: r.level || 'normal', count: Number(r.count) })),
    }
  }

  const getModuleUsage = async (startDate: string, endDate: string) => {
    const params = [startDate, endDate]

    const [moodCount] = await db.query<CountRow[]>(
      'SELECT COUNT(*) as total FROM moods WHERE created_at >= ? AND created_at <= ?', params,
    )
    const [assessmentCount] = await db.query<CountRow[]>(
      'SELECT COUNT(*) as total FROM assessment_sessions WHERE created_at >= ? AND created_at <= ?', params,
    )
    const [postCount] = await db.query<CountRow[]>(
      'SELECT COUNT(*) as total FROM posts WHERE created_at >= ? AND created_at <= ?', params,
    )
    const [activityCount] = await db.query<CountRow[]>(
      'SELECT COUNT(*) as total FROM activities WHERE created_at >= ? AND created_at <= ?', params,
    )
    const [relaxCount] = await db.query<CountRow[]>(
      'SELECT COUNT(*) as total FROM relax_records WHERE created_at >= ? AND created_at <= ?', params,
    )
    const [aiCount] = await db.query<CountRow[]>(
      'SELECT COUNT(*) as total FROM ai_analysis_history WHERE created_at >= ? AND created_at <= ?', params,
    )

    return [
      { name: '情绪记录', metric: '条', count: Number(moodCount[0]?.total || 0), description: '用户情绪记录总数' },
      { name: '心理测评', metric: '次', count: Number(assessmentCount[0]?.total || 0), description: '测评提交次数' },
      { name: '树洞社区', metric: '条', count: Number(postCount[0]?.total || 0), description: '社区内容发布数' },
      { name: '活动', metric: '个', count: Number(activityCount[0]?.total || 0), description: '活动创建数' },
      { name: '放松疗愈', metric: '次', count: Number(relaxCount[0]?.total || 0), description: '放松练习次数' },
      { name: 'AI 分析', metric: '次', count: Number(aiCount[0]?.total || 0), description: 'AI 分析调用次数' },
    ]
  }

  return {
    listAdminUsers,
    findAdminUserById,
    updateUserRole,
    deleteUserById,
    disableUser,
    listAdminMoods,
    getKpiStats,
    getMoodTrend,
    getMoodDistribution,
    getAssessmentDistribution,
    getModuleUsage,
  }
}

export type ManagementRepository = ReturnType<typeof createManagementRepository>
