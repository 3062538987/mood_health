import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { rollbackMigrations, runMigrations, MigrationDatabase } from '../../../src/db/migrationRunner'

class FakeMigrationDatabase implements MigrationDatabase {
  public readonly executedSql: string[] = []
  public readonly recorded: Array<{ version: string; name: string; checksum: string }> = []
  public appliedRows: Array<{ version: string; name: string; checksum: string }> = []
  public failOnSql?: string

  async query<T = unknown>(sql: string, params: unknown[] = []): Promise<T[]> {
    this.executedSql.push(sql)

    if (sql.includes('GET_LOCK')) {
      return [{ acquired: 1 }] as T[]
    }

    if (sql.includes('RELEASE_LOCK')) {
      return [{ released: 1 }] as T[]
    }

    if (sql.includes('INSERT INTO schema_migrations')) {
      const [version, name, checksum] = params as string[]
      this.recorded.push({ version, name, checksum })
      this.appliedRows.push({ version, name, checksum })
      return [] as T[]
    }

    if (sql.includes('DELETE FROM schema_migrations')) {
      const [version] = params as string[]
      this.appliedRows = this.appliedRows.filter((row) => row.version !== version)
      return [] as T[]
    }

    if (sql.includes('FROM schema_migrations')) {
      return this.appliedRows as T[]
    }

    if (this.failOnSql && sql.includes(this.failOnSql)) {
      throw new Error('raw mysql failure mentioning password=secret')
    }

    return [] as T[]
  }
}

const makeMigrationDir = (): string => fs.mkdtempSync(path.join(os.tmpdir(), 'migrations-'))

const writeMigration = (dir: string, version: string, name: string, upSql: string): void => {
  fs.writeFileSync(path.join(dir, `${version}_${name}.up.sql`), upSql)
  fs.writeFileSync(path.join(dir, `${version}_${name}.down.sql`), `DROP TABLE ${name};`)
}

describe('migration runner', () => {
  it('applies pending migrations once in version order and records checksums', async () => {
    const dir = makeMigrationDir()
    writeMigration(dir, '0020', 'create_permissions', 'CREATE TABLE permissions (id INT);')
    writeMigration(dir, '0010', 'create_roles', 'CREATE TABLE roles (id INT);')
    const db = new FakeMigrationDatabase()

    const result = await runMigrations({ db, migrationsDir: dir })

    expect(result.applied.map((item) => item.version)).toEqual(['0010', '0020'])
    expect(db.recorded).toHaveLength(2)
    expect(db.recorded[0].checksum).toMatch(/^[a-f0-9]{64}$/)
    expect(db.executedSql.join('\n')).toContain('GET_LOCK')
    expect(db.executedSql.join('\n')).toContain('RELEASE_LOCK')

    const repeated = await runMigrations({ db, migrationsDir: dir })

    expect(repeated.applied).toEqual([])
    expect(db.recorded).toHaveLength(2)
  })

  it('fails when an applied migration checksum changes', async () => {
    const dir = makeMigrationDir()
    writeMigration(dir, '0010', 'create_roles', 'CREATE TABLE roles (id INT);')
    const db = new FakeMigrationDatabase()
    await runMigrations({ db, migrationsDir: dir })
    fs.writeFileSync(path.join(dir, '0010_create_roles.up.sql'), 'CREATE TABLE roles (id INT, code VARCHAR(32));')

    await expect(runMigrations({ db, migrationsDir: dir })).rejects.toThrow(
      'Migration checksum mismatch: 0010_create_roles'
    )
  })

  it('rejects migrations without matching up and down files', async () => {
    const dir = makeMigrationDir()
    fs.writeFileSync(path.join(dir, '0010_create_roles.up.sql'), 'CREATE TABLE roles (id INT);')

    await expect(runMigrations({ db: new FakeMigrationDatabase(), migrationsDir: dir })).rejects.toThrow(
      'Migration 0010_create_roles must have both up and down files'
    )
  })

  it('stops at the failing version and sanitizes raw database errors', async () => {
    const dir = makeMigrationDir()
    writeMigration(dir, '0010', 'create_roles', 'CREATE TABLE roles (id INT);')
    writeMigration(dir, '0020', 'create_permissions', 'CREATE TABLE permissions (id INT);')
    const db = new FakeMigrationDatabase()
    db.failOnSql = 'permissions'

    await expect(runMigrations({ db, migrationsDir: dir })).rejects.toThrow(
      'Migration 0020_create_permissions failed at statement 1: raw mysql failure mentioning password=[redacted]'
    )

    expect(db.recorded.map((item) => item.version)).toEqual(['0010'])
  })

  it('rolls back one applied migration by default', async () => {
    const dir = makeMigrationDir()
    writeMigration(dir, '0010', 'create_roles', 'CREATE TABLE roles (id INT);')
    writeMigration(dir, '0020', 'create_permissions', 'CREATE TABLE permissions (id INT);')
    const db = new FakeMigrationDatabase()
    await runMigrations({ db, migrationsDir: dir })

    const result = await rollbackMigrations({ db, migrationsDir: dir })

    expect(result.rolledBack.map((item) => item.version)).toEqual(['0020'])
    expect(db.appliedRows.map((item) => item.version)).toEqual(['0010'])
    expect(db.executedSql).toContain('DROP TABLE create_permissions')
    expect(db.executedSql).not.toContain('DROP TABLE create_roles')
  })

  it('rolls back the requested number of applied migrations in reverse version order', async () => {
    const dir = makeMigrationDir()
    writeMigration(dir, '0010', 'create_roles', 'CREATE TABLE roles (id INT);')
    writeMigration(dir, '0020', 'create_permissions', 'CREATE TABLE permissions (id INT);')
    const db = new FakeMigrationDatabase()
    await runMigrations({ db, migrationsDir: dir })

    const result = await rollbackMigrations({ db, migrationsDir: dir, steps: 2 })

    expect(result.rolledBack.map((item) => item.version)).toEqual(['0020', '0010'])
    expect(db.appliedRows).toEqual([])
    expect(db.executedSql).toContain('DROP TABLE create_permissions')
    expect(db.executedSql).toContain('DROP TABLE create_roles')
  })
})
