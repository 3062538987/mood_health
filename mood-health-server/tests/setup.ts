import { ConnectionPool } from 'mssql'
import pool, { connectDB, isSqliteClient } from '../src/config/database'
import { sqliteRun } from '../src/config/sqlite'

declare global {
  var __TEST_DB__: ConnectionPool | null
}

let testPool: ConnectionPool | null = null

beforeAll(async () => {
  await connectDB()

  if (!isSqliteClient) {
    testPool = pool
  }

  global.__TEST_DB__ = testPool
})

afterAll(async () => {
  if (testPool) {
    await testPool.close()
    testPool = null
  }
})

beforeEach(async () => {
  if (isSqliteClient) {
    sqliteRun('DELETE FROM mood_emotions')
    sqliteRun('DELETE FROM mood_tags')
    sqliteRun('DELETE FROM moods')
    return
  }

  if (testPool) {
    await testPool.request().query(`
      DELETE FROM mood_emotions;
      DELETE FROM mood_tags;
      DELETE FROM moods;
    `)
  }
})

export { testPool }
