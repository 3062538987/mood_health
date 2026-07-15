import { createAuditRepository } from '../../../src/repositories/auditRepository'

type QueryCall = {
  sql: string
  params: unknown[]
}

class FakeMysqlExecutor {
  public readonly calls: QueryCall[] = []
  private readonly responses: unknown[] = []

  queueRows(rows: unknown[]): void {
    this.responses.push(rows)
  }

  async query<T>(sql: string, params: unknown[] = []): Promise<[T, unknown]> {
    this.calls.push({ sql, params })
    return [(this.responses.shift() ?? { insertId: 12 }) as T, []]
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

  it('lists filtered audit records from MySQL without exposing summary or IP fields', async () => {
    const db = new FakeMysqlExecutor()
    db.queueRows([{ total: 1 }])
    db.queueRows([
      {
        id: 9,
        actor_user_id: 2,
        actor_role_code: 'super_admin',
        permission_code: 'user.manage',
        action: 'USER_LIST',
        target_id: null,
        result: 'success',
        created_at: new Date('2026-07-15T00:00:00.000Z'),
      },
    ])
    const repository = createAuditRepository(db)

    await expect(
      repository.list({
        role: 'super_admin',
        permission: 'user.manage',
        startTime: '2026-07-01T00:00:00.000Z',
        endTime: '2026-07-31T23:59:59.999Z',
        page: 2,
        pageSize: 20,
      })
    ).resolves.toEqual({
      list: [
        {
          id: 9,
          operatorId: 2,
          operatorRole: 'super_admin',
          permissionCode: 'user.manage',
          operationType: 'USER_LIST',
          targetId: null,
          operationTime: '2026-07-15T00:00:00.000Z',
          operationResult: 'success',
        },
      ],
      total: 1,
      page: 2,
      pageSize: 20,
    })

    expect(db.calls[0].sql).toContain('FROM audit_logs')
    expect(db.calls[1].sql).toContain('FROM audit_logs')
    expect(db.calls[1].sql).not.toContain('summary')
    expect(db.calls[1].sql).not.toContain('ip_address')
    expect(db.calls[0].params).toEqual([
      'super_admin',
      'user.manage',
      '2026-07-01T00:00:00.000Z',
      '2026-07-31T23:59:59.999Z',
    ])
    expect(db.calls[1].params).toEqual([
      'super_admin',
      'user.manage',
      '2026-07-01T00:00:00.000Z',
      '2026-07-31T23:59:59.999Z',
      20,
      20,
    ])
  })
})
