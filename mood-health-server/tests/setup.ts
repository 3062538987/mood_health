import { ConnectionPool } from "mssql";
import pool from "../src/config/database";

declare global {
  var __TEST_DB__: ConnectionPool;
}

let testPool: ConnectionPool;

beforeAll(async () => {
  testPool = pool;
  global.__TEST_DB__ = testPool;
});

afterAll(async () => {
  if (testPool) {
    await testPool.close();
  }
});

beforeEach(async () => {
  if (testPool) {
    await testPool.request().query(`
      DELETE FROM mood_emotions;
      DELETE FROM mood_tags;
      DELETE FROM moods;
    `);
  }
});

export { testPool };
