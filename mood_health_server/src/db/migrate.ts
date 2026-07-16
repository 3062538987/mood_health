import dotenv from 'dotenv'
import fs from 'node:fs'
import path from 'node:path'
import { createPool, Pool } from 'mysql2/promise'

import { readMysqlMigratorConfig } from '../config/mysql'
import { MigrationDatabase, loadMigrationFiles, rollbackMigrations, runMigrations } from './migrationRunner'

dotenv.config()

class MysqlMigrationDatabase implements MigrationDatabase {
  constructor(private readonly pool: Pool) {}

  async query<T = unknown>(sql: string, params: unknown[] = []): Promise<T[]> {
    const [rows] = await this.pool.query(sql, params)
    return Array.isArray(rows) ? (rows as T[]) : []
  }
}

const bootstrapPath = path.resolve(__dirname, 'bootstrap/schema_migrations.sql')
const migrationsDir = path.resolve(__dirname, 'migrations')

const createMigrationPool = (): Pool => {
  const config = readMysqlMigratorConfig()
  return createPool({
    host: config.host,
    port: config.port,
    database: config.database,
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
  const sql = fs.readFileSync(bootstrapPath, 'utf8')
  await db.query(sql)
}

const printStatus = async (db: MigrationDatabase): Promise<void> => {
  const migrations = loadMigrationFiles(migrationsDir)
  const appliedRows = await db.query<{ version: string; name: string; checksum: string }>(
    'SELECT version, name, checksum FROM schema_migrations ORDER BY version ASC'
  )
  const appliedByVersion = new Map(appliedRows.map((row) => [row.version, row]))

  for (const migration of migrations) {
    const state = appliedByVersion.has(migration.version) ? 'applied' : 'pending'
    console.log(`${migration.version}_${migration.name}: ${state}`)
  }
}

const parseRollbackSteps = (args: string[]): number => {
  const stepIndex = args.findIndex((arg) => arg === '--step' || arg === '--steps')
  if (stepIndex === -1) return 1

  const rawValue = args[stepIndex + 1]
  const steps = Number(rawValue)
  if (!Number.isInteger(steps) || steps < 1) {
    throw new Error('Rollback --step must be a positive integer')
  }

  return steps
}

export const runMigrationCommand = async (command = process.argv[2] ?? 'up'): Promise<void> => {
  const pool = createMigrationPool()
  const db = new MysqlMigrationDatabase(pool)

  try {
    await bootstrapMigrationTable(db)

    if (command === 'up') {
      const result = await runMigrations({ db, migrationsDir })
      console.log(`Applied ${result.applied.length} migration(s), skipped ${result.skipped.length}.`)
      return
    }

    if (command === 'down') {
      const result = await rollbackMigrations({ db, migrationsDir, steps: parseRollbackSteps(process.argv.slice(3)) })
      console.log(`Rolled back ${result.rolledBack.length} migration(s).`)
      return
    }

    if (command === 'status') {
      await printStatus(db)
      return
    }

    throw new Error(`Unknown migration command: ${command}`)
  } finally {
    await pool.end()
  }
}

if (require.main === module) {
  runMigrationCommand().catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
}
