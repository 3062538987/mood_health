import sql from "mssql";
import { pool, connectDB } from "../config/database";

export const addTriggerField = async () => {
  try {
    await connectDB();

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
    `);

    console.log("✅ 数据库字段添加完成");
  } catch (error) {
    console.error("❌ 数据库字段添加失败:", error);
    throw error;
  }
};

// 直接运行
addTriggerField()
  .then(() => {
    console.log("🎉 迁移脚本执行完毕");
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
