import sql from "mssql";
import { pool, connectDB } from "../config/database";

export const initDatabase = async () => {
  try {
    await connectDB();

    // 创建 users 表
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='users' AND xtype='U')
      BEGIN
        CREATE TABLE users (
          id INT IDENTITY(1,1) PRIMARY KEY,
          username NVARCHAR(50) NOT NULL UNIQUE,
          password NVARCHAR(255) NOT NULL,
          email NVARCHAR(100) NOT NULL UNIQUE,
          avatar NVARCHAR(255) NULL,
          role NVARCHAR(20) DEFAULT 'user',
          created_at DATETIME DEFAULT GETDATE(),
          updated_at DATETIME DEFAULT GETDATE()
        );
        PRINT 'users 表创建成功';
      END
      ELSE
      BEGIN
        -- 检查并添加 role 字段
        IF NOT EXISTS (SELECT * FROM sys.columns 
                       WHERE object_id = OBJECT_ID('users') 
                       AND name = 'role')
        BEGIN
          ALTER TABLE users ADD role NVARCHAR(20) DEFAULT 'user';
          PRINT 'users 表已添加 role 字段';
        END
        PRINT 'users 表已存在';
      END
    `);

    // 创建 moods 表（如果不存在）
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='moods' AND xtype='U')
      BEGIN
        CREATE TABLE moods (
          id INT IDENTITY(1,1) PRIMARY KEY,
          user_id INT NOT NULL,
          mood_type NVARCHAR(50) NOT NULL,
          mood_score INT NOT NULL CHECK (mood_score BETWEEN 1 AND 10),
          content NVARCHAR(MAX) NULL,
          tags NVARCHAR(255) NULL,
          created_at DATETIME DEFAULT GETDATE(),
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );
        PRINT 'moods 表创建成功';
      END
      ELSE
      BEGIN
        PRINT 'moods 表已存在';
      END
    `);

    // 创建 activities 表（如果不存在）
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='activities' AND xtype='U')
      BEGIN
        CREATE TABLE activities (
          id INT IDENTITY(1,1) PRIMARY KEY,
          title NVARCHAR(100) NOT NULL,
          description NVARCHAR(MAX),
          start_time DATETIME NOT NULL,
          end_time DATETIME NOT NULL,
          max_participants INT DEFAULT 20,
          current_participants INT DEFAULT 0,
          location NVARCHAR(255),
          image_url NVARCHAR(255),
          created_at DATETIME DEFAULT GETDATE(),
          updated_at DATETIME DEFAULT GETDATE()
        );
        PRINT 'activities 表创建成功';
      END
      ELSE
      BEGIN
        PRINT 'activities 表已存在';
      END
    `);

    // 创建 activity_participants 表（如果不存在）
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='activity_participants' AND xtype='U')
      BEGIN
        CREATE TABLE activity_participants (
          id INT IDENTITY(1,1) PRIMARY KEY,
          activity_id INT NOT NULL,
          user_id INT NOT NULL,
          join_time DATETIME DEFAULT GETDATE(),
          FOREIGN KEY (activity_id) REFERENCES activities(id) ON DELETE CASCADE,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
          CONSTRAINT unique_activity_user UNIQUE (activity_id, user_id)
        );
        PRINT 'activity_participants 表创建成功';
      END
      ELSE
      BEGIN
        PRINT 'activity_participants 表已存在';
      END
    `);

    // 创建 questionnaires 表（如果不存在）
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='questionnaires' AND xtype='U')
      BEGIN
        CREATE TABLE questionnaires (
          id INT IDENTITY(1,1) PRIMARY KEY,
          title NVARCHAR(100) NOT NULL,
          description NVARCHAR(500),
          created_at DATETIME DEFAULT GETDATE()
        );
        PRINT 'questionnaires 表创建成功';
      END
      ELSE
      BEGIN
        PRINT 'questionnaires 表已存在';
      END
    `);

    // 创建 questions 表（如果不存在）
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='questions' AND xtype='U')
      BEGIN
        CREATE TABLE questions (
          id INT IDENTITY(1,1) PRIMARY KEY,
          questionnaire_id INT NOT NULL,
          question_text NVARCHAR(500) NOT NULL,
          question_type NVARCHAR(20), -- 'single', 'multiple', 'text'
          options NVARCHAR(MAX),       -- JSON 格式存储选项，例如 ["选项1","选项2"]
          sort_order INT,
          FOREIGN KEY (questionnaire_id) REFERENCES questionnaires(id) ON DELETE CASCADE
        );
        PRINT 'questions 表创建成功';
      END
      ELSE
      BEGIN
        PRINT 'questions 表已存在';
      END
    `);

    // 创建 user_answers 表（如果不存在）
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='user_answers' AND xtype='U')
      BEGIN
        CREATE TABLE user_answers (
          id INT IDENTITY(1,1) PRIMARY KEY,
          user_id INT NOT NULL,
          questionnaire_id INT NOT NULL,
          question_id INT NOT NULL,
          answer NVARCHAR(MAX),        -- 用户回答内容，多选可存JSON
          submitted_at DATETIME DEFAULT GETDATE(),
          FOREIGN KEY (user_id) REFERENCES users(id),
          FOREIGN KEY (questionnaire_id) REFERENCES questionnaires(id),
          FOREIGN KEY (question_id) REFERENCES questions(id)
        );
        PRINT 'user_answers 表创建成功';
      END
      ELSE
      BEGIN
        PRINT 'user_answers 表已存在';
      END
    `);

    console.log("✅ 数据库初始化完成");
  } catch (error) {
    console.error("❌ 数据库初始化失败:", error);
    throw error;
  }
};

// 直接运行
initDatabase()
  .then(() => {
    console.log("🎉 初始化脚本执行完毕");
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
