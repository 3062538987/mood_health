import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import dotenv from 'dotenv'
import logger from '../utils/logger'
import { logOperation } from '../utils/operationLogger'
import { UserRole, isValidUserRole } from '../models/userModel'

dotenv.config()

export type PermissionCode =
  | 'user.manage'
  | 'role.manage'
  | 'system.config'
  | 'incident.fix'
  | 'audit.record.view_all'
  | 'post.audit'
  | 'post.audit.pending.read'
  | 'activity.manage'
  | 'course.manage'
  | 'music.manage'
  | 'report.view'
  | 'feedback.handle'
  | 'mood.record.read'
  | 'mood.record.create'
  | 'mood.record.update'
  | 'mood.record.delete'
  | 'mood.advice.history.read'
  | 'questionnaire.read'
  | 'questionnaire.submit'
  | 'ai.mood.analyze'
  | 'ai.counseling.use'
  | 'post.create'
  | 'post.comment.create'
  | 'post.like'
  | 'activity.join'
  | 'relax.record.manage'
  | 'achievement.read'
  | 'auth.profile.read'
  | 'auth.register.role_assign'

interface RolePermissionConfig {
  granted: readonly PermissionCode[]
  forbidden: readonly PermissionCode[]
}

/**
 * 角色-权限映射表
 * granted: 当前角色允许的权限
 * forbidden: 当前角色显式禁止的权限（命中直接 403）
 */
export const rolePermissions: Record<UserRole, RolePermissionConfig> = {
  super_admin: {
    granted: [
      'user.manage',
      'role.manage',
      'system.config',
      'incident.fix',
      'audit.record.view_all',
      'post.audit',
      'activity.manage',
      'course.manage',
      'music.manage',
      'report.view',
      'feedback.handle',
      'mood.record.read',
      'questionnaire.submit',
      'ai.mood.analyze',
      'auth.profile.read',
    ],
    forbidden: ['auth.register.role_assign'],
  },
  admin: {
    granted: [
      'post.audit.pending.read',
      'post.audit',
      'activity.manage',
      'course.manage',
      'music.manage',
      'report.view',
      'feedback.handle',
      'mood.record.read',
      'questionnaire.submit',
      'ai.mood.analyze',
      'auth.profile.read',
    ],
    forbidden: ['role.manage', 'system.config', 'incident.fix', 'auth.register.role_assign'],
  },
  user: {
    granted: [
      'auth.profile.read',
      'mood.record.create',
      'mood.record.read',
      'mood.record.update',
      'mood.record.delete',
      'mood.advice.history.read',
      'post.create',
      'post.comment.create',
      'post.like',
      'activity.join',
      'questionnaire.read',
      'questionnaire.submit',
      'ai.counseling.use',
      'relax.record.manage',
      'achievement.read',
    ],
    forbidden: [
      'post.audit',
      'post.audit.pending.read',
      'activity.manage',
      'course.manage',
      'music.manage',
      'user.manage',
      'role.manage',
      'system.config',
      'incident.fix',
      'audit.record.view_all',
      'feedback.handle',
      'report.view',
      'auth.register.role_assign',
    ],
  },
}

interface JwtUserPayload {
  userId: number
  username: string
  role: string
}

// 扩展 Request 类型，添加 user 属性
export interface AuthRequest extends Request {
  user?: { userId: number; username: string; role: string }
}

const sendAuthError = (req: Request, res: Response, statusCode: number, message: string) => {
  return res.status(statusCode).json({
    code: statusCode,
    message,
    path: req.originalUrl,
    timestamp: new Date().toISOString(),
  })
}

const getClientIp = (req: Request): string => {
  const forwarded = req.headers['x-forwarded-for']
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0].trim()
  }
  return req.ip || '-'
}

const getRoleFromToken = (role: unknown): UserRole => {
  if (isValidUserRole(role)) {
    return role
  }

  logger.warn('检测到非法角色，已回退为 user', { role })
  return 'user'
}

const getNormalizedRequestRole = (req: AuthRequest): UserRole => {
  return getRoleFromToken(req.user?.role)
}

export const authenticate = (req: AuthRequest, res: Response, next: NextFunction) => {
  const jwtSecret = process.env.JWT_SECRET
  const authHeader = req.headers.authorization
  if (!authHeader) {
    return sendAuthError(req, res, 401, '未提供认证令牌')
  }

  const [scheme, token] = authHeader.split(' ')
  if (scheme !== 'Bearer' || !token) {
    return sendAuthError(req, res, 401, '令牌格式错误')
  }

  if (!jwtSecret) {
    logger.error('JWT_SECRET 未配置', { path: req.originalUrl })
    return sendAuthError(req, res, 500, '服务配置错误')
  }

  try {
    const decoded = jwt.verify(token, jwtSecret) as JwtUserPayload
    req.user = {
      userId: decoded.userId,
      username: decoded.username,
      role: getRoleFromToken(decoded.role),
    }
    next()
  } catch (error) {
    logger.warn('JWT 校验失败', {
      path: req.originalUrl,
      reason: error instanceof Error ? error.message : 'unknown_error',
    })
    return sendAuthError(req, res, 401, '无效或过期令牌')
  }
}

// 管理员权限检查
export const requireAdmin = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.user) {
    return sendAuthError(req, res, 401, '未登录')
  }

  if (req.user.role !== 'admin') {
    logger.warn('管理员权限校验失败', {
      path: req.originalUrl,
      username: req.user.username,
      role: req.user.role,
    })
    void logOperation(
      req.user.userId,
      req.user.role,
      'post.audit',
      'ACCESS_DENIED',
      null,
      `requireAdmin 拒绝访问: ${req.originalUrl}`,
      'failed',
      getClientIp(req)
    )
    return sendAuthError(req, res, 403, '需要管理员权限')
  }

  next()
}

/**
 * 多角色校验中间件
 * @param {string[]} roles - 允许访问的角色列表
 * @returns {Function} Express 中间件
 */
export const requireRole = (roles: string[]) => {
  const allowedRoles = new Set(roles)

  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return sendAuthError(req, res, 401, '未登录')
    }

    if (!allowedRoles.has(req.user.role)) {
      logger.warn('角色校验失败', {
        path: req.originalUrl,
        username: req.user.username,
        role: req.user.role,
        requiredRoles: roles,
      })
      void logOperation(
        req.user.userId,
        req.user.role,
        'role.check',
        'ACCESS_DENIED',
        null,
        `角色校验失败: path=${req.originalUrl}, requiredRoles=${roles.join(',')}`,
        'failed',
        getClientIp(req)
      )
      return sendAuthError(req, res, 403, '角色权限不足')
    }

    next()
  }
}

/**
 * 权限校验中间件
 * @param {string} permission - 目标权限编码
 * @returns {Function} Express 中间件
 */
export const requirePermission = (permission: string) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return sendAuthError(req, res, 401, '未登录')
    }

    const userRole = getNormalizedRequestRole(req)
    const permissionConfig = rolePermissions[userRole]

    if (permissionConfig.forbidden.includes(permission as PermissionCode)) {
      logger.warn('命中禁止权限', {
        path: req.originalUrl,
        username: req.user.username,
        role: userRole,
        permission,
      })
      void logOperation(
        req.user.userId,
        userRole,
        permission,
        'ACCESS_DENIED',
        null,
        `命中禁止权限: ${req.originalUrl}`,
        'failed',
        getClientIp(req)
      )
      return sendAuthError(req, res, 403, '权限不足：该操作被禁止')
    }

    if (!permissionConfig.granted.includes(permission as PermissionCode)) {
      logger.warn('权限校验失败', {
        path: req.originalUrl,
        username: req.user.username,
        role: userRole,
        permission,
      })
      void logOperation(
        req.user.userId,
        userRole,
        permission,
        'ACCESS_DENIED',
        null,
        `权限校验失败: ${req.originalUrl}`,
        'failed',
        getClientIp(req)
      )
      return sendAuthError(req, res, 403, '权限不足')
    }

    next()
  }
}
