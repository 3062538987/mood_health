import pool from "../config/database";
import sql from "mssql";

export interface Comment {
  id: number;
  post_id: number;
  user_id: number | null;
  content: string;
  is_anonymous: boolean;
  like_count: number;
  created_at: Date;
}

export interface CreateCommentParams {
  post_id: number;
  user_id: number | null;
  content: string;
  isAnonymous: boolean;
}

// 创建评论
export const createComment = async (params: CreateCommentParams) => {
  const result = await pool
    .request()
    .input("post_id", sql.Int, params.post_id)
    .input("user_id", sql.Int, params.user_id)
    .input("content", sql.NVarChar, params.content)
    .input("is_anonymous", sql.Bit, params.isAnonymous ? 1 : 0)
    .query(`
      INSERT INTO comments (post_id, user_id, content, is_anonymous)
      OUTPUT INSERTED.*
      VALUES (@post_id, @user_id, @content, @is_anonymous)
    `);
  return result.recordset[0];
};

// 根据帖子ID获取评论列表
export const getCommentsByPostId = async (post_id: number) => {
  const result = await pool
    .request()
    .input("post_id", sql.Int, post_id)
    .query(`
      SELECT 
        c.id,
        c.post_id,
        c.user_id,
        c.content,
        c.is_anonymous,
        c.like_count,
        c.created_at,
        u.username
      FROM comments c
      LEFT JOIN users u ON c.user_id = u.id
      WHERE c.post_id = @post_id
      ORDER BY c.created_at ASC
    `);
  return result.recordset;
};

// 点赞评论（防止重复点赞）
export const likeComment = async (id: number, userId: number) => {
  // 检查是否已经点赞
  const checkResult = await pool
    .request()
    .input("comment_id", sql.Int, id)
    .input("user_id", sql.Int, userId)
    .query(`
      SELECT * FROM comment_likes 
      WHERE comment_id = @comment_id AND user_id = @user_id
    `);

  if (checkResult.recordset.length > 0) {
    // 已点赞，取消点赞
    await pool
      .request()
      .input("comment_id", sql.Int, id)
      .input("user_id", sql.Int, userId)
      .query(`
        DELETE FROM comment_likes 
        WHERE comment_id = @comment_id AND user_id = @user_id
      `);

    // 减少点赞数
    const result = await pool
      .request()
      .input("id", sql.Int, id)
      .query(`
        UPDATE comments
        SET like_count = CASE WHEN like_count > 0 THEN like_count - 1 ELSE 0 END
        OUTPUT INSERTED.*
        WHERE id = @id
      `);
    return { ...result.recordset[0], liked: false };
  } else {
    // 未点赞，添加点赞
    await pool
      .request()
      .input("comment_id", sql.Int, id)
      .input("user_id", sql.Int, userId)
      .query(`
        INSERT INTO comment_likes (comment_id, user_id)
        VALUES (@comment_id, @user_id)
      `);

    // 增加点赞数
    const result = await pool
      .request()
      .input("id", sql.Int, id)
      .query(`
        UPDATE comments
        SET like_count = like_count + 1
        OUTPUT INSERTED.*
        WHERE id = @id
      `);
    return { ...result.recordset[0], liked: true };
  }
};

// 检查用户是否已点赞评论
export const checkUserLikedComment = async (commentId: number, userId: number) => {
  const result = await pool
    .request()
    .input("comment_id", sql.Int, commentId)
    .input("user_id", sql.Int, userId)
    .query(`
      SELECT * FROM comment_likes 
      WHERE comment_id = @comment_id AND user_id = @user_id
    `);
  return result.recordset.length > 0;
};