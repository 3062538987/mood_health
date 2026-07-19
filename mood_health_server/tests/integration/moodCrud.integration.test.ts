import dotenv from 'dotenv'
dotenv.config()

import { createPool, Pool } from 'mysql2/promise'
import fs from 'node:fs'
import path from 'node:path'
import { createMoodRepository, MoodRepository } from '../../src/repositories/moodRepository'
import { runMigrations, MigrationDatabase } from '../../src/db/migrationRunner'

const MYSQL_HOST = process.env.MYSQL_HOST || '127.0.0.1'
const MYSQL_PORT = Number(process.env.MYSQL_PORT) || 3306
const MYSQL_DATABASE = process.env.MYSQL_DATABASE || 'mood_health_e2e'
const MYSQL_APP_USER = process.env.MYSQL_APP_USER || 'mood_app'
const MYSQL_APP_PASSWORD = process.env.MYSQL_APP_PASSWORD || ''

const migrationsDir = path.resolve(__dirname, '../../src/db/migrations')
const bootstrapPath = path.resolve(__dirname, '../../src/db/bootstrap/schema_migrations.sql')

let pool: Pool
let repo: MoodRepository
const TEST_USER_ID = 99999001
const TEST_USER_EMAIL = `it-${Date.now()}@t.local`
const TEST_USERNAME = `ituser_${Date.now().toString().slice(-6)}`
const TEST_USER_PASSWORD = '$2b$10$testhashplaceholder00000000000000000000000000000000000'

class TestMigrationDb implements MigrationDatabase {
  async query<T = unknown>(sql: string, params: unknown[] = []): Promise<T[]> {
    const [rows] = await pool.query(sql, params)
    return Array.isArray(rows) ? (rows as T[]) : []
  }
}

const bootstrapSchema = async (): Promise<void> => {
  const sql = fs.readFileSync(bootstrapPath, 'utf8')
  await pool.query(sql)
}

const setupTestUser = async (): Promise<void> => {
  await pool.query(
    `INSERT INTO users (id, username, email, password_hash, nickname, role_id, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'integration-tester', 1, 'active', UTC_TIMESTAMP(3), UTC_TIMESTAMP(3))
     ON DUPLICATE KEY UPDATE email = VALUES(email)`,
    [TEST_USER_ID, TEST_USERNAME, TEST_USER_EMAIL, TEST_USER_PASSWORD]
  )
}

const cleanupTestData = async (): Promise<void> => {
  await pool.query('DELETE FROM mood_emotions WHERE mood_id IN (SELECT id FROM moods WHERE user_id = ?)', [TEST_USER_ID])
  await pool.query('DELETE FROM mood_tags WHERE mood_id IN (SELECT id FROM moods WHERE user_id = ?)', [TEST_USER_ID])
  await pool.query('DELETE FROM moods WHERE user_id = ?', [TEST_USER_ID])
  await pool.query('DELETE FROM users WHERE id = ?', [TEST_USER_ID])
}

beforeAll(async () => {
  pool = createPool({
    host: MYSQL_HOST,
    port: MYSQL_PORT,
    database: MYSQL_DATABASE,
    user: MYSQL_APP_USER,
    password: MYSQL_APP_PASSWORD,
    charset: 'utf8mb4',
    timezone: 'Z',
    waitForConnections: true,
    connectionLimit: 2,
    maxIdle: 2,
    idleTimeout: 30000,
    queueLimit: 0,
    connectTimeout: 5000,
  })

  await bootstrapSchema()
  const db = new TestMigrationDb()
  await runMigrations({ db, migrationsDir })

  const dbForRepo = {
    getConnection: async () => pool.getConnection() as any,
    query: async <T>(sql: string, params: unknown[] = []): Promise<[T, unknown]> => {
      const [rows, fields] = await pool.query(sql, params)
      return [rows as T, fields]
    },
  }
  repo = createMoodRepository(dbForRepo)

  await setupTestUser()
}, 30000)

afterAll(async () => {
  await cleanupTestData()
  await pool.end()
}, 15000)

beforeEach(async () => {
  await cleanupTestData()
  await setupTestUser()
})

describe('Mood CRUD Integration', () => {
  const NOW = new Date('2026-07-15T10:00:00Z')

  const baseInput = {
    userId: TEST_USER_ID,
    noteCiphertext: 'encrypted_note_test',
    triggerCiphertext: 'encrypted_trigger_test',
    includeNote: true,
    recordedAt: NOW,
    emotions: [
      { emotionTypeId: 1, intensity: 7, isPrimary: true },
      { emotionTypeId: 2, intensity: 4, isPrimary: false },
    ],
    tagIds: [1, 2],
  }

  it('creates a mood with emotions, tags, and includeNote', async () => {
    const result = await repo.createMood(baseInput)

    expect(result.moodId).toBeGreaterThan(0)
    const [rows] = await pool.query(
      'SELECT id, user_id, note_ciphertext, trigger_ciphertext, include_note FROM moods WHERE id = ?',
      [result.moodId]
    ) as any
    expect(rows.length).toBe(1)
    expect(rows[0].include_note).toBe(1)

    const [emotionRows] = await pool.query(
      'SELECT emotion_type_id, intensity, is_primary FROM mood_emotions WHERE mood_id = ? ORDER BY emotion_type_id',
      [result.moodId]
    ) as any
    expect(emotionRows.length).toBe(2)
    expect(emotionRows[0].emotion_type_id).toBe(1)
    expect(emotionRows[0].is_primary).toBe(1)

    const [tagRows] = await pool.query(
      'SELECT tag_id FROM mood_tags WHERE mood_id = ? ORDER BY tag_id',
      [result.moodId]
    ) as any
    expect(tagRows.length).toBe(2)
  })

  it('lists moods by user', async () => {
    await repo.createMood(baseInput)
    await repo.createMood({ ...baseInput, recordedAt: new Date('2026-07-16T10:00:00Z') })

    const moods = await repo.listByUser(TEST_USER_ID, { page: 1, limit: 10 })
    expect(moods.length).toBe(2)
    expect(moods[0].recordedAt.getTime()).toBeGreaterThanOrEqual(moods[1].recordedAt.getTime())
    expect(moods[0].emotions.length).toBeGreaterThan(0)
    expect(moods[0].tags.length).toBeGreaterThan(0)
  })

  it('updates a mood with new emotions and tags', async () => {
    const { moodId } = await repo.createMood(baseInput)

    const updated = await repo.updateMood({
      ...baseInput,
      id: moodId,
      noteCiphertext: 'updated_note',
      emotions: [{ emotionTypeId: 3, intensity: 8, isPrimary: true }],
      tagIds: [3],
    })
    expect(updated).toBe(true)

    const [emotionRows] = await pool.query(
      'SELECT emotion_type_id FROM mood_emotions WHERE mood_id = ?',
      [moodId]
    ) as any
    expect(emotionRows.length).toBe(1)
    expect(emotionRows[0].emotion_type_id).toBe(3)

    const [tagRows] = await pool.query(
      'SELECT tag_id FROM mood_tags WHERE mood_id = ?',
      [moodId]
    ) as any
    expect(tagRows.length).toBe(1)
    expect(tagRows[0].tag_id).toBe(3)
  })

  it('deletes a mood', async () => {
    const { moodId } = await repo.createMood(baseInput)

    const deleted = await repo.deleteMood(TEST_USER_ID, moodId)
    expect(deleted).toBe(true)

    const [rows] = await pool.query('SELECT id FROM moods WHERE id = ?', [moodId]) as any
    expect(rows.length).toBe(0)
  })

  it('rejects delete for wrong user', async () => {
    const { moodId } = await repo.createMood(baseInput)

    const deleted = await repo.deleteMood(99999999, moodId)
    expect(deleted).toBe(false)

    const [rows] = await pool.query('SELECT id FROM moods WHERE id = ?', [moodId]) as any
    expect(rows.length).toBe(1)
  })

  it('creates mood with includeNote false', async () => {
    const result = await repo.createMood({ ...baseInput, includeNote: false })

    const [rows] = await pool.query(
      'SELECT include_note FROM moods WHERE id = ?',
      [result.moodId]
    ) as any
    expect(rows[0].include_note).toBe(0)
  })

  it('counts moods by user', async () => {
    await repo.createMood(baseInput)
    await repo.createMood({ ...baseInput, recordedAt: new Date('2026-07-16T10:00:00Z') })

    const count = await repo.countByUser(TEST_USER_ID)
    expect(count).toBe(2)
  })

  it('returns empty list for user with no moods', async () => {
    const moods = await repo.listByUser(99999998, { page: 1, limit: 10 })
    expect(moods.length).toBe(0)
  })

  it('rolls back on partial failure during create', async () => {
    const badInput = {
      ...baseInput,
      emotions: [{ emotionTypeId: 99999, intensity: 5, isPrimary: true }],
    }

    await expect(repo.createMood(badInput)).rejects.toThrow()

    const count = await repo.countByUser(TEST_USER_ID)
    expect(count).toBe(0)
  })
})