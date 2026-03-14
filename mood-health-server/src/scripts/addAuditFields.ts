import pool from "../config/database";

const addAuditFieldsToPosts = async () => {
  try {
    await pool.connect();
    console.log("✅ 数据库连接成功");

    await pool.request().query(`
      IF NOT EXISTS (
        SELECT * FROM sys.columns 
        WHERE object_id = OBJECT_ID('posts') 
        AND name = 'status'
      )
      BEGIN
        ALTER TABLE posts
        ADD status INT DEFAULT 0
      END
    `);
    console.log("✅ posts 表添加 status 字段成功");

    await pool.request().query(`
      IF NOT EXISTS (
        SELECT * FROM sys.columns 
        WHERE object_id = OBJECT_ID('posts') 
        AND name = 'audit_remark'
      )
      BEGIN
        ALTER TABLE posts
        ADD audit_remark NVARCHAR(500) NULL
      END
    `);
    console.log("✅ posts 表添加 audit_remark 字段成功");

    await pool.request().query(`
      IF NOT EXISTS (
        SELECT * FROM sys.columns 
        WHERE object_id = OBJECT_ID('posts') 
        AND name = 'title'
      )
      BEGIN
        ALTER TABLE posts
        ADD title NVARCHAR(200) NOT NULL DEFAULT ''
      END
    `);
    console.log("✅ posts 表添加 title 字段成功");

    await pool.request().query(`
      IF NOT EXISTS (
        SELECT * FROM sys.columns 
        WHERE object_id = OBJECT_ID('posts') 
        AND name = 'is_anonymous'
      )
      BEGIN
        ALTER TABLE posts
        ADD is_anonymous BIT DEFAULT 0
      END
    `);
    console.log("✅ posts 表添加 is_anonymous 字段成功");

    await pool.request().query(`
      IF NOT EXISTS (
        SELECT * FROM sys.columns 
        WHERE object_id = OBJECT_ID('comments') 
        AND name = 'is_anonymous'
      )
      BEGIN
        ALTER TABLE comments
        ADD is_anonymous BIT DEFAULT 0
      END
    `);
    console.log("✅ comments 表添加 is_anonymous 字段成功");

    console.log("🎉 树洞审核功能字段添加完成");
  } catch (error) {
    console.error("❌ 添加字段失败:", error);
  } finally {
    await pool.close();
  }
};

addAuditFieldsToPosts();
