import sql from "mssql";
import { pool, connectDB } from "../config/database";

export const addIsReverseField = async () => {
  try {
    await connectDB();

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
    `);

    console.log("✅ 字段添加完成");
  } catch (error) {
    console.error("❌ 字段添加失败:", error);
    throw error;
  }
};

// 直接运行
addIsReverseField()
  .then(() => {
    console.log("🎉 脚本执行完毕");
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
