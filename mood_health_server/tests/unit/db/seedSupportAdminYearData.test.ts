import {
  buildSupportAdminMoodDays,
  seedSupportAdminYearData,
} from '../../../src/db/seeds/seedSupportAdminYearData'

class FakeSeedDatabase {
  public readonly queries: Array<{ sql: string; params: unknown[] }> = []
  private nextMoodId = 1000

  async query<T = unknown>(sql: string, params: unknown[] = []): Promise<T[]> {
    this.queries.push({ sql, params })
    if (sql.includes('FROM roles') && sql.includes('super_admin')) {
      return [{ id: 3 }] as T[]
    }
    if (sql.includes('FROM users') && sql.includes('username = ?')) {
      return [{ id: 88 }] as T[]
    }
    if (sql.includes('FROM emotion_types')) {
      return [
        { id: 1, code: 'calm' },
        { id: 2, code: 'happy' },
        { id: 3, code: 'anxious' },
        { id: 4, code: 'tired' },
      ] as T[]
    }
    if (sql.includes('SELECT id FROM moods')) return [] as T[]
    if (sql.includes('SELECT LAST_INSERT_ID')) {
      return [{ id: this.nextMoodId++ }] as T[]
    }
    return [] as T[]
  }
}

const env = {
  ALLOW_DEMO_SEED: 'true',
  DEMO_PASSWORD: 'DemoPass123!',
  ENCRYPTION_KEY: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
}

describe('support admin year seed', () => {
  it('builds exactly 365 deterministic days including a seven-day low-score period', () => {
    const days = buildSupportAdminMoodDays(new Date('2026-08-13T12:00:00.000Z'))

    expect(days).toHaveLength(365)
    expect(new Set(days.map((day) => day.recordedAt.toISOString().slice(0, 10))).size).toBe(365)
    expect(days.slice(42, 49).every((day) => day.intensity < 5)).toBe(true)
  })

  it('writes only real source records for demo_support_admin and never inserts analysis text', async () => {
    const db = new FakeSeedDatabase()

    const result = await seedSupportAdminYearData(
      db,
      env,
      new Date('2026-08-13T12:00:00.000Z')
    )

    expect(result).toEqual({ userId: 88, daysCovered: 365, moodCount: 365 })
    const params = JSON.stringify(db.queries.map((query) => query.params))
    const sql = db.queries.map((query) => query.sql).join('\n')
    expect(params).toContain('demo_support_admin')
    expect(sql).toContain('INSERT INTO moods')
    expect(sql).toContain('DELETE FROM moods WHERE user_id = ?')
    expect(sql).toContain('INSERT IGNORE INTO mood_emotions')
    expect(sql).not.toMatch(/INSERT\s+INTO\s+mood_analysis_versions/i)
  })
})
