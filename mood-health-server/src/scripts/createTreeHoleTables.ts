import pool from "../config/database";

const createTreeHoleTables = async () => {
  try {
    // 连接数据库
    await pool.connect();
    console.log("✅ 数据库连接成功");

    // 创建 posts 表
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='posts' AND xtype='U')
      BEGIN
        CREATE TABLE posts (
          id INT IDENTITY(1,1) PRIMARY KEY,
          content NVARCHAR(1000) NOT NULL,
          user_id INT NULL,
          like_count INT DEFAULT 0,
          created_at DATETIME DEFAULT GETDATE(),
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
        )
      END
    `);
    console.log("✅ posts 表创建成功");

    // 创建 comments 表
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='comments' AND xtype='U')
      BEGIN
        CREATE TABLE comments (
          id INT IDENTITY(1,1) PRIMARY KEY,
          post_id INT NOT NULL,
          user_id INT NULL,
          content NVARCHAR(500) NOT NULL,
          created_at DATETIME DEFAULT GETDATE(),
          FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
        )
      END
    `);
    console.log("✅ comments 表创建成功");

    console.log("🎉 树洞模块表结构创建完成");
  } catch (error) {
    console.error("❌ 创建表失败:", error);
  } finally {
    // 关闭连接
    await pool.close();
  }
};

createTreeHoleTables();
