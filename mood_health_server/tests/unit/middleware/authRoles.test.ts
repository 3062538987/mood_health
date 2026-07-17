import fs from 'fs'
import path from 'path'
import { isValidUserRole, rolePermissions } from '../../../src/middleware/auth'

describe('auth middleware role boundary', () => {
  it('does not import the legacy user model database path', () => {
    const source = fs.readFileSync(
      path.join(__dirname, '../../../src/middleware/auth.ts'),
      'utf8'
    )

    expect(source).not.toContain('../models/userModel')
    expect(source).not.toMatch(/import\s+.*operationLogger/)
  })

  it('accepts both frozen RBAC roles and legacy roles during the R0 transition', () => {
    expect(isValidUserRole('student')).toBe(true)
    expect(isValidUserRole('counselor')).toBe(true)
    expect(isValidUserRole('super_admin')).toBe(true)
    expect(isValidUserRole('user')).toBe(true)
    expect(isValidUserRole('admin')).toBe(true)
    expect(isValidUserRole('owner')).toBe(false)
  })

  it('has permission maps for MySQL JWT role codes used by auth service', () => {
    expect(rolePermissions.student.granted).toContain('auth.profile.read')
    expect(rolePermissions.counselor.granted).toContain('auth.profile.read')
    expect(rolePermissions.super_admin.granted).toContain('user.manage')
  })
})
