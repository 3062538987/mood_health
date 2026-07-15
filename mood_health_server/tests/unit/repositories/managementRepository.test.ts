import { createManagementRepository } from '../../../src/repositories/managementRepository'

type QueryCall = {
  sql: string
  params: unknown[]
}

class FakeManagementDb {
  public readonly calls: QueryCall[] = []
  private readonly responses: unknown[] = []

  queueRows(rows: unknown[]): void {
    this.responses.push(rows)
  }

  async query<T>(sql: string, params: unknown[] = []): Promise<[T, unknown]> {
    this.calls.push({ sql, params })
    return [(this.responses.shift() ?? []) as T, []]
  }
}

describe('managementRepository', () => {
  it('lists users from MySQL role tables with legacy admin DTO role names', async () => {
    const db = new FakeManagementDb()
    db.queueRows([
      {
        id: 2,
        username: 'student_demo',
        email: 'student@example.com',
        role_code: 'student',
        created_at: new Date('2026-07-15T00:00:00.000Z'),
      },
      {
        id: 3,
        username: 'counselor_demo',
        email: 'counselor@example.com',
        role_code: 'counselor',
        created_at: new Date('2026-07-15T01:00:00.000Z'),
      },
    ])
    const repository = createManagementRepository(db)

    await expect(repository.listAdminUsers()).resolves.toEqual([
      {
        id: 2,
        username: 'student_demo',
        email: 'student@example.com',
        role: 'user',
        createdAt: '2026-07-15T00:00:00.000Z',
      },
      {
        id: 3,
        username: 'counselor_demo',
        email: 'counselor@example.com',
        role: 'admin',
        createdAt: '2026-07-15T01:00:00.000Z',
      },
    ])

    expect(db.calls[0].sql).toContain('FROM users u')
    expect(db.calls[0].sql).toContain('JOIN roles r')
    expect(db.calls[0].sql).not.toContain('sqlite')
    expect(db.calls[0].params).toEqual([])
  })

  it('lists anonymized mood records from normalized MySQL mood tables', async () => {
    const db = new FakeManagementDb()
    db.queueRows([{ total: 1 }])
    db.queueRows([
      {
        id: 10,
        userId: 2,
        username: 'student_demo',
        moodTypes: '焦虑,平静',
        intensity: '5.50',
        createdAt: new Date('2026-07-15T02:00:00.000Z'),
      },
    ])
    const repository = createManagementRepository(db)

    await expect(
      repository.listAdminMoods({
        page: 1,
        pageSize: 20,
        username: 'student',
        moodType: '焦虑',
      })
    ).resolves.toEqual({
      list: [
        {
          id: 10,
          userId: 2,
          username: 'student_demo',
          moodType: ['焦虑', '平静'],
          intensity: 5.5,
          createdAt: '2026-07-15T02:00:00.000Z',
        },
      ],
      total: 1,
      page: 1,
      pageSize: 20,
    })

    const countSql = db.calls[0].sql
    const listSql = db.calls[1].sql
    expect(countSql).toContain('COUNT(DISTINCT m.id)')
    expect(listSql).toContain('GROUP_CONCAT(DISTINCT et.name')
    expect(listSql).toContain('moods m')
    expect(listSql).toContain('mood_emotions me')
    expect(listSql).toContain('emotion_types et')
    expect(listSql).not.toContain('mood_type')
    expect(listSql).not.toContain('note_ciphertext')
    expect(listSql).not.toContain('trigger_ciphertext')
    expect(db.calls[0].params).toEqual(['%student%', '%焦虑%'])
    expect(db.calls[1].params).toEqual(['%student%', '%焦虑%', 20, 0])
  })
})
