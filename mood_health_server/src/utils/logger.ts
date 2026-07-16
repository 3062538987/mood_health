import winston from 'winston'
import DailyRotateFile from 'winston-daily-rotate-file'

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

const logger = winston.createLogger({
  level: logLevel,
  format: fileFormat,
  transports: [
    // 按天切割的文件传输
    new DailyRotateFile({
      filename: 'logs/app-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxFiles: '14d',
      maxSize: '20m',
      zippedArchive: true,
    }),
    // 错误日志单独存储
    new DailyRotateFile({
      filename: 'logs/error-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxFiles: '14d',
      maxSize: '20m',
      zippedArchive: true,
      level: 'error',
    }),
  ],
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
