import dotenv from 'dotenv'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createPool, Pool } from 'mysql2/promise'
import { readMysqlMigratorConfig } from '../../mood_health_server/src/config/mysql'
import { readE2eDatabaseName } from '../../mood_health_server/src/db/e2eDatabaseBootstrap'
import { MigrationDatabase, runMigrations } from '../../mood_health_server/src/db/migrationRunner'
import { SeedDatabase, seedReferenceData } from '../../mood_health_server/src/db/seeds/coreSeed'
import { seedDemoData } from '../../mood_health_server/src/db/seeds/profileSeed'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

dotenv.config({ path: path.resolve(__dirname, '../../mood_health_server/.env') })

const E2E_DATABASE = readE2eDatabaseName()

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
  const bootstrapPath = path.resolve(
    __dirname,
    '../../mood_health_server/src/db/bootstrap/schema_migrations.sql'
  )
  await db.query(fs.readFileSync(bootstrapPath, 'utf8'))
}

const migrationsDir = path.resolve(__dirname, '../../mood_health_server/src/db/migrations')

async function globalSetup() {
  console.log(`[E2E Setup] Preparing isolated database '${E2E_DATABASE}'...`)
  const e2ePool = createE2ePool()
  const db = new MysqlMigrationDatabase(e2ePool)
  try {
    console.log('[E2E Setup] Running migrations...')
    await bootstrapMigrationTable(db)
    const result = await runMigrations({ db, migrationsDir })
    console.log(
      `[E2E Setup] Migrations: ${result.applied.length} applied, ${result.skipped.length} skipped.`
    )

    console.log('[E2E Setup] Seeding reference and demo data...')
    const seedDb = new MysqlSeedDatabase(e2ePool)
    const refResult = await seedReferenceData(seedDb)
    console.log(
      `[E2E Setup] Reference seed: roles=${refResult.roles}, permissions=${refResult.permissions}, emotionTypes=${refResult.emotionTypes}.`
    )
    const demoResult = await seedDemoData(seedDb)
    console.log(
      `[E2E Setup] Demo seed: accounts=${demoResult.accounts.join(',')}, moods=${demoResult.moods}.`
    )
  } finally {
    await e2ePool.end()
  }

  console.log('[E2E Setup] Global setup complete.')
}

export default globalSetup
