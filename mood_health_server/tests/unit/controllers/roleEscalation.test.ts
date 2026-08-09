import { checkRoleChangeAuthorization } from '../../../src/utils/roleAuthorization'

/**
 * R2 修复回归测试：角色变更硬约束（防 admin 自我提权 / 禁止自变更）。
 * 该函数为纯函数，独立于 RBAC 路由守卫，作为后端提权防御的最后一道校验。
 */
describe('checkRoleChangeAuthorization (R2 提权约束)', () => {
  it('拒绝 admin 将他人提权为 super_admin', () => {
    const result = checkRoleChangeAuthorization({
      caller: { userId: 1, role: 'admin' },
      targetUserId: 2,
      targetRole: 'super_admin',
    })
    expect(result).not.toBeNull()
    expect(result?.status).toBe(403)
    expect(result?.message).toContain('超级管理员')
  })

  it('拒绝任何人变更自身角色（含 admin 自提 super_admin）', () => {
    const result = checkRoleChangeAuthorization({
      caller: { userId: 1, role: 'admin' },
      targetUserId: 1,
      targetRole: 'super_admin',
    })
    expect(result).not.toBeNull()
    expect(result?.status).toBe(400)
    expect(result?.message).toContain('自身')
  })

  it('允许 super_admin 将他人提权为 super_admin', () => {
    const result = checkRoleChangeAuthorization({
      caller: { userId: 1, role: 'super_admin' },
      targetUserId: 2,
      targetRole: 'super_admin',
    })
    expect(result).toBeNull()
  })

  it('允许 admin 将他人角色变更为 admin / user', () => {
    const toAdmin = checkRoleChangeAuthorization({
      caller: { userId: 1, role: 'admin' },
      targetUserId: 2,
      targetRole: 'admin',
    })
    expect(toAdmin).toBeNull()

    const toUser = checkRoleChangeAuthorization({
      caller: { userId: 1, role: 'admin' },
      targetUserId: 3,
      targetRole: 'user',
    })
    expect(toUser).toBeNull()
  })

  it('super_admin 自改自身角色也被拒绝（防自锁）', () => {
    const result = checkRoleChangeAuthorization({
      caller: { userId: 1, role: 'super_admin' },
      targetUserId: 1,
      targetRole: 'admin',
    })
    expect(result).not.toBeNull()
    expect(result?.status).toBe(400)
  })
})
