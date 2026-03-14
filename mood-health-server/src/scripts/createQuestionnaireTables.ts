import pool from "../config/database";

const createQuestionnaireTables = async () => {
  try {
    // 连接数据库
    await pool.connect();
    console.log("✅ 数据库连接成功");

    // 创建 questionnaires 表
    await pool.request().query(`
      CREATE TABLE IF NOT EXISTS questionnaires (
        id INT IDENTITY(1,1) PRIMARY KEY,
        title NVARCHAR(100) NOT NULL,
        description NVARCHAR(500),
        created_at DATETIME DEFAULT GETDATE()
      )
    `);
    console.log("✅ questionnaires 表创建成功");

    // 创建 questions 表
    await pool.request().query(`
      CREATE TABLE IF NOT EXISTS questions (
        id INT IDENTITY(1,1) PRIMARY KEY,
        questionnaire_id INT NOT NULL,
        question_text NVARCHAR(500) NOT NULL,
        question_type NVARCHAR(20), -- 'single', 'multiple', 'text'
        options NVARCHAR(MAX),       -- JSON 格式存储选项，例如 ["选项1","选项2"]
        sort_order INT,
        FOREIGN KEY (questionnaire_id) REFERENCES questionnaires(id) ON DELETE CASCADE
      )
    `);
    console.log("✅ questions 表创建成功");

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
    `);
    console.log("✅ user_answers 表创建成功");

    console.log("🎉 问卷模块表结构创建完成");
  } catch (error) {
    console.error("❌ 创建表失败:", error);
  } finally {
    // 关闭连接
    await pool.close();
  }
};

createQuestionnaireTables();