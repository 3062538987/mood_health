import {
  createUserRepository,
  DuplicateUserError,
} from '../../../src/repositories/userRepository'

type QueryCall = {
  sql: string
  params: unknown[]
}

class FakeMysqlExecutor {
  public readonly calls: QueryCall[] = []
  private readonly responses: Array<{ type: 'value'; value: unknown } | { type: 'error'; error: unknown }> =
    []

  queueRows(rows: unknown[]): void {
    this.responses.push({ type: 'value', value: rows })
  }

  queueResult(result: unknown): void {
    this.responses.push({ type: 'value', value: result })
  }

  queueError(error: unknown): void {
    this.responses.push({ type: 'error', error })
  }

  async query<T>(sql: string, params: unknown[] = []): Promise<[T, unknown]> {
    this.calls.push({ sql, params })
    const response = this.responses.shift()
    if (response?.type === 'error') {
      throw response.error
    }
    return [(response?.value ?? []) as T, []]
  }
}

const userRow = {
  id: 7,
  username: 'student_demo',
  password_hash: 'hashed-password',
  email: 'student@example.com',
  nickname: '学生演示',
  avatar_url: 'https://example.com/avatar.png',
  status: 'active',
  role_code: 'student',
  created_at: new Date('2026-01-01T00:00:00.000Z'),
  updated_at: new Date('2026-01-02T00:00:00.000Z'),
  last_login_at: new Date('2026-01-03T00:00:00.000Z'),
}

describe('userRepository', () => {
  it('finds an active user by username through roles join without selecting all columns', async () => {
    const db = new FakeMysqlExecutor()
    db.queueRows([userRow])
    const repository = createUserRepository(db)

    const result = await repository.findAuthUserByUsername('student_demo')

    expect(result).toEqual({
      id: 7,
      username: 'student_demo',
      passwordHash: 'hashed-password',
      email: 'student@example.com',
      nickname: '学生演示',
      avatarUrl: 'https://example.com/avatar.png',
      status: 'active',
      role: 'student',
      createdAt: userRow.created_at,
      updatedAt: userRow.updated_at,
      lastLoginAt: userRow.last_login_at,
    })
    expect(db.calls[0].sql).toContain('JOIN roles r ON r.id = u.role_id')
    expect(db.calls[0].sql).toContain('u.status = ?')
    expect(db.calls[0].sql).not.toContain('SELECT *')
    expect(db.calls[0].params).toEqual(['student_demo', 'active'])
  })

  it('creates a student user by resolving the default student role in one transaction-safe insert', async () => {
    const db = new FakeMysqlExecutor()
    db.queueRows([{ id: 1 }])
    db.queueResult({ insertId: 9, affectedRows: 1 })
    const repository = createUserRepository(db)

    const userId = await repository.createStudentUser({
      username: 'new_student',
      passwordHash: 'hashed-password',
      email: 'new@student.example',
      nickname: null,
    })

    expect(userId).toBe(9)
    expect(db.calls[0].sql).toContain('FROM roles')
    expect(db.calls[0].params).toEqual(['student'])
    expect(db.calls[1].sql).toContain('INSERT INTO users')
    expect(db.calls[1].sql).toContain('role_id')
    expect(db.calls[1].sql).toContain('password_hash')
    expect(db.calls[1].params).toEqual([1, 'new_student', 'hashed-password', 'new@student.example', null])
  })

  it('throws a domain error when username or email violates unique constraints', async () => {
    const db = new FakeMysqlExecutor()
    db.queueRows([{ id: 1 }])
    const duplicateError = Object.assign(new Error('Duplicate entry'), {
      code: 'ER_DUP_ENTRY',
      errno: 1062,
    })
    db.queueError(duplicateError)
    const repository = createUserRepository(db)

    await expect(
      repository.createStudentUser({
        username: 'student_demo',
        passwordHash: 'hashed-password',
        email: 'student@example.com',
        nickname: null,
      })
    ).rejects.toBeInstanceOf(DuplicateUserError)
  })
})
