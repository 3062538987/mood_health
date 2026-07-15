import { createAuditRepository } from '../../../src/repositories/auditRepository'

type QueryCall = {
  sql: string
  params: unknown[]
}

class FakeMysqlExecutor {
  public readonly calls: QueryCall[] = []

  async query<T>(sql: string, params: unknown[] = []): Promise<[T, unknown]> {
    this.calls.push({ sql, params })
    return [{ insertId: 12 } as T, []]
  }
}

describe('auditRepository', () => {
  it('writes a sanitized audit summary to MySQL audit_logs without selecting legacy operation_logs', async () => {
    const db = new FakeMysqlExecutor()
    const repository = createAuditRepository(db)

    await repository.record({
      actorUserId: 7,
      actorRoleCode: 'student',
      permissionCode: 'auth.profile.read',
      action: 'ACCESS_DENIED',
      targetType: 'auth',
      targetId: 'me',
      result: 'failed',
      summary: '用户尝试访问 profile，password=Password123! token=abc.def.ghi',
      ipAddress: '127.0.0.1',
      requestId: 'req-1',
    })

    expect(db.calls[0].sql).toContain('INSERT INTO audit_logs')
    expect(db.calls[0].sql).not.toContain('operation_logs')
    expect(db.calls[0].params).toEqual([
      7,
      'student',
      'auth.profile.read',
      'ACCESS_DENIED',
      'auth',
      'me',
      'failed',
      '用户尝试访问 profile，[redacted] [redacted]',
      '127.0.0.1',
      'req-1',
    ])
  })

  it('truncates long summaries before storing them', async () => {
    const db = new FakeMysqlExecutor()
    const repository = createAuditRepository(db)

    await repository.record({
      actorUserId: null,
      actorRoleCode: 'anonymous',
      permissionCode: 'auth.login',
      action: 'LOGIN',
      targetType: null,
      targetId: null,
      result: 'success',
      summary: 'x'.repeat(1200),
      ipAddress: null,
      requestId: null,
    })

    expect(String(db.calls[0].params[7]).length).toBe(1000)
  })
})
