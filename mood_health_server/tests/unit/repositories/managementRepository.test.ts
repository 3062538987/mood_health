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

  queueResult(result: unknown): void {
    this.responses.push(result)
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

  it('finds an admin user by id through MySQL role tables', async () => {
    const db = new FakeManagementDb()
    db.queueRows([
      {
        id: 2,
        username: 'student_demo',
        email: 'student@example.com',
        role_code: 'student',
        created_at: new Date('2026-07-15T00:00:00.000Z'),
      },
    ])
    const repository = createManagementRepository(db)

    await expect(repository.findAdminUserById(2)).resolves.toEqual({
      id: 2,
      username: 'student_demo',
      email: 'student@example.com',
      role: 'user',
      createdAt: '2026-07-15T00:00:00.000Z',
    })
    expect(db.calls[0].params).toEqual([2])
  })

  it('maps legacy admin role names to fixed MySQL role codes when updating a user', async () => {
    const db = new FakeManagementDb()
    db.queueRows([{ id: 3 }])
    db.queueResult({ affectedRows: 1 })
    const repository = createManagementRepository(db)

    await expect(repository.updateUserRole(2, 'admin')).resolves.toBe(true)

    expect(db.calls[0].sql).toContain('FROM roles')
    expect(db.calls[0].params).toEqual(['counselor'])
    expect(db.calls[1].sql).toContain('UPDATE users')
    expect(db.calls[1].params).toEqual([3, 2])
  })

  it('deletes a user with cascade cleanup through the MySQL repository boundary', async () => {
    const db = new FakeManagementDb()
    // SELECT username first
    db.queueRows([{ username: 'student_demo' }])
    // cascade DELETEs: mood_records, assessment_sessions, case_interventions,
    // cases, audit_logs, user_roles, refresh_tokens, users
    for (let i = 0; i < 8; i++) {
      db.queueResult({ affectedRows: 1 })
    }
    const repository = createManagementRepository(db)

    await expect(repository.deleteUserById(2)).resolves.toBe(true)
    // First call is SELECT username
    expect(db.calls[0].sql).toContain('SELECT username FROM users')
    expect(db.calls[0].params).toEqual([2])
    // Last call is DELETE FROM users
    const lastCall = db.calls[db.calls.length - 1]
    expect(lastCall.sql).toContain('DELETE FROM users')
    expect(lastCall.params).toEqual([2])
  })
})
