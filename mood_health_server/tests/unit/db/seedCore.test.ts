import { seedReferenceData, REFERENCE_PERMISSIONS, REFERENCE_ROLES } from '../../../src/db/seeds/coreSeed'

class FakeSeedDatabase {
  public readonly queries: Array<{ sql: string; params: unknown[] }> = []

  async query<T = unknown>(sql: string, params: unknown[] = []): Promise<T[]> {
    this.queries.push({ sql, params })
    return [] as T[]
  }
}

describe('core seed', () => {
  it('seeds the current reference roles, permissions, and mappings', async () => {
    const db = new FakeSeedDatabase()

    const result = await seedReferenceData(db)

    expect(result.roles).toBe(4)
    expect(result.permissions).toBe(45)
    expect(result.rolePermissions).toBe(49)
    expect(REFERENCE_ROLES.map((role) => role.code)).toEqual([
      'student',
      'counselor',
      'super_admin',
      'admin',
    ])

    const permissionCodes = REFERENCE_PERMISSIONS.map((permission) => permission.code)
    expect(new Set(permissionCodes).size).toBe(permissionCodes.length)
    expect(permissionCodes).toEqual(
      expect.arrayContaining([
        'auth.profile.read',
        'mood.record.create',
        'assessment.submit',
        'user.manage',
        'prompt.manage',
        'post.audit',
        'activity.manage',
      ])
    )
  })

  it('uses parameterized upsert statements and does not seed active assessment scales', async () => {
    const db = new FakeSeedDatabase()

    await seedReferenceData(db)

    const sqlText = db.queries.map((query) => query.sql).join('\n')
    expect(sqlText).toContain('ON DUPLICATE KEY UPDATE')
    expect(sqlText).not.toContain('created_at = created_at')
    expect(sqlText).not.toContain('assessment_instruments')
    expect(sqlText).not.toContain('assessment_versions')
    const resetQueries = db.queries.filter(
      (query) => query.sql.trim() === 'DELETE FROM role_permissions'
    )
    const dataQueries = db.queries.filter(
      (query) => query.sql.trim() !== 'DELETE FROM role_permissions'
    )
    expect(resetQueries).toHaveLength(1)
    expect(dataQueries.every((query) => query.params.length > 0)).toBe(true)
  })
})
