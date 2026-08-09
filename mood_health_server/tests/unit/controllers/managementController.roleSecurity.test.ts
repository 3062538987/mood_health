/**
 * R2 回归测试：角色变更硬约束（checkRoleChangeAuthorization）。
 * 纯函数，无 DB 依赖，锁定「admin 不可自我提权为 super_admin」「禁止自变更」。
 */
import { Response } from 'express'

jest.mock('../../../src/config/mysql', () => ({
  getMysqlPool: jest.fn(() => ({ query: jest.fn().mockResolvedValue([[], []]) })),
}))

jest.mock('../../../src/services/managementService', () => ({
  createManagementService: jest.fn(() => ({
    listAdminUsers: jest.fn(),
    listAdminMoods: jest.fn(),
    findAdminUserById: jest.fn(),
    updateUserRole: jest.fn(),
    deleteUserById: jest.fn(),
  })),
}))

jest.mock('../../../src/utils/operationLogger', () => ({
  logOperation: jest.fn().mockResolvedValue(undefined),
}))

jest.mock('../../../src/middleware/auth', () => ({
  requirePermission: jest.fn(() => (_req: never, res: Response) => {
    res.status(403).json({ code: 1003, message: '权限不足：该操作被禁止', data: null })
  }),
}))

import { checkRoleChangeAuthorization } from '../../../src/utils/roleAuthorization'

describe('checkRoleChangeAuthorization (R2 修复)', () => {
  it('禁止变更当前登录用户自身的角色', () => {
    const result = checkRoleChangeAuthorization({
      caller: { userId: 1, role: 'super_admin' },
      targetUserId: 1,
      targetRole: 'admin',
    })
    expect(result).toEqual({ status: 400, message: '不能变更当前登录用户自身的角色' })
  })

  it('禁止非 super_admin 授予 super_admin（阻断 admin 自我提权）', () => {
    const result = checkRoleChangeAuthorization({
      caller: { userId: 1, role: 'admin' },
      targetUserId: 2,
      targetRole: 'super_admin',
    })
    expect(result).toEqual({ status: 403, message: '仅超级管理员可授予超级管理员角色' })
  })

  it('允许 super_admin 授予 super_admin', () => {
    const result = checkRoleChangeAuthorization({
      caller: { userId: 1, role: 'super_admin' },
      targetUserId: 2,
      targetRole: 'super_admin',
    })
    expect(result).toBeNull()
  })

  it('允许 admin 将其他用户设为 admin', () => {
    const result = checkRoleChangeAuthorization({
      caller: { userId: 1, role: 'admin' },
      targetUserId: 2,
      targetRole: 'admin',
    })
    expect(result).toBeNull()
  })

  it('允许 admin 将其他用户降为 user', () => {
    const result = checkRoleChangeAuthorization({
      caller: { userId: 1, role: 'admin' },
      targetUserId: 2,
      targetRole: 'user',
    })
    expect(result).toBeNull()
  })
})
