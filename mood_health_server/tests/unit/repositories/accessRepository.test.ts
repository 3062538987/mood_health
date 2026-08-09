import { createAccessRepository } from '../../../src/repositories/accessRepository'

type QueryCall = {
  sql: string
  params: unknown[]
}

class FakeMysqlExecutor {
  public readonly calls: QueryCall[] = []
  private readonly rowsQueue: unknown[][] = []

  queueRows(rows: unknown[]): void {
    this.rowsQueue.push(rows)
  }

  async query<T>(sql: string, params: unknown[] = []): Promise<[T, unknown]> {
    this.calls.push({ sql, params })
    return [(this.rowsQueue.shift() ?? []) as T, []]
  }
}

describe('accessRepository', () => {
  it('checks permission through roles, permissions, and role_permissions', async () => {
    const db = new FakeMysqlExecutor()
    db.queueRows([{ granted: 1 }])
    const repository = createAccessRepository(db)

    await expect(repository.hasPermission('student', 'auth.profile.read')).resolves.toBe(true)

    expect(db.calls[0].sql).toContain('FROM roles r')
    expect(db.calls[0].sql).toContain('JOIN role_permissions rp ON rp.role_id = r.id')
    expect(db.calls[0].sql).toContain('JOIN permissions p ON p.id = rp.permission_id')
    expect(db.calls[0].sql).not.toContain('SELECT *')
    expect(db.calls[0].params).toEqual(['student', 'auth.profile.read'])
  })

  it('returns false when the role permission mapping is missing', async () => {
    const db = new FakeMysqlExecutor()
    db.queueRows([])
    const repository = createAccessRepository(db)

    await expect(repository.hasPermission('counselor', 'user.manage')).resolves.toBe(false)
  })
})
