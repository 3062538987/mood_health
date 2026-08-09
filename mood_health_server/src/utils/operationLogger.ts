import winston from 'winston'
import fs from 'fs'
import path from 'path'
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

// test 环境或日志文件被占用/无权限时，不写文件日志，避免进程退出。
// 先探测目标文件是否可写，可写才创建 File 传输；否则降级为仅控制台。
// 运行时若仍发生 logs/ 下的写入异常，由 logger 的作用域化进程守卫兜底（不杀进程）。
const OPERATION_LOG_FILE = 'logs/operation.log'
const operationFileTransports: winston.transport[] = []
if (process.env.NODE_ENV !== 'test') {
  let writable = false
  try {
    fs.mkdirSync(path.dirname(OPERATION_LOG_FILE), { recursive: true })
    const fd = fs.openSync(OPERATION_LOG_FILE, 'a')
    fs.closeSync(fd)
    writable = true
  } catch {
    writable = false
  }
  if (writable) {
    try {
      operationFileTransports.push(
        new winston.transports.File({
          filename: OPERATION_LOG_FILE,
          level: 'info',
          maxsize: 20 * 1024 * 1024,
          maxFiles: 10,
        })
      )
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[operationLogger] 操作日志文件打开失败（已降级为仅控制台）:', (err as Error).message)
    }
  } else {
    // eslint-disable-next-line no-console
    console.warn('[operationLogger] 操作日志文件不可写，已降级为仅控制台:', path.resolve(OPERATION_LOG_FILE))
  }
}

const operationFileLogger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  transports: operationFileTransports,
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
