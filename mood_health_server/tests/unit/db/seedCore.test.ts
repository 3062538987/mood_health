import {
  seedReferenceData,
  REFERENCE_PERMISSIONS,
  REFERENCE_ROLES,
  ROLE_PERMISSION_CODES,
} from '../../../src/db/seeds/coreSeed'

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
    expect(result.permissions).toBe(30)
    expect(result.rolePermissions).toBe(40)
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
      'mood.record.read',
      'user.manage',
      'user.role.assign',
      'role.manage',
      'system.config',
      'audit.log.read',
      'audit.record.view_all',
      'case.read_assigned',
      'case.read_own',
      'case.create',
      'case.assign',
      'case.intervene',
      'case.refer',
      'case.close',
      'activity.manage',
      'course.manage',
      'music.manage',
      'post.audit.pending.read',
      'post.audit',
      'user.delete',
      'prompt.manage',
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

  it('seeds emotion codes used by the frontend record form', async () => {
    const db = new FakeSeedDatabase()

    await seedReferenceData(db)

    const seededCodes = db.queries
      .filter((query) => query.sql.includes('INSERT INTO emotion_types'))
      .map((query) => query.params[0])

    expect(seededCodes).toContain('delight')
    expect(seededCodes).toContain('excited')
    expect(seededCodes).not.toContain('ight')
    expect(seededCodes).not.toContain('ex')
  })

  it('grants super_admin every permission required by protected routes', () => {
    const requiredRoutePermissions = [
      'activity.manage',
      'audit.record.view_all',
      'case.assign',
      'case.close',
      'case.create',
      'case.intervene',
      'case.read_own',
      'case.refer',
      'course.manage',
      'mood.record.read',
      'music.manage',
      'post.audit',
      'post.audit.pending.read',
      'prompt.manage',
      'role.manage',
      'system.config',
      'user.manage',
    ]
    const seededPermissionCodes = REFERENCE_PERMISSIONS.map((permission) => permission.code)

    expect(seededPermissionCodes).toEqual(expect.arrayContaining(requiredRoutePermissions))
    expect(ROLE_PERMISSION_CODES.super_admin).toEqual(expect.arrayContaining(requiredRoutePermissions))
  })
})
