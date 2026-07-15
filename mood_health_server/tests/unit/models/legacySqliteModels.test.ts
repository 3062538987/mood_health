import fs from 'node:fs'
import path from 'node:path'

const readModel = (name: string) =>
  fs.readFileSync(path.resolve(__dirname, `../../../src/models/${name}`), 'utf8')

const expectSqliteOnlyLegacyModel = (source: string) => {
  expect(source).not.toContain("from 'mssql'")
  expect(source).not.toContain("from '../config/database'")
  expect(source).not.toContain('isSqliteClient')
  expect(source).not.toContain('.request()')
}

describe('disabled legacy models', () => {
  it('keeps activity storage SQLite-only until its P1/P2 migration', () => {
    expectSqliteOnlyLegacyModel(readModel('activityModel.ts'))
  })
})
