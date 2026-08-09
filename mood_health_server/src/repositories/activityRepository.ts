import { ResultSetHeader, RowDataPacket } from 'mysql2'
import { getMysqlPool } from '../config/mysql'

export interface ActivityDatabase {
  query<T>(sql: string, params?: unknown[]): Promise<[T, unknown]>
  getConnection(): Promise<ActivityConnection>
}

export interface ActivityConnection {
  beginTransaction(): Promise<void>
  commit(): Promise<void>
  rollback(): Promise<void>
  release(): void
  query<T>(sql: string, params?: unknown[]): Promise<[T, unknown]>
}

export interface ActivityDto {
  id: number
  title: string
  description: string
  startTime: string
  endTime: string
  maxParticipants: number
  currentParticipants: number
  location: string
  imageUrl: string | null
  createdAt: string
  updatedAt: string
}

export interface CreateActivityInput {
  title: string
  description: string
  startTime: string
  endTime: string
  maxParticipants: number
  location: string
  imageUrl?: string | null
}

export interface ActivityFilter {
  title?: string
  location?: string
  startDate?: string
  endDate?: string
  status?: string[]
}

export interface ActivityParticipantDto {
  id: number
  username: string
  nickname: string
  avatar: string | null
  joinedAt: string
}

type ActivityRow = RowDataPacket & {
  id: number
  title: string
  description: string
  start_time: Date | string
  end_time: Date | string
  max_participants: number
  current_participants: number
  location: string
  image_url: string | null
  created_at: Date | string
  updated_at: Date | string
}

type ParticipantRow = RowDataPacket & {
  id: number
  username: string
  nickname: string
  avatar: string | null
  joined_at: Date | string
}

const toIsoString = (value: Date | string): string =>
  value instanceof Date ? value.toISOString() : String(value)

const mapActivity = (row: ActivityRow): ActivityDto => ({
  id: row.id,
  title: row.title,
  description: row.description,
  startTime: toIsoString(row.start_time),
  endTime: toIsoString(row.end_time),
  maxParticipants: row.max_participants,
  currentParticipants: row.current_participants,
  location: row.location,
  imageUrl: row.image_url,
  createdAt: toIsoString(row.created_at),
  updatedAt: toIsoString(row.updated_at),
})

const mapParticipant = (row: ParticipantRow): ActivityParticipantDto => ({
  id: row.id,
  username: row.username,
  nickname: row.nickname,
  avatar: row.avatar,
  joinedAt: toIsoString(row.joined_at),
})

const buildFilter = (filter: ActivityFilter): { whereClause: string; params: unknown[] } => {
  const conditions: string[] = []
  const params: unknown[] = []

  if (filter.title) {
    conditions.push('title LIKE ?')
    params.push(`%${filter.title}%`)
  }
  if (filter.location) {
    conditions.push('location = ?')
    params.push(filter.location)
  }
  if (filter.startDate) {
    conditions.push('start_time >= ?')
    params.push(filter.startDate)
  }
  if (filter.endDate) {
    conditions.push('start_time <= ?')
    params.push(filter.endDate)
  }
  if (filter.status?.length) {
    const statusConditions: string[] = []
    if (filter.status.includes('ongoing')) {
      statusConditions.push('(start_time <= NOW(3) AND end_time >= NOW(3))')
    }
    if (filter.status.includes('upcoming')) {
      statusConditions.push('start_time > NOW(3)')
    }
    if (filter.status.includes('ended')) {
      statusConditions.push('end_time < NOW(3)')
    }
    if (filter.status.includes('full')) {
      statusConditions.push('current_participants >= max_participants')
    }
    if (statusConditions.length) {
      conditions.push(`(${statusConditions.join(' OR ')})`)
    }
  }

  return {
    whereClause: conditions.length ? `WHERE ${conditions.join(' AND ')}` : '',
    params,
  }
}

export const createActivityRepository = (db: ActivityDatabase = getMysqlPool()) => {
  const findAll = async (page: number = 1, limit: number = 10, filter: ActivityFilter = {}): Promise<ActivityDto[]> => {
    const { whereClause, params } = buildFilter(filter)
    const [rows] = await db.query<ActivityRow[]>(
      `SELECT * FROM activities ${whereClause} ORDER BY start_time ASC LIMIT ? OFFSET ?`,
      [...params, limit, (page - 1) * limit]
    )
    return rows.map(mapActivity)
  }

  const count = async (filter: ActivityFilter = {}): Promise<number> => {
    const { whereClause, params } = buildFilter(filter)
    const [rows] = await db.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS total FROM activities ${whereClause}`,
      params
    )
    return Number(rows[0]?.total || 0)
  }

  const findById = async (id: number): Promise<ActivityDto | null> => {
    const [rows] = await db.query<ActivityRow[]>(
      'SELECT * FROM activities WHERE id = ? LIMIT 1',
      [id]
    )
    return rows[0] ? mapActivity(rows[0]) : null
  }

  const hasUserJoined = async (activityId: number, userId: number): Promise<boolean> => {
    const [rows] = await db.query<RowDataPacket[]>(
      'SELECT id FROM activity_participants WHERE activity_id = ? AND user_id = ? LIMIT 1',
      [activityId, userId]
    )
    return rows.length > 0
  }

  const join = async (activityId: number, userId: number): Promise<void> => {
    const conn = await db.getConnection()
    try {
      await conn.beginTransaction()

      // 锁定活动行，防止并发报名超限
      const [rows] = await conn.query<RowDataPacket[]>(
        'SELECT current_participants, max_participants FROM activities WHERE id = ? FOR UPDATE',
        [activityId]
      )
      if (rows.length === 0) {
        throw new Error('ACTIVITY_NOT_FOUND')
      }
      if (rows[0].current_participants >= rows[0].max_participants) {
        throw new Error('ACTIVITY_FULL')
      }

      try {
        await conn.query(
          'INSERT INTO activity_participants (activity_id, user_id) VALUES (?, ?)',
          [activityId, userId]
        )
      } catch (error: unknown) {
        if (String((error as Error)?.message || '').includes('Duplicate entry')) {
          throw new Error('ALREADY_JOINED')
        }
        throw error
      }

      await conn.query<ResultSetHeader>(
        'UPDATE activities SET current_participants = current_participants + 1 WHERE id = ?',
        [activityId]
      )

      await conn.commit()
    } catch (error) {
      await conn.rollback()
      throw error
    } finally {
      conn.release()
    }
  }

  const cancelJoin = async (activityId: number, userId: number): Promise<void> => {
    const conn = await db.getConnection()
    try {
      await conn.beginTransaction()

      const [delResult] = await conn.query<ResultSetHeader>(
        'DELETE FROM activity_participants WHERE activity_id = ? AND user_id = ?',
        [activityId, userId]
      )
      if (delResult.affectedRows === 0) throw new Error('NOT_JOINED')

      await conn.query<ResultSetHeader>(
        'UPDATE activities SET current_participants = GREATEST(current_participants - 1, 0) WHERE id = ?',
        [activityId]
      )

      await conn.commit()
    } catch (error) {
      await conn.rollback()
      throw error
    } finally {
      conn.release()
    }
  }

  const getUserJoinedActivities = async (userId: number): Promise<ActivityDto[]> => {
    const [rows] = await db.query<ActivityRow[]>(
      `SELECT a.* FROM activities a
       JOIN activity_participants ap ON a.id = ap.activity_id
       WHERE ap.user_id = ?
       ORDER BY a.start_time ASC`,
      [userId]
    )
    return rows.map(mapActivity)
  }

  const create = async (input: CreateActivityInput): Promise<number> => {
    const [result] = await db.query<ResultSetHeader>(
      `INSERT INTO activities (title, description, start_time, end_time, max_participants, location, image_url)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [input.title, input.description, input.startTime, input.endTime, input.maxParticipants, input.location, input.imageUrl ?? null]
    )
    return result.insertId
  }

  const update = async (id: number, input: Partial<CreateActivityInput>): Promise<boolean> => {
    const clauses: string[] = []
    const params: unknown[] = []
    const fields: Array<{ key: keyof CreateActivityInput; col: string }> = [
      { key: 'title', col: 'title' },
      { key: 'description', col: 'description' },
      { key: 'startTime', col: 'start_time' },
      { key: 'endTime', col: 'end_time' },
      { key: 'maxParticipants', col: 'max_participants' },
      { key: 'location', col: 'location' },
    ]

    for (const { key, col } of fields) {
      if (input[key] !== undefined) {
        clauses.push(`${col} = ?`)
        params.push(input[key])
      }
    }
    if (input.imageUrl !== undefined) {
      clauses.push('image_url = ?')
      params.push(input.imageUrl)
    }
    if (!clauses.length) return false

    const [result] = await db.query<ResultSetHeader>(
      `UPDATE activities SET ${clauses.join(', ')} WHERE id = ?`,
      [...params, id]
    )
    return result.affectedRows > 0
  }

  const remove = async (id: number): Promise<boolean> => {
    const [result] = await db.query<ResultSetHeader>(
      'DELETE FROM activities WHERE id = ?',
      [id]
    )
    return result.affectedRows > 0
  }

  const getParticipants = async (activityId: number): Promise<ActivityParticipantDto[]> => {
    const [rows] = await db.query<ParticipantRow[]>(
      `SELECT u.id, u.username, u.nickname, u.avatar, ap.joined_at
       FROM activity_participants ap
       JOIN users u ON ap.user_id = u.id
       WHERE ap.activity_id = ?
       ORDER BY ap.joined_at ASC`,
      [activityId]
    )
    return rows.map(mapParticipant)
  }

  const createReminder = async (activityId: number, userId: number, remindAt: string): Promise<boolean> => {
    try {
      await db.query(
        `INSERT INTO activity_reminders (activity_id, user_id, remind_at) VALUES (?, ?, ?)`,
        [activityId, userId, remindAt]
      )
      return true
    } catch (error: unknown) {
      if (String((error as Error)?.message || '').includes('Duplicate entry')) {
        return false
      }
      throw error
    }
  }

  const hasReminder = async (activityId: number, userId: number): Promise<boolean> => {
    const [rows] = await db.query<RowDataPacket[]>(
      'SELECT id FROM activity_reminders WHERE activity_id = ? AND user_id = ? LIMIT 1',
      [activityId, userId]
    )
    return rows.length > 0
  }

  const cancelReminder = async (activityId: number, userId: number): Promise<boolean> => {
    const [result] = await db.query<ResultSetHeader>(
      'DELETE FROM activity_reminders WHERE activity_id = ? AND user_id = ?',
      [activityId, userId]
    )
    return result.affectedRows > 0
  }

  return { findAll, count, findById, hasUserJoined, join, cancelJoin, getUserJoinedActivities, create, update, remove, getParticipants, createReminder, hasReminder, cancelReminder }
}

export type ActivityRepository = ReturnType<typeof createActivityRepository>