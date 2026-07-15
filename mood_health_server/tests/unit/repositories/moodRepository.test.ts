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
  public readonly calls: QueryCall[] = []
  private readonly responses: unknown[] = []

  async getConnection(): Promise<FakeMoodConnection> {
    return this.connection
  }

  queueRows(rows: unknown[]): void {
    this.responses.push(rows)
  }

  async query<T>(sql: string, params: unknown[] = []): Promise<[T, unknown]> {
    this.calls.push({ sql, params })
    return [(this.responses.shift() ?? []) as T, []]
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

  it('lists a user mood page with normalized emotions and tags without selecting legacy columns', async () => {
    const db = new FakeMoodPool()
    db.queueRows([
      {
        id: 15,
        user_id: 7,
        note_ciphertext: 'encrypted-note',
        trigger_ciphertext: 'encrypted-trigger',
        recorded_at: new Date('2026-07-15T10:00:00.000Z'),
        created_at: new Date('2026-07-15T10:01:00.000Z'),
        updated_at: new Date('2026-07-15T10:02:00.000Z'),
      },
    ])
    db.queueRows([
      {
        mood_id: 15,
        emotion_type_id: 1,
        intensity: 8,
        is_primary: 1,
        emotion_code: 'anxious',
        emotion_name: '焦虑',
        emotion_icon: 'activity',
      },
    ])
    db.queueRows([
      {
        mood_id: 15,
        tag_id: 3,
        tag_code: 'study',
        tag_name: '学习',
        is_system: 1,
      },
    ])
    const repository = createMoodRepository(db)

    const result = await repository.listByUser(7, { page: 2, limit: 10 })

    expect(result).toEqual([
      {
        id: 15,
        userId: 7,
        noteCiphertext: 'encrypted-note',
        triggerCiphertext: 'encrypted-trigger',
        recordedAt: new Date('2026-07-15T10:00:00.000Z'),
        createdAt: new Date('2026-07-15T10:01:00.000Z'),
        updatedAt: new Date('2026-07-15T10:02:00.000Z'),
        emotions: [
          {
            emotionTypeId: 1,
            code: 'anxious',
            name: '焦虑',
            icon: 'activity',
            intensity: 8,
            isPrimary: true,
          },
        ],
        tags: [{ id: 3, code: 'study', name: '学习', isSystem: true }],
      },
    ])
    expect(db.calls[0].sql).toContain('FROM moods m')
    expect(db.calls[0].sql).toContain('ORDER BY m.recorded_at DESC')
    expect(db.calls[0].sql).not.toContain('mood_type')
    expect(db.calls[0].sql).not.toContain('note_encrypted')
    expect(db.calls[0].params).toEqual([7, 10, 10])
  })

  it('counts moods for a user', async () => {
    const db = new FakeMoodPool()
    db.queueRows([{ total: 3 }])
    const repository = createMoodRepository(db)

    await expect(repository.countByUser(7)).resolves.toBe(3)

    expect(db.calls[0].sql).toContain('COUNT(*) AS total')
    expect(db.calls[0].params).toEqual([7])
  })

  it('updates a user mood and replaces emotions and tags in one transaction', async () => {
    const db = new FakeMoodPool()
    db.connection.queueResult({ affectedRows: 1 })
    const repository = createMoodRepository(db)

    const updated = await repository.updateMood({
      id: 15,
      userId: 7,
      noteCiphertext: 'new-note',
      triggerCiphertext: null,
      recordedAt: new Date('2026-07-15T11:00:00.000Z'),
      emotions: [{ emotionTypeId: 2, intensity: 6, isPrimary: true }],
      tagIds: [4],
    })

    expect(updated).toBe(true)
    expect(db.connection.began).toBe(true)
    expect(db.connection.committed).toBe(true)
    expect(db.connection.rolledBack).toBe(false)
    expect(db.connection.released).toBe(true)
    expect(db.connection.calls[0].sql).toContain('UPDATE moods')
    expect(db.connection.calls[0].sql).toContain('WHERE id = ? AND user_id = ?')
    expect(db.connection.calls[0].params).toEqual([
      'new-note',
      null,
      new Date('2026-07-15T11:00:00.000Z'),
      15,
      7,
    ])
    expect(db.connection.calls[1].sql).toContain('DELETE FROM mood_emotions')
    expect(db.connection.calls[1].params).toEqual([15])
    expect(db.connection.calls[2].sql).toContain('INSERT INTO mood_emotions')
    expect(db.connection.calls[2].params).toEqual([15, 2, 6, 1])
    expect(db.connection.calls[3].sql).toContain('DELETE FROM mood_tags')
    expect(db.connection.calls[3].params).toEqual([15])
    expect(db.connection.calls[4].sql).toContain('INSERT INTO mood_tags')
    expect(db.connection.calls[4].params).toEqual([15, 4])
  })

  it('rolls back and returns false when updating a mood outside the user boundary', async () => {
    const db = new FakeMoodPool()
    db.connection.queueResult({ affectedRows: 0 })
    const repository = createMoodRepository(db)

    const updated = await repository.updateMood({
      id: 15,
      userId: 7,
      noteCiphertext: null,
      triggerCiphertext: null,
      recordedAt: new Date('2026-07-15T11:00:00.000Z'),
      emotions: [{ emotionTypeId: 2, intensity: 6, isPrimary: true }],
      tagIds: [],
    })

    expect(updated).toBe(false)
    expect(db.connection.committed).toBe(false)
    expect(db.connection.rolledBack).toBe(true)
    expect(db.connection.calls).toHaveLength(1)
  })

  it('deletes a mood inside the user boundary', async () => {
    const db = new FakeMoodPool()
    db.queueRows({ affectedRows: 1 } as never)
    const repository = createMoodRepository(db)

    await expect(repository.deleteMood(7, 15)).resolves.toBe(true)

    expect(db.calls[0].sql).toContain('DELETE FROM moods')
    expect(db.calls[0].sql).toContain('WHERE id = ? AND user_id = ?')
    expect(db.calls[0].params).toEqual([15, 7])
  })
})
