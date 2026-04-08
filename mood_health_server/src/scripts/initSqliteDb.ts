import { connectSqlite } from '../config/sqlite'

const initSqliteDb = () => {
  connectSqlite()
  console.log('SQLite schema initialized successfully')
}

initSqliteDb()
