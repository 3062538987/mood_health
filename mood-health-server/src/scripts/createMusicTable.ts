import { query } from '../config/database';

const createMusicTable = async () => {
  try {
    console.log('开始创建音乐表...');
    
    // 创建音乐表
    await query(`
      CREATE TABLE IF NOT EXISTS musics (
        id INT IDENTITY(1,1) PRIMARY KEY,
        title NVARCHAR(255) NOT NULL,
        artist NVARCHAR(255) NOT NULL,
        url NVARCHAR(500) NOT NULL,
        duration NVARCHAR(50) NOT NULL,
        category NVARCHAR(100) NOT NULL,
        cover NVARCHAR(500),
        createdAt DATETIME DEFAULT GETDATE(),
        updatedAt DATETIME DEFAULT GETDATE()
      );
    `);
    
    console.log('音乐表创建成功！');
    
    // 插入一些示例数据
    await query(`
      INSERT INTO musics (title, artist, url, duration, category, cover)
      VALUES 
      ('宁静致远', '轻音乐', 'https://example.com/music/1.mp3', '3:45', 'light', 'https://example.com/covers/1.jpg'),
      ('雨声', '白噪音', 'https://example.com/music/2.mp3', '5:20', 'white', 'https://example.com/covers/2.jpg'),
      ('森林漫步', '自然之声', 'https://example.com/music/3.mp3', '4:15', 'nature', 'https://example.com/covers/3.jpg'),
      ('冥想指引', '冥想音乐', 'https://example.com/music/4.mp3', '10:00', 'meditation', 'https://example.com/covers/4.jpg'),
      ('钢琴曲', '轻音乐', 'https://example.com/music/5.mp3', '4:30', 'light', 'https://example.com/covers/5.jpg'),
      ('海浪声', '自然之声', 'https://example.com/music/6.mp3', '6:10', 'nature', 'https://example.com/covers/6.jpg');
    `);
    
    console.log('示例数据插入成功！');
    console.log('音乐功能初始化完成。');
  } catch (error) {
    console.error('创建音乐表失败:', error);
    process.exit(1);
  }
};

createMusicTable();