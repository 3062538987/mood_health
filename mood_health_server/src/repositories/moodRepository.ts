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

const asMoodDatabase = (): MoodDatabase => ({
  getConnection: async () => (await getMysqlPool().getConnection()) as PoolConnection,
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

  return {
    createMood,
  }
}

export type MoodRepository = ReturnType<typeof createMoodRepository>
