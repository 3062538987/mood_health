import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

export interface MigrationDatabase {
  query<T = unknown>(sql: string, params?: unknown[]): Promise<T[]>
}

export interface MigrationFile {
  version: string
  name: string
  checksum: string
  upPath: string
  downPath: string
  upSql: string
  downSql: string
}

export interface AppliedMigration {
  version: string
  name: string
  checksum: string
}

export interface RunMigrationsOptions {
  db: MigrationDatabase
  migrationsDir: string
  lockName?: string
  lockTimeoutSeconds?: number
  now?: () => Date
}

export interface RunMigrationsResult {
  applied: AppliedMigration[]
  skipped: AppliedMigration[]
}

export interface RollbackMigrationsResult {
  rolledBack: AppliedMigration[]
}

const MIGRATION_FILE_PATTERN = /^(\d{4})_([a-z0-9_]+)\.(up|down)\.sql$/
const DEFAULT_LOCK_NAME = 'mood_health_schema_migrations'

const sha256 = (value: string): string => crypto.createHash('sha256').update(value, 'utf8').digest('hex')

const sanitizeError = (error: unknown): string => {
  const message = error instanceof Error ? error.message : String(error)
  return message
    .replace(/password\s*=\s*[^;\s]+/gi, 'password=[redacted]')
    .replace(/(MYSQL_[A-Z_]*PASSWORD=)[^;\s]+/g, '$1[redacted]')
}

const splitStatements = (sql: string): string[] =>
  sql
    .split(/\r?\n/)
    .filter((line) => !line.trim().startsWith('--'))
    .join('\n')
    .split(';')
    .map((statement) => statement.trim())
    .filter(Boolean)

export const loadMigrationFiles = (migrationsDir: string): MigrationFile[] => {
  const entries = new Map<string, { version: string; name: string; upPath?: string; downPath?: string }>()

  for (const fileName of fs.readdirSync(migrationsDir)) {
    const match = MIGRATION_FILE_PATTERN.exec(fileName)
    if (!match) continue

    const [, version, name, direction] = match
    const key = `${version}_${name}`
    const entry = entries.get(key) ?? { version, name }
    if (direction === 'up') entry.upPath = path.join(migrationsDir, fileName)
    if (direction === 'down') entry.downPath = path.join(migrationsDir, fileName)
    entries.set(key, entry)
  }

  const seenVersions = new Set<string>()
  return [...entries.values()]
    .sort((left, right) => left.version.localeCompare(right.version))
    .map((entry) => {
      if (!entry.upPath || !entry.downPath) {
        throw new Error(`Migration ${entry.version}_${entry.name} must have both up and down files`)
      }
      if (seenVersions.has(entry.version)) {
        throw new Error(`Duplicate migration version: ${entry.version}`)
      }
      seenVersions.add(entry.version)

      const upSql = fs.readFileSync(entry.upPath, 'utf8')
      const downSql = fs.readFileSync(entry.downPath, 'utf8')
      return {
        version: entry.version,
        name: entry.name,
        checksum: sha256(upSql),
        upPath: entry.upPath,
        downPath: entry.downPath,
        upSql,
        downSql,
      }
    })
}

const acquireLock = async (
  db: MigrationDatabase,
  lockName: string,
  lockTimeoutSeconds: number
): Promise<void> => {
  const rows = await db.query<{ acquired: number }>('SELECT GET_LOCK(?, ?) AS acquired', [
    lockName,
    lockTimeoutSeconds,
  ])
  if (rows[0]?.acquired !== 1) {
    throw new Error(`Could not acquire migration lock: ${lockName}`)
  }
}

const releaseLock = async (db: MigrationDatabase, lockName: string): Promise<void> => {
  await db.query('SELECT RELEASE_LOCK(?) AS released', [lockName])
}

const readAppliedMigrations = async (db: MigrationDatabase): Promise<Map<string, AppliedMigration>> => {
  const rows = await db.query<AppliedMigration>(
    'SELECT version, name, checksum FROM schema_migrations ORDER BY version ASC'
  )
  return new Map(rows.map((row) => [row.version, row]))
}

const assertAppliedChecksums = (
  migrations: MigrationFile[],
  appliedByVersion: Map<string, AppliedMigration>
): void => {
  for (const migration of migrations) {
    const applied = appliedByVersion.get(migration.version)
    if (applied && applied.checksum !== migration.checksum) {
      throw new Error(`Migration checksum mismatch: ${migration.version}_${migration.name}`)
    }
  }
}

const executeMigration = async (db: MigrationDatabase, migration: MigrationFile): Promise<void> => {
  const statements = splitStatements(migration.upSql)
  for (const [index, statement] of statements.entries()) {
    try {
      await db.query(statement)
    } catch (error) {
      throw new Error(
        `Migration ${migration.version}_${migration.name} failed at statement ${index + 1}: ${sanitizeError(error)}`
      )
    }
  }
}

const executeRollback = async (db: MigrationDatabase, migration: MigrationFile): Promise<void> => {
  const statements = splitStatements(migration.downSql)
  for (const [index, statement] of statements.entries()) {
    try {
      await db.query(statement)
    } catch (error) {
      throw new Error(
        `Rollback ${migration.version}_${migration.name} failed at statement ${index + 1}: ${sanitizeError(error)}`
      )
    }
  }
}

export const runMigrations = async (options: RunMigrationsOptions): Promise<RunMigrationsResult> => {
  const lockName = options.lockName ?? DEFAULT_LOCK_NAME
  const lockTimeoutSeconds = options.lockTimeoutSeconds ?? 10
  const now = options.now ?? (() => new Date())
  const migrations = loadMigrationFiles(options.migrationsDir)

  await acquireLock(options.db, lockName, lockTimeoutSeconds)
  try {
    const appliedByVersion = await readAppliedMigrations(options.db)
    assertAppliedChecksums(migrations, appliedByVersion)

    const applied: AppliedMigration[] = []
    const skipped: AppliedMigration[] = []

    for (const migration of migrations) {
      const existing = appliedByVersion.get(migration.version)
      if (existing) {
        skipped.push(existing)
        continue
      }

      const startMs = Date.now()
      await executeMigration(options.db, migration)
      const executionMs = Math.max(Date.now() - startMs, 0)
      await options.db.query(
        'INSERT INTO schema_migrations (version, name, checksum, execution_ms, applied_at) VALUES (?, ?, ?, ?, ?)',
        [migration.version, migration.name, migration.checksum, executionMs, now()]
      )
      applied.push({ version: migration.version, name: migration.name, checksum: migration.checksum })
    }

    return { applied, skipped }
  } finally {
    await releaseLock(options.db, lockName)
  }
}

export const rollbackMigrations = async (
  options: RunMigrationsOptions
): Promise<RollbackMigrationsResult> => {
  const lockName = options.lockName ?? DEFAULT_LOCK_NAME
  const lockTimeoutSeconds = options.lockTimeoutSeconds ?? 10
  const migrations = loadMigrationFiles(options.migrationsDir)

  await acquireLock(options.db, lockName, lockTimeoutSeconds)
  try {
    const appliedByVersion = await readAppliedMigrations(options.db)
    assertAppliedChecksums(migrations, appliedByVersion)

    const rolledBack: AppliedMigration[] = []
    for (const migration of [...migrations].reverse()) {
      const applied = appliedByVersion.get(migration.version)
      if (!applied) continue

      await executeRollback(options.db, migration)
      await options.db.query('DELETE FROM schema_migrations WHERE version = ?', [migration.version])
      rolledBack.push(applied)
    }

    return { rolledBack }
  } finally {
    await releaseLock(options.db, lockName)
  }
}
