import sql from 'mssql'
import dotenv from 'dotenv'
import logger from '../utils/logger'
import { DatabaseError } from '../utils/errors'
import { connectSqlite, sqliteAll } from './sqlite'

dotenv.config()

const dbClient = (process.env.DB_CLIENT || 'sqlserver').toLowerCase()
export const isSqliteClient = dbClient === 'sqlite'

// SQL Server 连接配置
const config: sql.config = {
  server: process.env.DB_SERVER || 'localhost',
  port: Number(process.env.DB_PORT) || 1433,
  database: process.env.DB_NAME || 'mood_health',
  authentication: {
    type: 'default',
    options: {
      userName: process.env.DB_USER || '',
      password: process.env.DB_PASSWORD || '',
    },
  },
  options: {
    encrypt: false,
    trustServerCertificate: true,
    enableArithAbort: true,
    useUTC: false,
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000,
  },
  connectionTimeout: 30000,
  requestTimeout: 30000,
}

// 创建连接池
export const pool = new sql.ConnectionPool(config)

// 连接数据库
export const connectDB = async () => {
  if (isSqliteClient) {
    try {
      connectSqlite()
      logger.info('✅ SQLite 数据库连接成功')
      return null
    } catch (error) {
      logger.error('❌ SQLite 数据库连接失败:', error)
      throw new DatabaseError('SQLite 数据库连接失败', error)
    }
  }

  try {
    await pool.connect()
    logger.info('✅ SQL Server 数据库连接成功')
    return pool
  } catch (error) {
    logger.error('❌ 数据库连接失败:', error)
    throw new DatabaseError('数据库连接失败', error)
  }
}

// 执行查询的辅助函数
export const query = async (sqlQuery: string, params?: any[]) => {
  if (isSqliteClient) {
    try {
      return sqliteAll(sqlQuery, params || [])
    } catch (error) {
      logger.error('SQLite 查询执行失败:', error)
      throw new DatabaseError('SQLite 查询执行失败', error)
    }
  }

  try {
    const request = pool.request()

    // 如果有参数，添加到请求中
    if (params) {
      params.forEach((param, index) => {
        request.input(`param${index}`, param)
      })
    }

    const result = await request.query(sqlQuery)
    return result.recordset
  } catch (error) {
    logger.error('查询执行失败:', error)
    throw new DatabaseError('查询执行失败', error)
  }
}

export default pool
