import { sqliteAll, sqliteGet, sqliteRun, sqliteTransaction } from '../config/sqlite'

export interface Activity {
  id: number
  title: string
  description: string
  start_time: Date
  end_time: Date
  max_participants: number
  current_participants: number
  location: string
  image_url?: string
  created_at: Date
  updated_at: Date
}

export interface ActivityFilter {
  title?: string
  location?: string
  startDate?: string
  endDate?: string
  status?: string[]
}

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
    conditions.push('datetime(start_time) >= datetime(?)')
    params.push(filter.startDate)
  }
  if (filter.endDate) {
    conditions.push('datetime(start_time) <= datetime(?)')
    params.push(filter.endDate)
  }
  if (filter.status?.length) {
    const statusConditions: string[] = []
    if (filter.status.includes('ongoing')) {
      statusConditions.push(
        "(datetime(start_time) <= datetime('now', 'localtime') AND datetime(end_time) >= datetime('now', 'localtime'))"
      )
    }
    if (filter.status.includes('upcoming')) {
      statusConditions.push("datetime(start_time) > datetime('now', 'localtime')")
    }
    if (filter.status.includes('ended')) {
      statusConditions.push("datetime(end_time) < datetime('now', 'localtime')")
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

export const getActivities = async (
  page: number = 1,
  limit: number = 10,
  filter: ActivityFilter = {}
) => {
  const { whereClause, params } = buildFilter(filter)
  return sqliteAll(
    `SELECT * FROM activities ${whereClause} ORDER BY datetime(start_time) ASC LIMIT ? OFFSET ?`,
    [...params, limit, (page - 1) * limit]
  ) as unknown as Activity[]
}

export const getActivitiesCount = async (filter: ActivityFilter = {}): Promise<number> => {
  const { whereClause, params } = buildFilter(filter)
  const row = sqliteGet(
    `SELECT COUNT(*) AS total FROM activities ${whereClause}`,
    params
  ) as { total: number } | undefined
  return Number(row?.total || 0)
}

export const getActivityById = async (id: number): Promise<Activity | null> => {
  const row = sqliteGet('SELECT * FROM activities WHERE id = ?', [id]) as Activity | undefined
  return row || null
}

export const hasUserJoined = async (activityId: number, userId: number): Promise<boolean> =>
  Boolean(
    sqliteGet('SELECT id FROM activity_participants WHERE activity_id = ? AND user_id = ?', [
      activityId,
      userId,
    ])
  )

export const joinActivity = async (activityId: number, userId: number) => {
  try {
    return sqliteTransaction(() => {
      try {
        sqliteRun('INSERT INTO activity_participants (activity_id, user_id) VALUES (?, ?)', [
          activityId,
          userId,
        ])
      } catch (error: any) {
        if (String(error?.message || '').includes('UNIQUE constraint failed')) {
          throw new Error('ALREADY_JOINED')
        }
        throw error
      }

      const result = sqliteRun(
        'UPDATE activities SET current_participants = current_participants + 1 WHERE id = ? AND current_participants < max_participants',
        [activityId]
      )
      if (result.changes === 0) throw new Error('ACTIVITY_FULL')
      return true
    })
  } catch (error: any) {
    if (error?.message === 'ALREADY_JOINED' || error?.message === 'ACTIVITY_FULL') throw error
    throw new Error('JOIN_ACTIVITY_FAILED')
  }
}

export const cancelJoinActivity = async (activityId: number, userId: number) =>
  sqliteTransaction(() => {
    const result = sqliteRun(
      'DELETE FROM activity_participants WHERE activity_id = ? AND user_id = ?',
      [activityId, userId]
    )
    if (result.changes === 0) throw new Error('NOT_JOINED')

    sqliteRun(
      'UPDATE activities SET current_participants = CASE WHEN current_participants > 0 THEN current_participants - 1 ELSE 0 END WHERE id = ?',
      [activityId]
    )
    return true
  })

export const getUserJoinedActivities = async (userId: number) =>
  sqliteAll(
    `
      SELECT a.*
      FROM activities a
      JOIN activity_participants ap ON a.id = ap.activity_id
      WHERE ap.user_id = ?
      ORDER BY datetime(a.start_time) ASC
    `,
    [userId]
  )

export const createActivity = async (
  title: string,
  description: string,
  startTime: string,
  endTime: string,
  maxParticipants: number,
  location: string,
  imageUrl?: string
) => {
  const result = sqliteRun(
    `
      INSERT INTO activities (
        title, description, start_time, end_time, max_participants, location, image_url
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
    [title, description, startTime, endTime, maxParticipants, location, imageUrl || null]
  )
  return Number(result.lastInsertRowid)
}

export const updateActivity = async (
  id: number,
  title: string,
  description: string,
  startTime: string,
  endTime: string,
  maxParticipants: number,
  location: string,
  imageUrl?: string
) =>
  sqliteRun(
    `
      UPDATE activities
      SET title = ?, description = ?, start_time = ?, end_time = ?, max_participants = ?,
          location = ?, image_url = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `,
    [title, description, startTime, endTime, maxParticipants, location, imageUrl || null, id]
  )

export const deleteActivity = async (id: number) =>
  sqliteTransaction(() => {
    sqliteRun('DELETE FROM activity_participants WHERE activity_id = ?', [id])
    return sqliteRun('DELETE FROM activities WHERE id = ?', [id])
  })

export const getActivityParticipants = async (activityId: number) =>
  sqliteAll(
    `
      SELECT u.id, u.username, u.nickname, u.avatar, ap.joined_at
      FROM activity_participants ap
      JOIN users u ON ap.user_id = u.id
      WHERE ap.activity_id = ?
      ORDER BY datetime(ap.joined_at) ASC
    `,
    [activityId]
  )
