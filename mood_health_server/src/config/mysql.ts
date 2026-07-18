import { createPool, Pool } from 'mysql2/promise'

export interface MysqlConfig {
  host: string
  port: number
  database: string
  user: string
  password: string
  connectionLimit: number
  connectTimeoutMs: number
  queryTimeoutMs: number
}

type Environment = Record<string, string | undefined>

const required = (env: Environment, key: string): string => {
  const value = env[key]?.trim()
  if (!value) {
    throw new Error(`缺少必要的 MySQL 环境变量: ${key}`)
  }
  return value
}

const integerInRange = (
  rawValue: string | undefined,
  defaultValue: number,
  key: string,
  minimum: number,
  maximum: number
): number => {
  const value = rawValue === undefined || rawValue.trim() === '' ? defaultValue : Number(rawValue)
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new Error(`${key} 必须是 ${minimum}-${maximum} 的整数`)
  }
  return value
}

export const readMysqlConfig = (env: Environment = process.env): MysqlConfig => ({
  host: required(env, 'MYSQL_HOST'),
  port: integerInRange(env.MYSQL_PORT, 3306, 'MYSQL_PORT', 1, 65535),
  database: required(env, 'MYSQL_DATABASE'),
  user: required(env, 'MYSQL_APP_USER'),
  password: required(env, 'MYSQL_APP_PASSWORD'),
  connectionLimit: integerInRange(env.MYSQL_POOL_LIMIT, 10, 'MYSQL_POOL_LIMIT', 1, 30),
  connectTimeoutMs: integerInRange(
    env.MYSQL_CONNECT_TIMEOUT_MS,
    5000,
    'MYSQL_CONNECT_TIMEOUT_MS',
    100,
    60000
  ),
  queryTimeoutMs: integerInRange(
    env.MYSQL_QUERY_TIMEOUT_MS,
    5000,
    'MYSQL_QUERY_TIMEOUT_MS',
    100,
    60000
  ),
})

export const readMysqlMigratorConfig = (env: Environment = process.env): MysqlConfig => ({
  ...readMysqlConfig(env),
  user: required(env, 'MYSQL_MIGRATOR_USER'),
  password: required(env, 'MYSQL_MIGRATOR_PASSWORD'),
})

let pool: Pool | undefined
let poolConfig: MysqlConfig | undefined

export const getMysqlPool = (): Pool => {
  if (!pool) {
    poolConfig = readMysqlConfig()
    pool = createPool({
      host: poolConfig.host,
      port: poolConfig.port,
      database: poolConfig.database,
      user: poolConfig.user,
      password: poolConfig.password,
      charset: 'utf8mb4',
      timezone: 'Z',
      waitForConnections: true,
      connectionLimit: poolConfig.connectionLimit,
      maxIdle: poolConfig.connectionLimit,
      idleTimeout: 30000,
      queueLimit: poolConfig.connectionLimit * 2,
      connectTimeout: poolConfig.connectTimeoutMs,
      enableKeepAlive: true,
      keepAliveInitialDelay: 0,
    })
  }
  return pool
}

export const connectMysql = async (retries = 3, delayMs = 2000): Promise<void> => {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const connection = await getMysqlPool().getConnection()
      try {
        await connection.ping()
      } finally {
        connection.release()
      }
      return
    } catch (error) {
      if (attempt === retries) {
        throw new Error(`MySQL 连接失败（已重试 ${retries} 次）: ${(error as Error).message}`)
      }
      console.warn(`MySQL 连接失败，${delayMs / 1000}s 后重试 (${attempt}/${retries})...`)
      await new Promise((resolve) => setTimeout(resolve, delayMs))
    }
  }
}

export const checkMysqlHealth = async (): Promise<boolean> => {
  try {
    const config = poolConfig ?? readMysqlConfig()
    await getMysqlPool().query({ sql: 'SELECT 1 AS result', timeout: config.queryTimeoutMs })
    return true
  } catch {
    return false
  }
}

export const closeMysqlPool = async (): Promise<void> => {
  if (!pool) return
  await pool.end()
  pool = undefined
  poolConfig = undefined
}

// MySQL 死锁错误码
const ER_LOCK_DEADLOCK = 1213
const ER_LOCK_WAIT_TIMEOUT = 1205

/**
 * 带死锁重试的数据库操作包装器
 * 遇到死锁错误时自动重试，最多3次，指数退避
 */
export const withDeadlockRetry = async <T>(
  operation: () => Promise<T>,
  maxRetries = 3,
  baseDelayMs = 100
): Promise<T> => {
  let lastError: unknown
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation()
    } catch (error: unknown) {
      lastError = error
      const errno = (error as { errno?: number }).errno
      if (attempt < maxRetries && (errno === ER_LOCK_DEADLOCK || errno === ER_LOCK_WAIT_TIMEOUT)) {
        const delay = baseDelayMs * Math.pow(2, attempt) + Math.random() * 50
        console.warn(
          `数据库死锁/锁等待 (errno=${errno})，${delay.toFixed(0)}ms 后重试 (${attempt + 1}/${maxRetries})...`
        )
        await new Promise((resolve) => setTimeout(resolve, delay))
        continue
      }
      throw error
    }
  }
  throw lastError
}
