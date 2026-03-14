import pool from "../config/database";
import sql from "mssql";

export const seedActivities = async () => {
  try {
    await pool.connect();
    console.log("✅ 数据库连接成功");

    const result = await pool.request().query(`
      IF EXISTS (SELECT 1 FROM activities)
      BEGIN
        SELECT COUNT(*) as count FROM activities
      END
      ELSE
      BEGIN
        SELECT 0 as count
      END
    `);

    const count = result.recordset[0].count;
    if (count > 0) {
      console.log(`⚠️  activities 表中已有 ${count} 条数据，跳过插入`);
      return;
    }

    await pool.request().query(`
      INSERT INTO activities (title, description, start_time, end_time, max_participants, location, image_url)
      VALUES
        ('团体心理辅导', '一起探讨情绪管理，分享彼此的心得与体验', '2025-04-01 14:00:00', '2025-04-01 16:00:00', 20, '心理中心105', NULL),
        ('户外放松活动', '校园徒步，感受自然，放松身心', '2025-04-03 09:00:00', '2025-04-03 12:00:00', 15, '学校操场', NULL),
        ('冥想工作坊', '学习正念冥想，缓解压力和焦虑', '2025-04-05 19:00:00', '2025-04-05 20:30:00', 25, '活动中心201', NULL),
        ('艺术疗愈课程', '通过绘画和音乐表达情绪', '2025-04-08 14:00:00', '2025-04-08 16:00:00', 18, '艺术楼305', NULL),
        ('心理健康讲座', '专家分享心理健康知识', '2025-04-10 15:00:00', '2025-04-10 17:00:00', 50, '大礼堂', NULL)
    `);

    console.log("✅ 成功插入 5 条活动数据");
  } catch (error) {
    console.error("❌ 种子数据插入失败:", error);
    throw error;
  } finally {
    await pool.close();
  }
};

seedActivities()
  .then(() => {
    console.log("🎉 种子脚本执行完毕");
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
