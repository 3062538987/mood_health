import { query } from '../config/database';

const createLikeTables = async () => {
  try {
    console.log('开始创建点赞相关表...');

    // 创建帖子点赞记录表
    await query(`
      IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'post_likes')
      BEGIN
        CREATE TABLE post_likes (
          id INT IDENTITY(1,1) PRIMARY KEY,
          post_id INT NOT NULL,
          user_id INT NOT NULL,
          created_at DATETIME DEFAULT GETDATE(),
          UNIQUE(post_id, user_id)
        );
      END
    `);
    console.log('帖子点赞记录表创建成功！');

    // 创建评论点赞记录表
    await query(`
      IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'comment_likes')
      BEGIN
        CREATE TABLE comment_likes (
          id INT IDENTITY(1,1) PRIMARY KEY,
          comment_id INT NOT NULL,
          user_id INT NOT NULL,
          created_at DATETIME DEFAULT GETDATE(),
          UNIQUE(comment_id, user_id)
        );
      END
    `);
    console.log('评论点赞记录表创建成功！');

    // 修改posts表，添加title和isAnonymous字段（如果不存在）
    await query(`
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('posts') AND name = 'title')
      BEGIN
        ALTER TABLE posts ADD title NVARCHAR(255);
      END
    `);

    await query(`
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('posts') AND name = 'is_anonymous')
      BEGIN
        ALTER TABLE posts ADD is_anonymous BIT DEFAULT 0;
      END
    `);

    // 修改comments表，添加isAnonymous字段（如果不存在）
    await query(`
      IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('comments') AND name = 'is_anonymous')
      BEGIN
        ALTER TABLE comments ADD is_anonymous BIT DEFAULT 0;
      END
    `);

    console.log('帖子和评论表字段扩展完成！');
    console.log('点赞功能初始化完成。');
  } catch (error) {
    console.error('创建点赞表失败:', error);
    process.exit(1);
  }
};

createLikeTables();