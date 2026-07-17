import { createPool, Pool } from 'mysql2/promise'
import { readMysqlMigratorConfig } from '../../mood_health_server/src/config/mysql'
import { MigrationDatabase, runMigrations } from '../../mood_health_server/src/db/migrationRunner'
import { SeedDatabase, seedReferenceData } from '../../mood_health_server/src/db/seeds/coreSeed'
import { seedDemoData } from '../../mood_health_server/src/db/seeds/profileSeed'
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// 加载 mood_health_server 的 .env 文件以获取数据库连接配置
dotenv.config({ path: path.resolve(__dirname, '../../mood_health_server/.env') })

const E2E_DATABASE = process.env.MYSQL_DATABASE || 'mood_health_e2e'

class MysqlMigrationDatabase implements MigrationDatabase {
  constructor(private readonly pool: Pool) {}
  async query<T = unknown>(sql: string, params: unknown[] = []): Promise<T[]> {
    const [rows] = await this.pool.query(sql, params)
    return Array.isArray(rows) ? (rows as T[]) : []
  }
}

class MysqlSeedDatabase implements SeedDatabase {
  constructor(private readonly pool: Pool) {}
  async query<T = unknown>(sql: string, params: unknown[] = []): Promise<T[]> {
    const [rows] = await this.pool.query(sql, params)
    return Array.isArray(rows) ? (rows as T[]) : []
  }
}

const createRootPool = (): Pool => {
  const config = readMysqlMigratorConfig()
  return createPool({
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    charset: 'utf8mb4',
    timezone: 'Z',
    waitForConnections: true,
    connectionLimit: 1,
    maxIdle: 1,
    idleTimeout: 30000,
    queueLimit: 0,
    connectTimeout: config.connectTimeoutMs,
  })
}

const createE2ePool = (): Pool => {
  const config = readMysqlMigratorConfig()
  return createPool({
    host: config.host,
    port: config.port,
    database: E2E_DATABASE,
    user: config.user,
    password: config.password,
    charset: 'utf8mb4',
    timezone: 'Z',
    waitForConnections: true,
    connectionLimit: 1,
    maxIdle: 1,
    idleTimeout: 30000,
    queueLimit: 0,
    connectTimeout: config.connectTimeoutMs,
  })
}

const bootstrapMigrationTable = async (db: MigrationDatabase): Promise<void> => {
  const bootstrapPath = path.resolve(__dirname, '../../mood_health_server/src/db/bootstrap/schema_migrations.sql')
  const sql = fs.readFileSync(bootstrapPath, 'utf8')
  await db.query(sql)
}

const migrationsDir = path.resolve(__dirname, '../../mood_health_server/src/db/migrations')

async function globalSetup() {
  console.log('[E2E Setup] Ensuring E2E database exists...')
  const rootPool = createRootPool()
  try {
    await rootPool.query(`CREATE DATABASE IF NOT EXISTS \`${E2E_DATABASE}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`)
    console.log(`[E2E Setup] Database '${E2E_DATABASE}' ready.`)
  } catch (err: any) {
    // 如果 CREATE DATABASE 权限不足但数据库已存在，忽略错误继续
    if (err?.code === 'ER_DBACCESS_DENIED_ERROR' || err?.errno === 1044) {
      console.log(`[E2E Setup] Database '${E2E_DATABASE}' already exists (CREATE privilege not granted, continuing).`)
    } else {
      throw err
    }
  } finally {
    await rootPool.end()
  }

  const e2ePool = createE2ePool()
  const db = new MysqlMigrationDatabase(e2ePool)

  try {
    console.log('[E2E Setup] Running migrations...')
    await bootstrapMigrationTable(db)
    const result = await runMigrations({ db, migrationsDir })
    console.log(`[E2E Setup] Migrations: ${result.applied.length} applied, ${result.skipped.length} skipped.`)

    console.log('[E2E Setup] Seeding reference + demo data...')
    const seedDb = new MysqlSeedDatabase(e2ePool)
    const refResult = await seedReferenceData(seedDb)
    console.log(`[E2E Setup] Reference seed: roles=${refResult.roles}, permissions=${refResult.permissions}, emotionTypes=${refResult.emotionTypes}.`)
    const demoResult = await seedDemoData(seedDb)
    console.log(`[E2E Setup] Demo seed: accounts=${demoResult.accounts.join(',')}, moods=${demoResult.moods}.`)
  } finally {
    await e2ePool.end()
  }

  console.log('[E2E Setup] Global setup complete.')
}

export default globalSetup