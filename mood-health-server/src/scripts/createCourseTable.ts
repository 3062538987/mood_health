import { query, connectDB } from "../config/database";

const createCourseTable = async () => {
  try {
    // 先连接数据库
    await connectDB();

    // 检查courses表是否存在，如果不存在则创建
    const createTableQuery = `
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[courses]') AND type in (N'U'))
      BEGIN
        CREATE TABLE [dbo].[courses] (
          id INT IDENTITY(1,1) PRIMARY KEY,
          title NVARCHAR(255) NOT NULL,
          description NVARCHAR(MAX) NOT NULL,
          coverUrl NVARCHAR(500) NOT NULL,
          content NVARCHAR(MAX) NOT NULL,
          category NVARCHAR(100) NOT NULL,
          studyCount INT DEFAULT 0,
          type NVARCHAR(20) CHECK (type IN ('video', 'article')) NOT NULL,
          createdAt DATETIME DEFAULT GETDATE(),
          updatedAt DATETIME DEFAULT GETDATE()
        )
      END
    `;

    await query(createTableQuery);
    console.log("✅ courses表创建成功");

    // 插入一些示例数据
    const insertSampleData = `
      INSERT INTO courses (title, description, coverUrl, content, category, type)
      VALUES 
      ('情绪管理基础', '学习如何识别和管理自己的情绪', 'https://neeko-copilot.bytedance.net/api/text2image?prompt=emotion%20management%20course%20cover&size=landscape_16_9', '情绪管理是一项重要的生活技能...', '情绪调节', 'article'),
      ('有效沟通技巧', '提升人际交往能力的实用技巧', 'https://neeko-copilot.bytedance.net/api/text2image?prompt=communication%20skills%20course%20cover&size=landscape_16_9', '有效沟通是建立良好关系的基础...', '人际交往', 'article'),
      ('压力管理策略', '学会如何应对和缓解压力', 'https://neeko-copilot.bytedance.net/api/text2image?prompt=stress%20management%20course%20cover&size=landscape_16_9', 'https://example.com/stress-management-video.mp4', '心理知识', 'video'),
      ('自信建立指南', '如何培养和提升自信心', 'https://neeko-copilot.bytedance.net/api/text2image?prompt=self%20confidence%20course%20cover&size=landscape_16_9', '自信是成功的关键因素...', '心理知识', 'article')
    `;

    await query(insertSampleData);
    console.log("✅ 课程示例数据插入成功");
  } catch (error) {
    console.error("❌ 创建courses表失败:", error);
  }
};

createCourseTable();
