import sql from 'mssql'
import { pool, connectDB, isSqliteClient } from '../config/database'
import { getSqliteDb } from '../config/sqlite'

export const addTriggerField = async () => {
  try {
    await connectDB()

    if (isSqliteClient) {
      const db = getSqliteDb()
      const columns = db.prepare('PRAGMA table_info(moods)').all() as Array<{ name: string }>

      if (!columns.some((column) => column.name === 'trigger')) {
        db.exec('ALTER TABLE moods ADD COLUMN trigger TEXT;')
        console.log('✅ moods 表已添加 trigger 字段 (SQLite)')
      } else {
        console.log('✅ moods 表已存在 trigger 字段 (SQLite)')
      }

      console.log('✅ 数据库字段添加完成')
      return
    }

    // 检查并添加 trigger 字段到 moods 表
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.columns 
                     WHERE object_id = OBJECT_ID('moods') 
                     AND name = 'trigger')
      BEGIN
        ALTER TABLE moods ADD trigger NVARCHAR(255) NULL;
        PRINT 'moods 表已添加 trigger 字段';
      END
      ELSE
      BEGIN
        PRINT 'moods 表已存在 trigger 字段';
      END
    `)

    console.log('✅ 数据库字段添加完成')
  } catch (error) {
    console.error('❌ 数据库字段添加失败:', error)
    throw error
  } finally {
    if (!isSqliteClient && pool.connected) {
      await pool.close()
    }
  }
}

// 直接运行
addTriggerField()
  .then(() => {
    console.log('🎉 迁移脚本执行完毕')
    process.exit(0)
  })
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
