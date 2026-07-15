import { createMoodRepository } from '../../../src/repositories/moodRepository'

type QueryCall = {
  sql: string
  params: unknown[]
}

class FakeMoodConnection {
  public readonly calls: QueryCall[] = []
  public began = false
  public committed = false
  public rolledBack = false
  public released = false
  private readonly responses: unknown[] = []

  queueResult(result: unknown): void {
    this.responses.push(result)
  }

  async beginTransaction(): Promise<void> {
    this.began = true
  }

  async commit(): Promise<void> {
    this.committed = true
  }

  async rollback(): Promise<void> {
    this.rolledBack = true
  }

  release(): void {
    this.released = true
  }

  async query<T>(sql: string, params: unknown[] = []): Promise<[T, unknown]> {
    this.calls.push({ sql, params })
    return [(this.responses.shift() ?? []) as T, []]
  }
}

class FakeMoodPool {
  public readonly connection = new FakeMoodConnection()

  async getConnection(): Promise<FakeMoodConnection> {
    return this.connection
  }
}

describe('moodRepository', () => {
  it('creates a mood with emotions and tags in one transaction using ciphertext fields', async () => {
    const db = new FakeMoodPool()
    db.connection.queueResult({ insertId: 15, affectedRows: 1 })
    const repository = createMoodRepository(db)

    const moodId = await repository.createMood({
      userId: 7,
      noteCiphertext: 'encrypted-note',
      triggerCiphertext: 'encrypted-trigger',
      recordedAt: new Date('2026-07-15T10:00:00.000Z'),
      emotions: [
        { emotionTypeId: 1, intensity: 8, isPrimary: true },
        { emotionTypeId: 2, intensity: 4, isPrimary: false },
      ],
      tagIds: [3, 4],
    })

    expect(moodId).toBe(15)
    expect(db.connection.began).toBe(true)
    expect(db.connection.committed).toBe(true)
    expect(db.connection.rolledBack).toBe(false)
    expect(db.connection.released).toBe(true)
    expect(db.connection.calls[0].sql).toContain('INSERT INTO moods')
    expect(db.connection.calls[0].sql).toContain('note_ciphertext')
    expect(db.connection.calls[0].sql).toContain('trigger_ciphertext')
    expect(db.connection.calls[0].params).toEqual([
      7,
      'encrypted-note',
      'encrypted-trigger',
      new Date('2026-07-15T10:00:00.000Z'),
    ])
    expect(db.connection.calls[1].sql).toContain('INSERT INTO mood_emotions')
    expect(db.connection.calls[1].params).toEqual([15, 1, 8, 1])
    expect(db.connection.calls[2].params).toEqual([15, 2, 4, 0])
    expect(db.connection.calls[3].sql).toContain('INSERT INTO mood_tags')
    expect(db.connection.calls[3].params).toEqual([15, 3])
    expect(db.connection.calls[4].params).toEqual([15, 4])
  })

  it('rolls back and releases the connection when any association insert fails', async () => {
    const db = new FakeMoodPool()
    db.connection.queueResult({ insertId: 15, affectedRows: 1 })
    const originalQuery = db.connection.query.bind(db.connection)
    db.connection.query = jest
      .fn(originalQuery)
      .mockImplementationOnce(originalQuery)
      .mockRejectedValueOnce(new Error('foreign key failed')) as never
    const repository = createMoodRepository(db)

    await expect(
      repository.createMood({
        userId: 7,
        noteCiphertext: null,
        triggerCiphertext: null,
        recordedAt: new Date('2026-07-15T10:00:00.000Z'),
        emotions: [{ emotionTypeId: 999, intensity: 8, isPrimary: true }],
        tagIds: [],
      })
    ).rejects.toThrow('foreign key failed')

    expect(db.connection.committed).toBe(false)
    expect(db.connection.rolledBack).toBe(true)
    expect(db.connection.released).toBe(true)
  })
})
