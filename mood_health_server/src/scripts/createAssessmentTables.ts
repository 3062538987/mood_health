import sql from 'mssql'
import { pool, connectDB, isSqliteClient } from '../config/database'
import { getSqliteDb } from '../config/sqlite'

export const createAssessmentTables = async () => {
  try {
    await connectDB()

    if (isSqliteClient) {
      const db = getSqliteDb()
      const questionnaireColumns = db.prepare('PRAGMA table_info(questionnaires)').all() as Array<{
        name: string
      }>

      if (!questionnaireColumns.some((column) => column.name === 'type')) {
        db.exec('ALTER TABLE questionnaires ADD COLUMN type TEXT;')
        console.log('✅ questionnaires 表已添加 type 字段 (SQLite)')
      } else {
        console.log('✅ questionnaires 表已存在 type 字段 (SQLite)')
      }

      db.exec(`
        CREATE TABLE IF NOT EXISTS user_assessments (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          questionnaire_id INTEGER NOT NULL,
          score INTEGER NOT NULL,
          result_text TEXT,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
          FOREIGN KEY (questionnaire_id) REFERENCES questionnaires(id) ON DELETE CASCADE
        );
      `)

      console.log('✅ user_assessments 表创建成功 (SQLite)')
      console.log('✅ 测评表结构更新完成')
      return
    }

    // 修改 questionnaires 表，添加 type 字段
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.columns 
                     WHERE object_id = OBJECT_ID('questionnaires') 
                     AND name = 'type')
      BEGIN
        ALTER TABLE questionnaires ADD type NVARCHAR(50) NULL;
        PRINT 'questionnaires 表已添加 type 字段';
      END
      ELSE
      BEGIN
        PRINT 'questionnaires 表已存在 type 字段';
      END
    `)

    // 创建 user_assessments 表（如果不存在）
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='user_assessments' AND xtype='U')
      BEGIN
        CREATE TABLE user_assessments (
          id INT IDENTITY(1,1) PRIMARY KEY,
          user_id INT NOT NULL,
          questionnaire_id INT NOT NULL,
          score INT NOT NULL,
          result_text NVARCHAR(MAX) NULL,
          created_at DATETIME DEFAULT GETDATE(),
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
          FOREIGN KEY (questionnaire_id) REFERENCES questionnaires(id) ON DELETE CASCADE
        );
        PRINT 'user_assessments 表创建成功';
      END
      ELSE
      BEGIN
        PRINT 'user_assessments 表已存在';
      END
    `)

    console.log('✅ 测评表结构更新完成')
  } catch (error) {
    console.error('❌ 测评表结构更新失败:', error)
    throw error
  } finally {
    if (!isSqliteClient && pool.connected) {
      await pool.close()
    }
  }
}

// 直接运行
createAssessmentTables()
  .then(() => {
    console.log('🎉 脚本执行完毕')
    process.exit(0)
  })
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
