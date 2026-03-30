import { connectDB, isSqliteClient, pool } from '../config/database'
import { getSqliteDb } from '../config/sqlite'

const createQuestionnaireTables = async () => {
  try {
    await connectDB()
    console.log('✅ 数据库连接成功')

    if (isSqliteClient) {
      const db = getSqliteDb()
      db.exec(`
        CREATE TABLE IF NOT EXISTS questionnaires (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          title TEXT NOT NULL,
          description TEXT,
          type TEXT,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS questions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          questionnaire_id INTEGER NOT NULL,
          question_text TEXT NOT NULL,
          question_type TEXT,
          options TEXT,
          sort_order INTEGER,
          is_reverse INTEGER NOT NULL DEFAULT 0,
          FOREIGN KEY (questionnaire_id) REFERENCES questionnaires(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS user_answers (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          questionnaire_id INTEGER NOT NULL,
          question_id INTEGER NOT NULL,
          answer TEXT,
          submitted_at TEXT DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
          FOREIGN KEY (questionnaire_id) REFERENCES questionnaires(id) ON DELETE CASCADE,
          FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE
        );
      `)

      console.log('✅ questionnaires / questions / user_answers 表创建成功 (SQLite)')
      console.log('🎉 问卷模块表结构创建完成')
      return
    }

    // 创建 questionnaires 表
    await pool.request().query(`
      CREATE TABLE IF NOT EXISTS questionnaires (
        id INT IDENTITY(1,1) PRIMARY KEY,
        title NVARCHAR(100) NOT NULL,
        description NVARCHAR(500),
        type NVARCHAR(50),
        created_at DATETIME DEFAULT GETDATE()
      )
    `)
    console.log('✅ questionnaires 表创建成功')

    // 创建 questions 表
    await pool.request().query(`
      CREATE TABLE IF NOT EXISTS questions (
        id INT IDENTITY(1,1) PRIMARY KEY,
        questionnaire_id INT NOT NULL,
        question_text NVARCHAR(500) NOT NULL,
        question_type NVARCHAR(20), -- 'single', 'multiple', 'text'
        options NVARCHAR(MAX),       -- JSON 格式存储选项，例如 ["选项1","选项2"]
        sort_order INT,
        is_reverse BIT NOT NULL DEFAULT 0,
        FOREIGN KEY (questionnaire_id) REFERENCES questionnaires(id) ON DELETE CASCADE
      )
    `)
    console.log('✅ questions 表创建成功')

    // 创建 user_answers 表
    await pool.request().query(`
      CREATE TABLE IF NOT EXISTS user_answers (
        id INT IDENTITY(1,1) PRIMARY KEY,
        user_id INT NOT NULL,
        questionnaire_id INT NOT NULL,
        question_id INT NOT NULL,
        answer NVARCHAR(MAX),        -- 用户回答内容，多选可存JSON
        submitted_at DATETIME DEFAULT GETDATE(),
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (questionnaire_id) REFERENCES questionnaires(id),
        FOREIGN KEY (question_id) REFERENCES questions(id)
      )
    `)
    console.log('✅ user_answers 表创建成功')

    console.log('🎉 问卷模块表结构创建完成')
  } catch (error) {
    console.error('❌ 创建表失败:', error)
  } finally {
    if (!isSqliteClient && pool.connected) {
      await pool.close()
    }
  }
}

createQuestionnaireTables()
