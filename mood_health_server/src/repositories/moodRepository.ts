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

  return {
    createMood,
    listByUser,
    countByUser,
  }
}

export type MoodRepository = ReturnType<typeof createMoodRepository>
