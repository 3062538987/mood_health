/**
 * 角色变更授权（纯函数，无副作用依赖）。
 *
 * 防御性硬约束（独立于 RBAC 路由守卫）：
 *  - 仅 super_admin 可授予 / 移除 super_admin（阻断 admin 自我提权）
 *  - 禁止变更当前登录用户自身的角色（防自提权 / 自锁）
 *
 * 抽离为独立模块，避免引入 managementController 的副作用依赖
 * （如 operationLogger 在导入时即建立 MySQL 连接），便于单元测试。
 */

import type { LegacyAdminRole } from '../repositories/managementRepository'

export const isValidUserRole = (role: unknown): role is LegacyAdminRole =>
  role === 'user' || role === 'admin' || role === 'super_admin'

export const checkRoleChangeAuthorization = (
  ctx: {
    caller: { userId: number; role: string }
    targetUserId: number
    targetRole: LegacyAdminRole
  }
): { status: number; message: string } | null => {
  if (ctx.targetUserId === ctx.caller.userId) {
    return { status: 400, message: '不能变更当前登录用户自身的角色' }
  }
  if (ctx.targetRole === 'super_admin' && ctx.caller.role !== 'super_admin') {
    return { status: 403, message: '仅超级管理员可授予超级管理员角色' }
  }
  return null
}
