import pool from "../config/database";
import sql from "mssql";

export interface Post {
  id: number;
  title: string;
  content: string;
  user_id: number | null;
  is_anonymous: boolean;
  like_count: number;
  status: number;
  audit_remark: string | null;
  created_at: Date;
}

export interface CreatePostParams {
  title: string;
  content: string;
  user_id: number | null;
  isAnonymous: boolean;
}

export interface AuditPostParams {
  status: number;
  audit_remark?: string;
}

// 创建帖子
export const createPost = async (params: CreatePostParams) => {
  const result = await pool
    .request()
    .input("title", sql.NVarChar, params.title)
    .input("content", sql.NVarChar, params.content)
    .input("user_id", sql.Int, params.user_id)
    .input("is_anonymous", sql.Bit, params.isAnonymous ? 1 : 0)
    .input("status", sql.Int, 0).query(`
      INSERT INTO posts (title, content, user_id, is_anonymous, status)
      OUTPUT INSERTED.*
      VALUES (@title, @content, @user_id, @is_anonymous, @status)
    `);
  return result.recordset[0];
};

// 获取帖子列表（分页）
export const getPosts = async (page: number = 1, pageSize: number = 10) => {
  const offset = (page - 1) * pageSize;
  const result = await pool
    .request()
    .input("offset", sql.Int, offset)
    .input("pageSize", sql.Int, pageSize).query(`
      SELECT 
        p.id,
        p.title,
        p.content,
        p.user_id,
        p.is_anonymous,
        p.like_count,
        p.status,
        p.audit_remark,
        p.created_at,
        u.username,
        (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id) as comment_count
      FROM posts p
      LEFT JOIN users u ON p.user_id = u.id
      WHERE p.status = 1
      ORDER BY p.created_at DESC
      OFFSET @offset ROWS
      FETCH NEXT @pageSize ROWS ONLY
    `);
  return result.recordset;
};

// 根据ID获取帖子
export const getPostById = async (id: number) => {
  const result = await pool.request().input("id", sql.Int, id).query(`
      SELECT 
        p.id,
        p.title,
        p.content,
        p.user_id,
        p.is_anonymous,
        p.like_count,
        p.status,
        p.audit_remark,
        p.created_at,
        u.username
      FROM posts p
      LEFT JOIN users u ON p.user_id = u.id
      WHERE p.id = @id
    `);
  return result.recordset.length ? result.recordset[0] : null;
};

export const getPendingPosts = async (
  page: number = 1,
  pageSize: number = 10,
) => {
  const offset = (page - 1) * pageSize;
  const result = await pool
    .request()
    .input("offset", sql.Int, offset)
    .input("pageSize", sql.Int, pageSize).query(`
      SELECT 
        p.id,
        p.title,
        p.content,
        p.user_id,
        p.is_anonymous,
        p.like_count,
        p.status,
        p.audit_remark,
        p.created_at,
        u.username
      FROM posts p
      LEFT JOIN users u ON p.user_id = u.id
      WHERE p.status = 0
      ORDER BY p.created_at DESC
      OFFSET @offset ROWS
      FETCH NEXT @pageSize ROWS ONLY
    `);
  return result.recordset;
};

export const auditPost = async (id: number, params: AuditPostParams) => {
  const result = await pool
    .request()
    .input("id", sql.Int, id)
    .input("status", sql.Int, params.status)
    .input("audit_remark", sql.NVarChar, params.audit_remark || null).query(`
      UPDATE posts
      SET status = @status,
          audit_remark = @audit_remark
      OUTPUT INSERTED.*
      WHERE id = @id
    `);
  return result.recordset.length ? result.recordset[0] : null;
};

// 点赞帖子（防止重复点赞）
export const likePost = async (id: number, userId: number) => {
  // 检查是否已经点赞
  const checkResult = await pool
    .request()
    .input("post_id", sql.Int, id)
    .input("user_id", sql.Int, userId).query(`
      SELECT * FROM post_likes 
      WHERE post_id = @post_id AND user_id = @user_id
    `);

  if (checkResult.recordset.length > 0) {
    // 已点赞，取消点赞
    await pool
      .request()
      .input("post_id", sql.Int, id)
      .input("user_id", sql.Int, userId).query(`
        DELETE FROM post_likes 
        WHERE post_id = @post_id AND user_id = @user_id
      `);

    // 减少点赞数
    const result = await pool.request().input("id", sql.Int, id).query(`
        UPDATE posts
        SET like_count = CASE WHEN like_count > 0 THEN like_count - 1 ELSE 0 END
        OUTPUT INSERTED.*
        WHERE id = @id
      `);
    return { ...result.recordset[0], liked: false };
  } else {
    // 未点赞，添加点赞
    await pool
      .request()
      .input("post_id", sql.Int, id)
      .input("user_id", sql.Int, userId).query(`
        INSERT INTO post_likes (post_id, user_id)
        VALUES (@post_id, @user_id)
      `);

    // 增加点赞数
    const result = await pool.request().input("id", sql.Int, id).query(`
        UPDATE posts
        SET like_count = like_count + 1
        OUTPUT INSERTED.*
        WHERE id = @id
      `);
    return { ...result.recordset[0], liked: true };
  }
};

// 检查用户是否已点赞
export const checkUserLiked = async (postId: number, userId: number) => {
  const result = await pool
    .request()
    .input("post_id", sql.Int, postId)
    .input("user_id", sql.Int, userId).query(`
      SELECT * FROM post_likes 
      WHERE post_id = @post_id AND user_id = @user_id
    `);
  return result.recordset.length > 0;
};
