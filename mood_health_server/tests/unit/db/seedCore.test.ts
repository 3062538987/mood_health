import { seedReferenceData, REFERENCE_PERMISSIONS, REFERENCE_ROLES } from '../../../src/db/seeds/coreSeed'

class FakeSeedDatabase {
  public readonly queries: Array<{ sql: string; params: unknown[] }> = []

  async query<T = unknown>(sql: string, params: unknown[] = []): Promise<T[]> {
    this.queries.push({ sql, params })
    return [] as T[]
  }
}

describe('core seed', () => {
  it('seeds the approved R0 reference roles, permissions, and mappings', async () => {
    const db = new FakeSeedDatabase()

    const result = await seedReferenceData(db)

    expect(result.roles).toBe(3)
    expect(result.permissions).toBe(20)
    expect(result.rolePermissions).toBe(29)
    expect(REFERENCE_ROLES.map((role) => role.code)).toEqual(['student', 'counselor', 'super_admin'])
    expect(REFERENCE_PERMISSIONS.map((permission) => permission.code)).toEqual([
      'auth.profile.read',
      'mood.record.create',
      'mood.record.read_own',
      'mood.record.update_own',
      'mood.record.delete_own',
      'assessment.instrument.read',
      'assessment.submit',
      'assessment.history.read_own',
      'report.aggregate.read',
      'user.manage',
      'user.role.assign',
      'audit.log.read',
      'case.read_assigned',
      'case.read_own',
      'case.create',
      'case.assign',
      'case.intervene',
      'case.refer',
      'case.close',
      'user.delete',
    ])
  })

  it('uses parameterized upsert statements and does not seed active assessment scales', async () => {
    const db = new FakeSeedDatabase()

    await seedReferenceData(db)

    const sqlText = db.queries.map((query) => query.sql).join('\n')
    expect(sqlText).toContain('ON DUPLICATE KEY UPDATE')
    expect(sqlText).not.toContain('created_at = created_at')
    expect(sqlText).not.toContain('assessment_instruments')
    expect(sqlText).not.toContain('assessment_versions')
    expect(db.queries.every((query) => query.params.length > 0)).toBe(true)
  })
})
