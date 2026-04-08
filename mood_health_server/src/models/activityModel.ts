import pool, { isSqliteClient } from '../config/database'
import { sqliteAll, sqliteGet, sqliteRun, sqliteTransaction } from '../config/sqlite'
import sql from 'mssql'

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

const buildSqlServerFilterConditions = (
  request: sql.Request,
  filter: ActivityFilter
): { whereClause: string } => {
  const conditions: string[] = []

  if (filter.title) {
    request.input('title', sql.NVarChar, `%${filter.title}%`)
    conditions.push('title LIKE @title')
  }

  if (filter.location) {
    request.input('location', sql.NVarChar, filter.location)
    conditions.push('location = @location')
  }

  if (filter.startDate) {
    request.input('startDate', sql.DateTime, filter.startDate)
    conditions.push('start_time >= @startDate')
  }

  if (filter.endDate) {
    request.input('endDate', sql.DateTime, filter.endDate)
    conditions.push('start_time <= @endDate')
  }

  if (filter.status && filter.status.length > 0) {
    const now = new Date().toISOString()
    const statusConditions: string[] = []

    if (filter.status.includes('ongoing')) {
      statusConditions.push(`(start_time <= '${now}' AND end_time >= '${now}')`)
    }
    if (filter.status.includes('upcoming')) {
      statusConditions.push(`(start_time > '${now}')`)
    }
    if (filter.status.includes('ended')) {
      statusConditions.push(`(end_time < '${now}')`)
    }
    if (filter.status.includes('full')) {
      statusConditions.push('(current_participants >= max_participants)')
    }

    if (statusConditions.length > 0) {
      conditions.push(`(${statusConditions.join(' OR ')})`)
    }
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
  return { whereClause }
}

const buildSqliteFilterConditions = (
  filter: ActivityFilter
): { whereClause: string; params: unknown[] } => {
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

  if (filter.status && filter.status.length > 0) {
    const statusConditions: string[] = []

    if (filter.status.includes('ongoing')) {
      statusConditions.push(
        "(datetime(start_time) <= datetime('now', 'localtime') AND datetime(end_time) >= datetime('now', 'localtime'))"
      )
    }
    if (filter.status.includes('upcoming')) {
      statusConditions.push("(datetime(start_time) > datetime('now', 'localtime'))")
    }
    if (filter.status.includes('ended')) {
      statusConditions.push("(datetime(end_time) < datetime('now', 'localtime'))")
    }
    if (filter.status.includes('full')) {
      statusConditions.push('(current_participants >= max_participants)')
    }

    if (statusConditions.length > 0) {
      conditions.push(`(${statusConditions.join(' OR ')})`)
    }
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
  return { whereClause, params }
}

const getActivitiesSqlServer = async (
  page: number = 1,
  limit: number = 10,
  filter: ActivityFilter = {}
) => {
  const offset = (page - 1) * limit
  const request = pool.request()
  const { whereClause } = buildSqlServerFilterConditions(request, filter)

  const result = await request.input('offset', sql.Int, offset).input('limit', sql.Int, limit)
    .query(`
      SELECT *
      FROM activities
      ${whereClause}
      ORDER BY start_time ASC
      OFFSET @offset ROWS
      FETCH NEXT @limit ROWS ONLY
    `)

  return result.recordset
}

const getActivitiesSqlite = async (
  page: number = 1,
  limit: number = 10,
  filter: ActivityFilter = {}
) => {
  const offset = (page - 1) * limit
  const { whereClause, params } = buildSqliteFilterConditions(filter)

  return sqliteAll(
    `
      SELECT *
      FROM activities
      ${whereClause}
      ORDER BY datetime(start_time) ASC
      LIMIT ? OFFSET ?
    `,
    [...params, limit, offset]
  ) as unknown as Activity[]
}

export const getActivities = async (
  page: number = 1,
  limit: number = 10,
  filter: ActivityFilter = {}
) => {
  if (isSqliteClient) {
    return getActivitiesSqlite(page, limit, filter)
  }
  return getActivitiesSqlServer(page, limit, filter)
}

const getActivitiesCountSqlServer = async (filter: ActivityFilter = {}): Promise<number> => {
  const request = pool.request()
  const { whereClause } = buildSqlServerFilterConditions(request, filter)

  const result = await request.query(`
    SELECT COUNT(*) as total
    FROM activities
    ${whereClause}
  `)

  return result.recordset[0].total
}

const getActivitiesCountSqlite = async (filter: ActivityFilter = {}): Promise<number> => {
  const { whereClause, params } = buildSqliteFilterConditions(filter)
  const row = sqliteGet(
    `
      SELECT COUNT(*) as total
      FROM activities
      ${whereClause}
    `,
    params
  ) as { total: number } | undefined

  return row?.total || 0
}

export const getActivitiesCount = async (filter: ActivityFilter = {}): Promise<number> => {
  if (isSqliteClient) {
    return getActivitiesCountSqlite(filter)
  }
  return getActivitiesCountSqlServer(filter)
}

const getActivityByIdSqlServer = async (id: number): Promise<Activity | null> => {
  const result = await pool
    .request()
    .input('id', sql.Int, id)
    .query('SELECT * FROM activities WHERE id = @id')
  return result.recordset.length ? result.recordset[0] : null
}

const getActivityByIdSqlite = async (id: number): Promise<Activity | null> => {
  const row = sqliteGet('SELECT * FROM activities WHERE id = ?', [id]) as Activity | undefined
  return row || null
}

export const getActivityById = async (id: number): Promise<Activity | null> => {
  if (isSqliteClient) {
    return getActivityByIdSqlite(id)
  }
  return getActivityByIdSqlServer(id)
}

const hasUserJoinedSqlServer = async (activityId: number, userId: number): Promise<boolean> => {
  const result = await pool
    .request()
    .input('activityId', sql.Int, activityId)
    .input('userId', sql.Int, userId)
    .query(
      'SELECT id FROM activity_participants WHERE activity_id = @activityId AND user_id = @userId'
    )
  return result.recordset.length > 0
}

const hasUserJoinedSqlite = async (activityId: number, userId: number): Promise<boolean> => {
  const row = sqliteGet(
    'SELECT id FROM activity_participants WHERE activity_id = ? AND user_id = ?',
    [activityId, userId]
  )
  return !!row
}

export const hasUserJoined = async (activityId: number, userId: number): Promise<boolean> => {
  if (isSqliteClient) {
    return hasUserJoinedSqlite(activityId, userId)
  }
  return hasUserJoinedSqlServer(activityId, userId)
}

const TRANSACTION_TIMEOUT = 5000

const executeTransactionWithTimeout = async <T>(
  transaction: sql.Transaction,
  operations: () => Promise<T>
): Promise<T> => {
  let timeoutId: NodeJS.Timeout

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error('TRANSACTION_TIMEOUT'))
    }, TRANSACTION_TIMEOUT)
  })

  try {
    await transaction.begin()

    const result = await Promise.race([operations(), timeoutPromise])

    clearTimeout(timeoutId!)
    await transaction.commit()
    return result
  } catch (error) {
    clearTimeout(timeoutId!)
    await transaction.rollback()
    throw error
  }
}

const joinActivitySqlServer = async (activityId: number, userId: number) => {
  const transaction = new sql.Transaction(pool)

  const operations = async () => {
    try {
      await transaction
        .request()
        .input('activityId', sql.Int, activityId)
        .input('userId', sql.Int, userId).query(`
          INSERT INTO activity_participants (activity_id, user_id)
          VALUES (@activityId, @userId)
        `)
    } catch (error: any) {
      if (error.number === 2627 || error.number === 2601) {
        throw new Error('ALREADY_JOINED')
      }
      throw error
    }

    const updateResult = await transaction.request().input('activityId', sql.Int, activityId)
      .query(`
        UPDATE activities
        SET current_participants = current_participants + 1
        WHERE id = @activityId
          AND current_participants < max_participants
      `)

    if (updateResult.rowsAffected[0] === 0) {
      throw new Error('ACTIVITY_FULL')
    }

    return true
  }

  return executeTransactionWithTimeout(transaction, operations)
}

const joinActivitySqlite = async (activityId: number, userId: number) => {
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

      const updateResult = sqliteRun(
        'UPDATE activities SET current_participants = current_participants + 1 WHERE id = ? AND current_participants < max_participants',
        [activityId]
      )

      if (updateResult.changes === 0) {
        throw new Error('ACTIVITY_FULL')
      }

      return true
    })
  } catch (error: any) {
    if (error?.message === 'ALREADY_JOINED' || error?.message === 'ACTIVITY_FULL') {
      throw error
    }
    throw new Error('JOIN_ACTIVITY_FAILED')
  }
}

export const joinActivity = async (activityId: number, userId: number) => {
  if (isSqliteClient) {
    return joinActivitySqlite(activityId, userId)
  }
  return joinActivitySqlServer(activityId, userId)
}

const cancelJoinActivitySqlServer = async (activityId: number, userId: number) => {
  const transaction = new sql.Transaction(pool)

  const operations = async () => {
    const deleteResult = await transaction
      .request()
      .input('activityId', sql.Int, activityId)
      .input('userId', sql.Int, userId).query(`
        DELETE FROM activity_participants
        WHERE activity_id = @activityId AND user_id = @userId
      `)

    if (deleteResult.rowsAffected[0] === 0) {
      throw new Error('NOT_JOINED')
    }

    await transaction.request().input('activityId', sql.Int, activityId).query(`
        UPDATE activities
        SET current_participants = CASE
          WHEN current_participants > 0 THEN current_participants - 1
          ELSE 0
        END
        WHERE id = @activityId
      `)

    return true
  }

  return executeTransactionWithTimeout(transaction, operations)
}

const cancelJoinActivitySqlite = async (activityId: number, userId: number) => {
  return sqliteTransaction(() => {
    const deleteResult = sqliteRun(
      'DELETE FROM activity_participants WHERE activity_id = ? AND user_id = ?',
      [activityId, userId]
    )

    if (deleteResult.changes === 0) {
      throw new Error('NOT_JOINED')
    }

    sqliteRun(
      'UPDATE activities SET current_participants = CASE WHEN current_participants > 0 THEN current_participants - 1 ELSE 0 END WHERE id = ?',
      [activityId]
    )

    return true
  })
}

export const cancelJoinActivity = async (activityId: number, userId: number) => {
  if (isSqliteClient) {
    return cancelJoinActivitySqlite(activityId, userId)
  }
  return cancelJoinActivitySqlServer(activityId, userId)
}

const getUserJoinedActivitiesSqlServer = async (userId: number) => {
  const result = await pool.request().input('userId', sql.Int, userId).query(`
      SELECT a.*
      FROM activities a
      JOIN activity_participants ap ON a.id = ap.activity_id
      WHERE ap.user_id = @userId
      ORDER BY a.start_time ASC
    `)
  return result.recordset
}

const getUserJoinedActivitiesSqlite = async (userId: number) => {
  return sqliteAll(
    `
      SELECT a.*
      FROM activities a
      JOIN activity_participants ap ON a.id = ap.activity_id
      WHERE ap.user_id = ?
      ORDER BY datetime(a.start_time) ASC
    `,
    [userId]
  )
}

export const getUserJoinedActivities = async (userId: number) => {
  if (isSqliteClient) {
    return getUserJoinedActivitiesSqlite(userId)
  }
  return getUserJoinedActivitiesSqlServer(userId)
}

const createActivitySqlServer = async (
  title: string,
  description: string,
  startTime: string,
  endTime: string,
  maxParticipants: number,
  location: string,
  imageUrl?: string
) => {
  const result = await pool
    .request()
    .input('title', sql.NVarChar, title)
    .input('description', sql.NVarChar, description)
    .input('startTime', sql.DateTime, startTime)
    .input('endTime', sql.DateTime, endTime)
    .input('maxParticipants', sql.Int, maxParticipants)
    .input('location', sql.NVarChar, location)
    .input('imageUrl', sql.NVarChar, imageUrl || null).query(`
      INSERT INTO activities (title, description, start_time, end_time, max_participants, location, image_url)
      OUTPUT INSERTED.id
      VALUES (@title, @description, @startTime, @endTime, @maxParticipants, @location, @imageUrl)
    `)
  return result.recordset[0].id
}

const createActivitySqlite = async (
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
      INSERT INTO activities (title, description, start_time, end_time, max_participants, location, image_url)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
    [title, description, startTime, endTime, maxParticipants, location, imageUrl || null]
  )

  return Number(result.lastInsertRowid)
}

export const createActivity = async (
  title: string,
  description: string,
  startTime: string,
  endTime: string,
  maxParticipants: number,
  location: string,
  imageUrl?: string
) => {
  if (isSqliteClient) {
    return createActivitySqlite(
      title,
      description,
      startTime,
      endTime,
      maxParticipants,
      location,
      imageUrl
    )
  }
  return createActivitySqlServer(
    title,
    description,
    startTime,
    endTime,
    maxParticipants,
    location,
    imageUrl
  )
}

const updateActivitySqlServer = async (
  id: number,
  title: string,
  description: string,
  startTime: string,
  endTime: string,
  maxParticipants: number,
  location: string,
  imageUrl?: string
) => {
  const result = await pool
    .request()
    .input('id', sql.Int, id)
    .input('title', sql.NVarChar, title)
    .input('description', sql.NVarChar, description)
    .input('startTime', sql.DateTime, startTime)
    .input('endTime', sql.DateTime, endTime)
    .input('maxParticipants', sql.Int, maxParticipants)
    .input('location', sql.NVarChar, location)
    .input('imageUrl', sql.NVarChar, imageUrl || null).query(`
      UPDATE activities
      SET title = @title,
          description = @description,
          start_time = @startTime,
          end_time = @endTime,
          max_participants = @maxParticipants,
          location = @location,
          image_url = @imageUrl,
          updated_at = GETDATE()
      WHERE id = @id
    `)
  return result
}

const updateActivitySqlite = async (
  id: number,
  title: string,
  description: string,
  startTime: string,
  endTime: string,
  maxParticipants: number,
  location: string,
  imageUrl?: string
) => {
  return sqliteRun(
    `
      UPDATE activities
      SET title = ?,
          description = ?,
          start_time = ?,
          end_time = ?,
          max_participants = ?,
          location = ?,
          image_url = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `,
    [title, description, startTime, endTime, maxParticipants, location, imageUrl || null, id]
  )
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
) => {
  if (isSqliteClient) {
    return updateActivitySqlite(
      id,
      title,
      description,
      startTime,
      endTime,
      maxParticipants,
      location,
      imageUrl
    )
  }
  return updateActivitySqlServer(
    id,
    title,
    description,
    startTime,
    endTime,
    maxParticipants,
    location,
    imageUrl
  )
}

const deleteActivitySqlServer = async (id: number) => {
  const transaction = new sql.Transaction(pool)
  try {
    await transaction.begin()

    await transaction
      .request()
      .input('id', sql.Int, id)
      .query('DELETE FROM activity_participants WHERE activity_id = @id')

    const result = await transaction
      .request()
      .input('id', sql.Int, id)
      .query('DELETE FROM activities WHERE id = @id')

    await transaction.commit()
    return result
  } catch (error) {
    await transaction.rollback()
    throw error
  }
}

const deleteActivitySqlite = async (id: number) => {
  return sqliteTransaction(() => {
    sqliteRun('DELETE FROM activity_participants WHERE activity_id = ?', [id])
    return sqliteRun('DELETE FROM activities WHERE id = ?', [id])
  })
}

export const deleteActivity = async (id: number) => {
  if (isSqliteClient) {
    return deleteActivitySqlite(id)
  }
  return deleteActivitySqlServer(id)
}

const getActivityParticipantsSqlServer = async (activityId: number) => {
  const result = await pool.request().input('activityId', sql.Int, activityId).query(`
    SELECT
      u.id,
      u.username,
      u.nickname,
      u.avatar,
      ap.joined_at
    FROM activity_participants ap
    JOIN users u ON ap.user_id = u.id
    WHERE ap.activity_id = @activityId
    ORDER BY ap.joined_at ASC
  `)
  return result.recordset
}

const getActivityParticipantsSqlite = async (activityId: number) => {
  return sqliteAll(
    `
      SELECT
        u.id,
        u.username,
        u.nickname,
        u.avatar,
        ap.joined_at
      FROM activity_participants ap
      JOIN users u ON ap.user_id = u.id
      WHERE ap.activity_id = ?
      ORDER BY datetime(ap.joined_at) ASC
    `,
    [activityId]
  )
}

export const getActivityParticipants = async (activityId: number) => {
  if (isSqliteClient) {
    return getActivityParticipantsSqlite(activityId)
  }
  return getActivityParticipantsSqlServer(activityId)
}
