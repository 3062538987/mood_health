import sql from 'mssql'
import { pool, connectDB, isSqliteClient } from '../config/database'
import { getSqliteDb } from '../config/sqlite'

export const addIsReverseField = async () => {
  try {
    await connectDB()

    if (isSqliteClient) {
      const db = getSqliteDb()
      const columns = db.prepare('PRAGMA table_info(questions)').all() as Array<{ name: string }>
      if (!columns.some((column) => column.name === 'is_reverse')) {
        db.exec('ALTER TABLE questions ADD COLUMN is_reverse INTEGER NOT NULL DEFAULT 0;')
        console.log('✅ questions 表已添加 is_reverse 字段 (SQLite)')
      } else {
        console.log('✅ questions 表已存在 is_reverse 字段 (SQLite)')
      }
      console.log('✅ 字段添加完成')
      return
    }

    // 检查并添加 is_reverse 字段到 questions 表
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.columns 
                     WHERE object_id = OBJECT_ID('questions') 
                     AND name = 'is_reverse')
      BEGIN
        ALTER TABLE questions ADD is_reverse BIT DEFAULT 0;
        PRINT 'questions 表已添加 is_reverse 字段';
      END
      ELSE
      BEGIN
        PRINT 'questions 表已存在 is_reverse 字段';
      END
    `)

    console.log('✅ 字段添加完成')
  } catch (error) {
    console.error('❌ 字段添加失败:', error)
    throw error
  } finally {
    if (!isSqliteClient && pool.connected) {
      await pool.close()
    }
  }
}

// 直接运行
addIsReverseField()
  .then(() => {
    console.log('🎉 脚本执行完毕')
    process.exit(0)
  })
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
