import sql from 'mssql'
import { pool, connectDB, isSqliteClient } from '../config/database'
import { connectSqlite } from '../config/sqlite'

export const createMoodRelationTables = async () => {
  try {
    await connectDB()

    if (isSqliteClient) {
      connectSqlite()
      console.log('✅ SQLite 情绪关联表初始化完成')
      return
    }

    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='emotion_types' AND xtype='U')
      BEGIN
        CREATE TABLE emotion_types (
          id INT IDENTITY(1,1) PRIMARY KEY,
          name NVARCHAR(50) NOT NULL UNIQUE,
          icon NVARCHAR(10),
          category NVARCHAR(20),
          sort_order INT DEFAULT 0,
          created_at DATETIME DEFAULT GETDATE()
        );
        PRINT 'emotion_types 表创建成功';
      END
    `)

    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='tags' AND xtype='U')
      BEGIN
        CREATE TABLE tags (
          id INT IDENTITY(1,1) PRIMARY KEY,
          name NVARCHAR(50) NOT NULL,
          user_id INT NULL,
          is_system BIT DEFAULT 0,
          created_at DATETIME DEFAULT GETDATE(),
          CONSTRAINT UQ_Tags_Name_User UNIQUE (name, user_id)
        );
        PRINT 'tags 表创建成功';
      END
    `)

    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='mood_emotions' AND xtype='U')
      BEGIN
        CREATE TABLE mood_emotions (
          id INT IDENTITY(1,1) PRIMARY KEY,
          mood_id INT NOT NULL,
          emotion_type_id INT NOT NULL,
          intensity INT NOT NULL DEFAULT 5,
          created_at DATETIME DEFAULT GETDATE(),
          FOREIGN KEY (mood_id) REFERENCES moods(id) ON DELETE CASCADE,
          FOREIGN KEY (emotion_type_id) REFERENCES emotion_types(id) ON DELETE CASCADE,
          CONSTRAINT UQ_Mood_Emotion UNIQUE (mood_id, emotion_type_id)
        );
        PRINT 'mood_emotions 表创建成功';
      END
    `)

    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='mood_tags' AND xtype='U')
      BEGIN
        CREATE TABLE mood_tags (
          id INT IDENTITY(1,1) PRIMARY KEY,
          mood_id INT NOT NULL,
          tag_id INT NOT NULL,
          created_at DATETIME DEFAULT GETDATE(),
          FOREIGN KEY (mood_id) REFERENCES moods(id) ON DELETE CASCADE,
          FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE,
          CONSTRAINT UQ_Mood_Tag UNIQUE (mood_id, tag_id)
        );
        PRINT 'mood_tags 表创建成功';
      END
    `)

    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM emotion_types WHERE name = N'快乐')
      BEGIN
        INSERT INTO emotion_types (name, icon, category, sort_order) VALUES
          (N'快乐', '😊', N'positive', 1),
          (N'悲伤', '😢', N'negative', 2),
          (N'愤怒', '😠', N'negative', 3),
          (N'平静', '😌', N'neutral', 4),
          (N'焦虑', '😰', N'negative', 5),
          (N'兴奋', '🤩', N'positive', 6),
          (N'疲惫', '😴', N'neutral', 7),
          (N'恐惧', '😨', N'negative', 8);
        PRINT '情绪类型初始数据插入成功';
      END
    `)

    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM tags WHERE is_system = 1)
      BEGIN
        INSERT INTO tags (name, is_system) VALUES
          (N'工作', 1),
          (N'学习', 1),
          (N'家庭', 1),
          (N'社交', 1),
          (N'健康', 1),
          (N'财务', 1),
          (N'恋爱', 1),
          (N'其他', 1);
        PRINT '系统标签初始数据插入成功';
      END
    `)

    console.log('✅ 情绪关联表创建完成')
  } catch (error) {
    console.error('❌ 创建关联表失败:', error)
    throw error
  } finally {
    if (!isSqliteClient && pool.connected) {
      await pool.close()
    }
  }
}

createMoodRelationTables()
  .then(() => {
    console.log('🎉 迁移脚本执行完毕')
    process.exit(0)
  })
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
