import { seedDemoData, seedTestData } from '../../../src/db/seeds/profileSeed'

class FakeSeedDatabase {
  public readonly queries: Array<{ sql: string; params: unknown[] }> = []

  async query<T = unknown>(sql: string, params: unknown[] = []): Promise<T[]> {
    this.queries.push({ sql, params })

    if (sql.includes('SELECT id, code FROM roles')) {
      return [
        { id: 1, code: 'student' },
        { id: 2, code: 'counselor' },
        { id: 3, code: 'super_admin' },
      ] as T[]
    }

    if (sql.includes('SELECT id, username FROM users')) {
      return [
        { id: 10, username: 'demo_student' },
        { id: 11, username: 'demo_counselor' },
        { id: 12, username: 'demo_super_admin' },
      ] as T[]
    }

    if (sql.includes('SELECT id, code FROM emotion_types')) {
      return [
        { id: 1, code: 'calm' },
        { id: 2, code: 'happy' },
        { id: 3, code: 'anxious' },
      ] as T[]
    }

    return [] as T[]
  }
}

describe('profile seed', () => {
  it('blocks demo seed unless explicit demo authorization is provided', async () => {
    await expect(
      seedDemoData(new FakeSeedDatabase(), {
        ALLOW_DEMO_SEED: 'false',
        DEMO_PASSWORD: 'DemoPass123!',
      })
    ).rejects.toThrow('ALLOW_DEMO_SEED=true is required')
  })

  it('requires demo password from environment and never embeds a default password', async () => {
    await expect(seedDemoData(new FakeSeedDatabase(), { ALLOW_DEMO_SEED: 'true' })).rejects.toThrow(
      'DEMO_PASSWORD is required'
    )
  })

  it('creates fixed fictional demo accounts and mood trend data', async () => {
    const db = new FakeSeedDatabase()

    const result = await seedDemoData(db, {
      ALLOW_DEMO_SEED: 'true',
      DEMO_PASSWORD: 'DemoPass123!',
    })

    expect(result.accounts).toEqual(['demo_student', 'demo_counselor', 'demo_super_admin'])
    expect(result.moods).toBeGreaterThan(0)
    const serializedParams = JSON.stringify(db.queries.map((query) => query.params))
    expect(serializedParams).not.toContain('DemoPass123!')
  })

  it('creates only an invisible technical assessment fixture for test profile', async () => {
    const db = new FakeSeedDatabase()

    const result = await seedTestData(db)

    expect(result.assessmentCode).toBe('TECHNICAL_FIXTURE')
    const sqlText = db.queries.map((query) => query.sql).join('\n')
    expect(sqlText).toContain('assessment_instruments')
    expect(sqlText).toContain('draft')
    expect(sqlText).not.toContain('SDS')
    expect(sqlText).not.toContain('SAS')
  })
})
