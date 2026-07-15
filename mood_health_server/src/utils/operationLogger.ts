import winston from 'winston'
import { NextFunction, Response } from 'express'
import logger, { sanitizeForLogs, summarizeRequestBody } from './logger'
import type { AuthRequest } from '../middleware/auth'
import { createAuditService } from '../services/auditService'

export type OperationResult = 'success' | 'failed'

const auditService = createAuditService()

/**
 * 通用操作审计记录函数
 */
export const logOperation = async (
  userId: number | null,
  userRole: string,
  permissionCode: string,
  operationType: string,
  targetId: string | null,
  content: string,
  result: OperationResult,
  ip: string
) => {
  const operationLog = {
    userId,
    userRole,
    permissionCode,
    operationType,
    targetId,
    content,
    result,
    ip,
    operationTime: new Date().toISOString(),
  }

  // 1) 写入 Winston 审计日志文件
  operationFileLogger.info('operation_audit', sanitizeForLogs(operationLog))

  // 2) 写入数据库审计表
  try {
    await auditService.record({
      actorUserId: userId,
      actorRoleCode: userRole,
      permissionCode,
      action: operationType,
      targetType: null,
      targetId,
      result,
      summary: content,
      ipAddress: ip,
      requestId: null,
    })
  } catch (error) {
    logger.error('写入操作审计日志失败', {
      error,
      operationLog,
    })
  }
}

const operationFileLogger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  transports: [
    new winston.transports.File({
      filename: 'logs/operation.log',
      level: 'info',
      maxsize: 20 * 1024 * 1024,
      maxFiles: 10,
    }),
  ],
})

interface AuditOptions {
  permissionCode: string
  operationType: string
  getTargetId?: (req: AuthRequest) => string | null
  getContent?: (req: AuthRequest) => string
}

/**
 * 路由级审计中间件
 */
export const auditOperation = (options: AuditOptions) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    const startedAt = Date.now()

    res.on('finish', () => {
      if (!req.user) {
        return
      }

      const targetId = options.getTargetId ? options.getTargetId(req) : null
      const content = options.getContent
        ? options.getContent(req)
        : JSON.stringify(summarizeRequestBody(req.body) || {})

      const result: OperationResult =
        res.statusCode >= 200 && res.statusCode < 400 ? 'success' : 'failed'
      const ip =
        (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() ||
        req.ip ||
        '-'

      void logOperation(
        req.user.userId,
        req.user.role,
        options.permissionCode,
        options.operationType,
        targetId,
        `${content}; status=${res.statusCode}; durationMs=${Date.now() - startedAt}`,
        result,
        ip
      )
    })

    next()
  }
}
