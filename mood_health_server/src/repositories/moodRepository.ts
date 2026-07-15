import { ResultSetHeader } from 'mysql2'
import { PoolConnection } from 'mysql2/promise'
import { getMysqlPool } from '../config/mysql'

export interface MoodConnection {
  beginTransaction(): Promise<void>
  commit(): Promise<void>
  rollback(): Promise<void>
  release(): void
  query<T>(sql: string, params?: unknown[]): Promise<[T, unknown]>
}

export interface MoodDatabase {
  getConnection(): Promise<MoodConnection>
  query<T>(sql: string, params?: unknown[]): Promise<[T, unknown]>
}

export interface MoodEmotionInput {
  emotionTypeId: number
  intensity: number
  isPrimary: boolean
}

export interface CreateMoodInput {
  userId: number
  noteCiphertext: string | null
  triggerCiphertext: string | null
  recordedAt: Date
  emotions: MoodEmotionInput[]
  tagIds: number[]
}

export interface UpdateMoodInput extends CreateMoodInput {
  id: number
}

export interface MoodPageOptions {
  page: number
  limit: number
}

export interface MoodRecord {
  id: number
  userId: number
  noteCiphertext: string | null
  triggerCiphertext: string | null
  recordedAt: Date
  createdAt: Date
  updatedAt: Date
  emotions: Array<{
    emotionTypeId: number
    code: string
    name: string
    icon: string | null
    intensity: number
    isPrimary: boolean
  }>
  tags: Array<{
    id: number
    code: string | null
    name: string
    isSystem: boolean
  }>
}

export interface EmotionTypeRecord {
  id: number
  code: string
  name: string
  icon: string | null
  category: string | null
  sortOrder: number
}

export interface TagRecord {
  id: number
  code: string | null
  userId: number | null
  name: string
  isSystem: boolean
}

export interface MoodTrendRow {
  date: string
  emotionName: string
  averageIntensity: number
}

export interface MoodWeeklyRow extends MoodTrendRow {
  recordCount: number
}

export interface MoodAnalysisRow {
  moodId: number
  date: string
  triggerCiphertext: string | null
  emotionName: string
  emotionCategory: 'positive' | 'negative' | 'neutral'
  intensity: number
}

type MoodRow = {
  id: number
  user_id: number
  note_ciphertext: string | null
  trigger_ciphertext: string | null
  recorded_at: Date
  created_at: Date
  updated_at: Date
}

type MoodEmotionRow = {
  mood_id: number
  emotion_type_id: number
  intensity: number
  is_primary: number
  emotion_code: string
  emotion_name: string
  emotion_icon: string | null
}

type MoodTagRow = {
  mood_id: number
  tag_id: number
  tag_code: string | null
  tag_name: string
  is_system: number
}

type CountRow = {
  total: number
}

type EmotionTypeRow = {
  id: number
  code: string
  name: string
  icon: string | null
  category: string | null
  sort_order: number
}

type TagRow = {
  id: number
  code: string | null
  owner_user_id: number | null
  name: string
  is_system: number
}

type IdRow = {
  id: number
}

type MoodTrendSqlRow = {
  date: string
  emotion_name: string
  avg_intensity: number | string
}

type MoodWeeklySqlRow = MoodTrendSqlRow & {
  record_count: number | string
}

type MoodAnalysisSqlRow = {
  mood_id: number
  date: string
  trigger_ciphertext: string | null
  emotion_name: string
  emotion_category: string | null
  intensity: number | string
}

const asMoodDatabase = (): MoodDatabase => ({
  getConnection: async () => (await getMysqlPool().getConnection()) as PoolConnection,
  query: async <T>(sql: string, params: unknown[] = []) => {
    const [rows, fields] = await getMysqlPool().query(sql, params)
    return [rows as T, fields]
  },
})

export const createMoodRepository = (db: MoodDatabase = asMoodDatabase()) => {
  const createMood = async (input: CreateMoodInput): Promise<number> => {
    const connection = await db.getConnection()

    try {
      await connection.beginTransaction()

      const [result] = await connection.query<ResultSetHeader>(
        `
        INSERT INTO moods (
          user_id,
          note_ciphertext,
          trigger_ciphertext,
          recorded_at,
          created_at,
          updated_at
        )
        VALUES (?, ?, ?, ?, UTC_TIMESTAMP(3), UTC_TIMESTAMP(3))
        `,
        [input.userId, input.noteCiphertext, input.triggerCiphertext, input.recordedAt]
      )
      const moodId = Number(result.insertId)

      for (const emotion of input.emotions) {
        await connection.query<ResultSetHeader>(
          `
          INSERT INTO mood_emotions (
            mood_id,
            emotion_type_id,
            intensity,
            is_primary
          )
          VALUES (?, ?, ?, ?)
          `,
          [moodId, emotion.emotionTypeId, emotion.intensity, emotion.isPrimary ? 1 : 0]
        )
      }

      for (const tagId of input.tagIds) {
        await connection.query<ResultSetHeader>(
          `
          INSERT INTO mood_tags (
            mood_id,
            tag_id
          )
          VALUES (?, ?)
          `,
          [moodId, tagId]
        )
      }

      await connection.commit()
      return moodId
    } catch (error) {
      await connection.rollback()
      throw error
    } finally {
      connection.release()
    }
  }

  const hydrateMoodRows = async (moodRows: MoodRow[]): Promise<MoodRecord[]> => {
    if (moodRows.length === 0) {
      return []
    }

    const moodIds = moodRows.map((row) => row.id)
    const placeholders = moodIds.map(() => '?').join(',')
    const [emotionRows] = await db.query<MoodEmotionRow[]>(
      `
      SELECT
        me.mood_id,
        me.emotion_type_id,
        me.intensity,
        me.is_primary,
        et.code AS emotion_code,
        et.name AS emotion_name,
        et.icon AS emotion_icon
      FROM mood_emotions me
      JOIN emotion_types et ON et.id = me.emotion_type_id
      WHERE me.mood_id IN (${placeholders})
      ORDER BY me.is_primary DESC, me.emotion_type_id ASC
      `,
      moodIds
    )
    const [tagRows] = await db.query<MoodTagRow[]>(
      `
      SELECT
        mt.mood_id,
        t.id AS tag_id,
        t.code AS tag_code,
        t.name AS tag_name,
        t.is_system
      FROM mood_tags mt
      JOIN tags t ON t.id = mt.tag_id
      WHERE mt.mood_id IN (${placeholders})
      ORDER BY t.is_system DESC, t.name ASC
      `,
      moodIds
    )

    const emotionsByMood = new Map<number, MoodRecord['emotions']>()
    for (const row of emotionRows) {
      const items = emotionsByMood.get(row.mood_id) ?? []
      items.push({
        emotionTypeId: Number(row.emotion_type_id),
        code: row.emotion_code,
        name: row.emotion_name,
        icon: row.emotion_icon,
        intensity: Number(row.intensity),
        isPrimary: Number(row.is_primary) === 1,
      })
      emotionsByMood.set(row.mood_id, items)
    }

    const tagsByMood = new Map<number, MoodRecord['tags']>()
    for (const row of tagRows) {
      const items = tagsByMood.get(row.mood_id) ?? []
      items.push({
        id: Number(row.tag_id),
        code: row.tag_code,
        name: row.tag_name,
        isSystem: Number(row.is_system) === 1,
      })
      tagsByMood.set(row.mood_id, items)
    }

    return moodRows.map((row) => ({
      id: Number(row.id),
      userId: Number(row.user_id),
      noteCiphertext: row.note_ciphertext,
      triggerCiphertext: row.trigger_ciphertext,
      recordedAt: row.recorded_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      emotions: emotionsByMood.get(row.id) ?? [],
      tags: tagsByMood.get(row.id) ?? [],
    }))
  }

  const listByUser = async (
    userId: number,
    options: MoodPageOptions
  ): Promise<MoodRecord[]> => {
    const limit = options.limit
    const offset = (options.page - 1) * options.limit
    const [moodRows] = await db.query<MoodRow[]>(
      `
      SELECT
        m.id,
        m.user_id,
        m.note_ciphertext,
        m.trigger_ciphertext,
        m.recorded_at,
        m.created_at,
        m.updated_at
      FROM moods m
      WHERE m.user_id = ?
      ORDER BY m.recorded_at DESC, m.created_at DESC
      LIMIT ? OFFSET ?
      `,
      [userId, limit, offset]
    )

    return hydrateMoodRows(moodRows)
  }

  const listByUserAndEmotionType = async (
    userId: number,
    emotionTypeId: number,
    options: MoodPageOptions
  ): Promise<MoodRecord[]> => {
    const limit = options.limit
    const offset = (options.page - 1) * options.limit
    const [moodRows] = await db.query<MoodRow[]>(
      `
      SELECT
        m.id,
        m.user_id,
        m.note_ciphertext,
        m.trigger_ciphertext,
        m.recorded_at,
        m.created_at,
        m.updated_at
      FROM moods m
      JOIN mood_emotions filter_me ON filter_me.mood_id = m.id
      WHERE m.user_id = ? AND filter_me.emotion_type_id = ?
      ORDER BY m.recorded_at DESC, m.created_at DESC
      LIMIT ? OFFSET ?
      `,
      [userId, emotionTypeId, limit, offset]
    )

    return hydrateMoodRows(moodRows)
  }

  const countByUser = async (userId: number): Promise<number> => {
    const [rows] = await db.query<CountRow[]>(
      `
      SELECT COUNT(*) AS total
      FROM moods
      WHERE user_id = ?
      `,
      [userId]
    )

    return Number(rows[0]?.total ?? 0)
  }

  const countByUserAndEmotionType = async (
    userId: number,
    emotionTypeId: number
  ): Promise<number> => {
    const [rows] = await db.query<CountRow[]>(
      `
      SELECT COUNT(DISTINCT m.id) AS total
      FROM moods m
      JOIN mood_emotions filter_me ON filter_me.mood_id = m.id
      WHERE m.user_id = ? AND filter_me.emotion_type_id = ?
      `,
      [userId, emotionTypeId]
    )

    return Number(rows[0]?.total ?? 0)
  }

  const updateMood = async (input: UpdateMoodInput): Promise<boolean> => {
    const connection = await db.getConnection()

    try {
      await connection.beginTransaction()

      const [result] = await connection.query<ResultSetHeader>(
        `
        UPDATE moods
        SET
          note_ciphertext = ?,
          trigger_ciphertext = ?,
          recorded_at = ?,
          updated_at = UTC_TIMESTAMP(3)
        WHERE id = ? AND user_id = ?
        `,
        [
          input.noteCiphertext,
          input.triggerCiphertext,
          input.recordedAt,
          input.id,
          input.userId,
        ]
      )

      if (Number(result.affectedRows) === 0) {
        await connection.rollback()
        return false
      }

      await connection.query<ResultSetHeader>(
        `
        DELETE FROM mood_emotions
        WHERE mood_id = ?
        `,
        [input.id]
      )

      for (const emotion of input.emotions) {
        await connection.query<ResultSetHeader>(
          `
          INSERT INTO mood_emotions (
            mood_id,
            emotion_type_id,
            intensity,
            is_primary
          )
          VALUES (?, ?, ?, ?)
          `,
          [input.id, emotion.emotionTypeId, emotion.intensity, emotion.isPrimary ? 1 : 0]
        )
      }

      await connection.query<ResultSetHeader>(
        `
        DELETE FROM mood_tags
        WHERE mood_id = ?
        `,
        [input.id]
      )

      for (const tagId of input.tagIds) {
        await connection.query<ResultSetHeader>(
          `
          INSERT INTO mood_tags (
            mood_id,
            tag_id
          )
          VALUES (?, ?)
          `,
          [input.id, tagId]
        )
      }

      await connection.commit()
      return true
    } catch (error) {
      await connection.rollback()
      throw error
    } finally {
      connection.release()
    }
  }

  const deleteMood = async (userId: number, moodId: number): Promise<boolean> => {
    const [result] = await db.query<ResultSetHeader>(
      `
      DELETE FROM moods
      WHERE id = ? AND user_id = ?
      `,
      [moodId, userId]
    )

    return Number(result.affectedRows) > 0
  }

  const listEmotionTypes = async (): Promise<EmotionTypeRecord[]> => {
    const [rows] = await db.query<EmotionTypeRow[]>(
      `
      SELECT
        id,
        code,
        name,
        icon,
        category,
        sort_order
      FROM emotion_types
      WHERE is_active = 1
      ORDER BY sort_order ASC, id ASC
      `
    )

    return rows.map((row) => ({
      id: Number(row.id),
      code: row.code,
      name: row.name,
      icon: row.icon,
      category: row.category,
      sortOrder: Number(row.sort_order),
    }))
  }

  const listTags = async (userId: number): Promise<TagRecord[]> => {
    const [rows] = await db.query<TagRow[]>(
      `
      SELECT
        id,
        code,
        owner_user_id,
        name,
        is_system
      FROM tags
      WHERE is_system = 1 OR owner_user_id = ?
      ORDER BY is_system DESC, name ASC
      `,
      [userId]
    )

    return rows.map((row) => ({
      id: Number(row.id),
      code: row.code,
      userId: row.owner_user_id === null ? null : Number(row.owner_user_id),
      name: row.name,
      isSystem: Number(row.is_system) === 1,
    }))
  }

  const createOrGetTag = async (name: string, userId: number): Promise<number> => {
    const [existingRows] = await db.query<IdRow[]>(
      `
      SELECT id
      FROM tags
      WHERE name = ? AND (is_system = 1 OR owner_user_id = ?)
      LIMIT 1
      `,
      [name, userId]
    )

    if (existingRows[0]) {
      return Number(existingRows[0].id)
    }

    const [result] = await db.query<ResultSetHeader>(
      `
      INSERT INTO tags (
        code,
        owner_user_id,
        name,
        is_system,
        created_at
      )
      VALUES (?, ?, ?, 0, UTC_TIMESTAMP(3))
      `,
      [null, userId, name]
    )

    return Number(result.insertId)
  }

  const listTrendRows = async (
    userId: number,
    startDate: string,
    endDate: string
  ): Promise<MoodTrendRow[]> => {
    const [rows] = await db.query<MoodTrendSqlRow[]>(
      `
      SELECT
        DATE_FORMAT(m.recorded_at, '%Y-%m-%d') AS date,
        et.name AS emotion_name,
        AVG(me.intensity) AS avg_intensity
      FROM moods m
      JOIN mood_emotions me ON me.mood_id = m.id
      JOIN emotion_types et ON et.id = me.emotion_type_id
      WHERE m.user_id = ?
        AND DATE(m.recorded_at) >= ?
        AND DATE(m.recorded_at) <= ?
      GROUP BY DATE_FORMAT(m.recorded_at, '%Y-%m-%d'), et.name
      ORDER BY date ASC, et.name ASC
      `,
      [userId, startDate, endDate]
    )

    return rows.map((row) => ({
      date: row.date,
      emotionName: row.emotion_name,
      averageIntensity: Number(row.avg_intensity),
    }))
  }

  const listWeeklyRows = async (
    userId: number,
    startDate: string,
    endDate: string
  ): Promise<MoodWeeklyRow[]> => {
    const [rows] = await db.query<MoodWeeklySqlRow[]>(
      `
      SELECT
        DATE_FORMAT(m.recorded_at, '%Y-%m-%d') AS date,
        et.name AS emotion_name,
        COUNT(*) AS record_count,
        AVG(me.intensity) AS avg_intensity
      FROM moods m
      JOIN mood_emotions me ON me.mood_id = m.id
      JOIN emotion_types et ON et.id = me.emotion_type_id
      WHERE m.user_id = ?
        AND DATE(m.recorded_at) >= ?
        AND DATE(m.recorded_at) <= ?
      GROUP BY DATE_FORMAT(m.recorded_at, '%Y-%m-%d'), et.name
      ORDER BY date ASC, et.name ASC
      `,
      [userId, startDate, endDate]
    )

    return rows.map((row) => ({
      date: row.date,
      emotionName: row.emotion_name,
      recordCount: Number(row.record_count),
      averageIntensity: Number(row.avg_intensity),
    }))
  }

  const listAnalysisRows = async (
    userId: number,
    startDate: string,
    endDate: string
  ): Promise<MoodAnalysisRow[]> => {
    const [rows] = await db.query<MoodAnalysisSqlRow[]>(
      `
      SELECT
        m.id AS mood_id,
        DATE_FORMAT(m.recorded_at, '%Y-%m-%d') AS date,
        m.trigger_ciphertext,
        et.name AS emotion_name,
        et.category AS emotion_category,
        me.intensity
      FROM moods m
      JOIN mood_emotions me ON me.mood_id = m.id
      JOIN emotion_types et ON et.id = me.emotion_type_id
      WHERE m.user_id = ?
        AND DATE(m.recorded_at) >= ?
        AND DATE(m.recorded_at) <= ?
      ORDER BY m.recorded_at DESC, m.id DESC, me.is_primary DESC, et.name ASC
      `,
      [userId, startDate, endDate]
    )

    return rows.map((row) => ({
      moodId: Number(row.mood_id),
      date: row.date,
      triggerCiphertext: row.trigger_ciphertext,
      emotionName: row.emotion_name,
      emotionCategory:
        row.emotion_category === 'positive' || row.emotion_category === 'negative'
          ? row.emotion_category
          : 'neutral',
      intensity: Number(row.intensity),
    }))
  }

  return {
    createMood,
    listByUser,
    listByUserAndEmotionType,
    countByUser,
    countByUserAndEmotionType,
    updateMood,
    deleteMood,
    listEmotionTypes,
    listTags,
    createOrGetTag,
    listTrendRows,
    listWeeklyRows,
    listAnalysisRows,
  }
}

export type MoodRepository = ReturnType<typeof createMoodRepository>
