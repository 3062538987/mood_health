import winston from 'winston'
import DailyRotateFile from 'winston-daily-rotate-file'
import fs from 'fs'
import path from 'path'

/**
 * 企业级日志系统
 * 使用 winston + winston-daily-rotate-file 实现
 * 按天自动切割日志文件，保存 14 天
 */

// 日志级别配置
const logLevel = process.env.NODE_ENV === 'production' ? 'info' : 'debug'
const sensitiveKeyPattern =
  /(password|token|authorization|secret|cookie|set-cookie|idcard|身份证|db_password|jwt_secret)/i
const bearerTokenPattern = /Bearer\s+[A-Za-z0-9\-._~+/=]+/gi
const jwtPattern = /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9._-]+\.[A-Za-z0-9._-]+\b/g
const idCardPattern = /\b\d{17}[\dXx]\b/g

const sanitizeString = (value: string): string => {
  return value
    .replace(bearerTokenPattern, 'Bearer [REDACTED]')
    .replace(jwtPattern, '[REDACTED_JWT]')
    .replace(idCardPattern, '[REDACTED_ID_CARD]')
}

export const sanitizeForLogs = (value: unknown, key: string = '', depth: number = 0): unknown => {
  if (depth > 5) {
    return '[TRUNCATED]'
  }

  if (value === null || value === undefined) {
    return value
  }

  if (sensitiveKeyPattern.test(key)) {
    return '[REDACTED]'
  }

  if (typeof value === 'string') {
    return sanitizeString(value)
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return value
  }

  if (value instanceof Error) {
    return {
      name: value.name,
      message: sanitizeString(value.message),
      stack:
        process.env.NODE_ENV === 'production' || !value.stack
          ? undefined
          : sanitizeString(value.stack),
    }
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeForLogs(item, '', depth + 1))
  }

  if (typeof value === 'object') {
    const sanitized: Record<string, unknown> = {}
    for (const [childKey, childValue] of Object.entries(value as Record<string, unknown>)) {
      sanitized[childKey] = sanitizeForLogs(childValue, childKey, depth + 1)
    }
    return sanitized
  }

  return String(value)
}

export const summarizeRequestBody = (body: unknown) => {
  if (body === null || body === undefined) {
    return null
  }

  if (typeof body === 'string') {
    return { type: 'string', length: body.length }
  }

  if (Array.isArray(body)) {
    return { type: 'array', length: body.length }
  }

  if (typeof body === 'object') {
    const keys = Object.keys(body as Record<string, unknown>)
    return {
      type: 'object',
      keyCount: keys.length,
      keys,
      redactedKeys: keys.filter((key) => sensitiveKeyPattern.test(key)),
    }
  }

  return { type: typeof body }
}

/**
 * AI 内容日志截断 - 防止日志中记录完整 prompt/response
 */
export const truncateAiContent = (content: string, maxLength = 200): string => {
  if (content.length <= maxLength) return content
  return content.substring(0, maxLength) + `...[truncated ${content.length - maxLength} chars]`
}

const sanitizeLogFormat = winston.format((info) => {
  return sanitizeForLogs(info) as winston.Logform.TransformableInfo
})

// 自定义控制台日志格式（带颜色）
const consoleFormat = winston.format.combine(
  sanitizeLogFormat(),
  winston.format.colorize({
    all: true,
    colors: {
      info: 'green',
      warn: 'yellow',
      error: 'red',
    },
  }),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
    const metaText = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : ''
    return stack
      ? `${timestamp} [${level}]: ${message}${metaText}\n${stack}`
      : `${timestamp} [${level}]: ${message}${metaText}`
  })
)

// 自定义文件日志格式
const fileFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  sanitizeLogFormat(),
  winston.format.json()
)

// 文件传输（按天切割）。健壮性目标：无论日志文件是否被占用/无权限，
// 单个日志故障都绝不能拖垮整个服务进程。
const LOG_DIR = 'logs'

/**
 * 计算 DailyRotateFile 当天实际文件路径（datePattern=YYYY-MM-DD）。
 * pattern 本身已含 logs/ 前缀，这里仅替换日期并解析为绝对路径，
 * 用于启动前探测该文件是否可写，避免创建传输后首次写入时才因权限/占用抛错。
 */
const resolveTodayLogFile = (pattern: string): string =>
  path.resolve(pattern.replace('%DATE%', new Date().toISOString().slice(0, 10)))

/**
 * 探测日志目标是否可写：目录可创建 + 目标文件可追加打开（不删除已有日志）。
 * 环境文件锁（如共享只读锁）会导致 open 失败，此时返回 false，降级为仅控制台。
 */
const isLogFileWritable = (pattern: string): boolean => {
  const target = resolveTodayLogFile(pattern)
  try {
    fs.mkdirSync(LOG_DIR, { recursive: true })
    const fd = fs.openSync(target, 'a')
    fs.closeSync(fd)
    return true
  } catch {
    return false
  }
}

/**
 * 作用域化的进程级异常守卫：仅吞掉 logs/ 目录下的 EPERM/ENOENT 类文件错误
 * （这些错误来自日志写入，不应杀死服务）；其它未捕获异常照常退出进程，
 * 绝不掩盖真实 bug。
 */
let logErrorGuardInstalled = false
const installLogErrorGuard = (): void => {
  if (logErrorGuardInstalled) return
  logErrorGuardInstalled = true
  process.on('uncaughtException', (err: unknown) => {
    const e = err as NodeJS.ErrnoException
    const p = typeof e?.path === 'string' ? e.path : ''
    const isLogErr =
      (e?.code === 'EPERM' || e?.code === 'ENOENT') &&
      path.resolve(p).startsWith(path.resolve(LOG_DIR))
    if (isLogErr) {
      // eslint-disable-next-line no-console
      console.error('[logger] 忽略日志文件写入异常（服务继续运行）:', e?.message, p)
      return
    }
    // 非日志错误：记录后退出，避免在破损状态下继续运行
    // eslint-disable-next-line no-console
    console.error('[uncaughtException]', err)
    process.exit(1)
  })
}

const onTransportError = (err: Error) => {
  // eslint-disable-next-line no-console
  console.error('[logger] 文件日志传输失败（已降级为仅控制台）:', err.message)
}

const buildFileTransports = (): winston.transport[] => {
  const transports: winston.transport[] = []

  const appPattern = 'logs/app-%DATE%.log'
  if (isLogFileWritable(appPattern)) {
    try {
      const appFileTransport = new DailyRotateFile({
        filename: appPattern,
        datePattern: 'YYYY-MM-DD',
        maxFiles: '14d',
        maxSize: '20m',
        zippedArchive: true,
      })
      appFileTransport.on('error', onTransportError)
      transports.push(appFileTransport)
    } catch (err) {
      onTransportError(err as Error)
    }
  } else {
    // eslint-disable-next-line no-console
    console.warn('[logger] 日志文件不可写，已降级为仅控制台:', resolveTodayLogFile(appPattern))
  }

  const errPattern = 'logs/error-%DATE%.log'
  if (isLogFileWritable(errPattern)) {
    try {
      const errorFileTransport = new DailyRotateFile({
        filename: errPattern,
        datePattern: 'YYYY-MM-DD',
        maxFiles: '14d',
        maxSize: '20m',
        zippedArchive: true,
        level: 'error',
      })
      errorFileTransport.on('error', onTransportError)
      transports.push(errorFileTransport)
    } catch (err) {
      onTransportError(err as Error)
    }
  }

  return transports
}

installLogErrorGuard()
// test 环境不写文件日志；其它环境在日志文件可写时才创建文件传输，否则降级为仅控制台
const fileTransports = process.env.NODE_ENV === 'test' ? [] : buildFileTransports()

const logger = winston.createLogger({
  level: logLevel,
  format: fileFormat,
  transports: fileTransports,
})

// 开发环境添加控制台输出
if (process.env.NODE_ENV !== 'production') {
  logger.add(
    new winston.transports.Console({
      format: consoleFormat,
    })
  )
}

export default logger
