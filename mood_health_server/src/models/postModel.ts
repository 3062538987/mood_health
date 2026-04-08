import pool from '../config/database'
import sql from 'mssql'
import { isSqliteClient } from '../config/database'
import { sqliteAll, sqliteGet, sqliteRun, sqliteTransaction } from '../config/sqlite'
import logger from '../utils/logger'

export interface Post {
  id: number
  title: string
  content: string
  user_id: number | null
  is_anonymous: boolean
  like_count: number
  status: number
  audit_remark: string | null
  created_at: Date
}

export interface CreatePostParams {
  title: string
  content: string
  user_id: number | null
  isAnonymous: boolean
}

export interface AuditPostParams {
  status: number
  audit_remark?: string
}

let postSchemaChecked = false

const ensurePostSchema = async () => {
  if (postSchemaChecked) {
    return
  }

  if (isSqliteClient) {
    sqliteRun(`
      CREATE TABLE IF NOT EXISTS posts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        user_id INTEGER,
        is_anonymous INTEGER NOT NULL DEFAULT 0,
        like_count INTEGER NOT NULL DEFAULT 0,
        status INTEGER NOT NULL DEFAULT 1,
        audit_remark TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
      )
    `)

    sqliteRun(`
      CREATE TABLE IF NOT EXISTS comments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        post_id INTEGER NOT NULL,
        user_id INTEGER,
        content TEXT NOT NULL,
        is_anonymous INTEGER NOT NULL DEFAULT 0,
        like_count INTEGER NOT NULL DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
      )
    `)

    sqliteRun(`
      CREATE TABLE IF NOT EXISTS post_likes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        post_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (post_id, user_id),
        FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `)

    sqliteRun(`
      CREATE TABLE IF NOT EXISTS comment_likes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        comment_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (comment_id, user_id),
        FOREIGN KEY (comment_id) REFERENCES comments(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `)

    postSchemaChecked = true
    return
  }

  await pool.request().query(`
    IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'posts')
    BEGIN
      CREATE TABLE posts (
        id INT IDENTITY(1,1) PRIMARY KEY,
        title NVARCHAR(255) NOT NULL,
        content NVARCHAR(MAX) NOT NULL,
        user_id INT NULL,
        is_anonymous BIT NOT NULL DEFAULT 0,
        like_count INT NOT NULL DEFAULT 0,
        status INT NOT NULL DEFAULT 1,
        audit_remark NVARCHAR(255) NULL,
        created_at DATETIME NOT NULL DEFAULT GETDATE(),
        FOREIGN KEY (user_id) REFERENCES users(id)
      );
    END

    IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'comments')
    BEGIN
      CREATE TABLE comments (
        id INT IDENTITY(1,1) PRIMARY KEY,
        post_id INT NOT NULL,
        user_id INT NULL,
        content NVARCHAR(MAX) NOT NULL,
        is_anonymous BIT NOT NULL DEFAULT 0,
        like_count INT NOT NULL DEFAULT 0,
        created_at DATETIME NOT NULL DEFAULT GETDATE(),
        FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id)
      );
    END

    IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'post_likes')
    BEGIN
      CREATE TABLE post_likes (
        id INT IDENTITY(1,1) PRIMARY KEY,
        post_id INT NOT NULL,
        user_id INT NOT NULL,
        created_at DATETIME NOT NULL DEFAULT GETDATE(),
        CONSTRAINT uq_post_likes UNIQUE (post_id, user_id),
        FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id)
      );
    END

    IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'comment_likes')
    BEGIN
      CREATE TABLE comment_likes (
        id INT IDENTITY(1,1) PRIMARY KEY,
        comment_id INT NOT NULL,
        user_id INT NOT NULL,
        created_at DATETIME NOT NULL DEFAULT GETDATE(),
        CONSTRAINT uq_comment_likes UNIQUE (comment_id, user_id),
        FOREIGN KEY (comment_id) REFERENCES comments(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id)
      );
    END

    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('posts') AND name = 'title')
      ALTER TABLE posts ADD title NVARCHAR(255) NULL;
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('posts') AND name = 'is_anonymous')
      ALTER TABLE posts ADD is_anonymous BIT NOT NULL CONSTRAINT DF_posts_is_anonymous DEFAULT 0;
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('posts') AND name = 'like_count')
      ALTER TABLE posts ADD like_count INT NOT NULL CONSTRAINT DF_posts_like_count DEFAULT 0;
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('posts') AND name = 'status')
      ALTER TABLE posts ADD status INT NOT NULL CONSTRAINT DF_posts_status DEFAULT 1;
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('posts') AND name = 'audit_remark')
      ALTER TABLE posts ADD audit_remark NVARCHAR(255) NULL;
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('comments') AND name = 'is_anonymous')
      ALTER TABLE comments ADD is_anonymous BIT NOT NULL CONSTRAINT DF_comments_is_anonymous DEFAULT 0;
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('comments') AND name = 'like_count')
      ALTER TABLE comments ADD like_count INT NOT NULL CONSTRAINT DF_comments_like_count DEFAULT 0;
  `)

  postSchemaChecked = true
}

const logPostDbError = (message: string, error: unknown, extra?: Record<string, unknown>) => {
  logger.error(message, {
    ...extra,
    error,
  })
}

export const createPost = async (params: CreatePostParams) => {
  await ensurePostSchema()

  if (isSqliteClient) {
    const insertResult = sqliteRun(
      'INSERT INTO posts (title, content, user_id, is_anonymous, status) VALUES (?, ?, ?, ?, ?)',
      [params.title, params.content, params.user_id, params.isAnonymous ? 1 : 0, 0]
    )

    return sqliteGet(
      `
        SELECT id, title, content, user_id, is_anonymous, like_count, status, audit_remark, created_at
        FROM posts
        WHERE id = ?
      `,
      [Number(insertResult.lastInsertRowid)]
    )
  }

  const result = await pool
    .request()
    .input('title', sql.NVarChar, params.title)
    .input('content', sql.NVarChar, params.content)
    .input('user_id', sql.Int, params.user_id)
    .input('is_anonymous', sql.Bit, params.isAnonymous ? 1 : 0)
    .input('status', sql.Int, 0).query(`
      INSERT INTO posts (title, content, user_id, is_anonymous, status)
      OUTPUT INSERTED.*
      VALUES (@title, @content, @user_id, @is_anonymous, @status)
    `)
  return result.recordset[0]
}

export const getPosts = async (page: number = 1, pageSize: number = 10) => {
  await ensurePostSchema()
  const safePage = page > 0 ? Math.floor(page) : 1
  const safePageSize = pageSize > 0 ? Math.min(Math.floor(pageSize), 50) : 10
  const offset = (safePage - 1) * safePageSize

  try {
    if (isSqliteClient) {
      const totalRow = sqliteGet('SELECT COUNT(*) AS total FROM posts WHERE status = 1') as
        | { total: number }
        | undefined

      const rows = sqliteAll(
        `
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
          ORDER BY datetime(p.created_at) DESC
          LIMIT ? OFFSET ?
        `,
        [safePageSize, offset]
      )

      return {
        list: rows,
        total: Number(totalRow?.total || 0),
      }
    }

    const totalResult = await pool.request().query(`
      SELECT COUNT(*) AS total FROM posts WHERE status = 1
    `)
    const result = await pool
      .request()
      .input('offset', sql.Int, offset)
      .input('pageSize', sql.Int, safePageSize).query(`
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
      `)

    return {
      list: result.recordset,
      total: totalResult.recordset[0]?.total || 0,
    }
  } catch (error) {
    logPostDbError('获取帖子列表查询失败', error, { page, pageSize })
    throw error
  }
}

export const getPostById = async (id: number) => {
  await ensurePostSchema()

  if (isSqliteClient) {
    const row = sqliteGet(
      `
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
        WHERE p.id = ?
      `,
      [id]
    )
    return row || null
  }

  const result = await pool.request().input('id', sql.Int, id).query(`
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
    `)
  return result.recordset.length ? result.recordset[0] : null
}

export const getPendingPosts = async (
  page: number = 1,
  pageSize: number = 10,
  status: number = 0
) => {
  await ensurePostSchema()
  const safePage = page > 0 ? Math.floor(page) : 1
  const safePageSize = pageSize > 0 ? Math.min(Math.floor(pageSize), 50) : 10
  const safeStatus = [0, 1, 2].includes(status) ? status : 0
  const offset = (safePage - 1) * safePageSize

  if (isSqliteClient) {
    return sqliteAll(
      `
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
        WHERE p.status = ?
        ORDER BY datetime(p.created_at) DESC
        LIMIT ? OFFSET ?
      `,
      [safeStatus, safePageSize, offset]
    )
  }

  const result = await pool
    .request()
    .input('offset', sql.Int, offset)
    .input('pageSize', sql.Int, safePageSize)
    .input('status', sql.Int, safeStatus).query(`
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
      WHERE p.status = @status
      ORDER BY p.created_at DESC
      OFFSET @offset ROWS
      FETCH NEXT @pageSize ROWS ONLY
    `)
  return result.recordset
}

export const getPostAuditStats = async () => {
  await ensurePostSchema()

  if (isSqliteClient) {
    const row = sqliteGet(`
      SELECT
        SUM(CASE WHEN status = 0 THEN 1 ELSE 0 END) AS pending,
        SUM(CASE WHEN status = 1 THEN 1 ELSE 0 END) AS approved,
        SUM(CASE WHEN status = 2 THEN 1 ELSE 0 END) AS rejected
      FROM posts
    `) as Record<string, unknown> | undefined

    return {
      pending: Number(row?.pending || 0),
      approved: Number(row?.approved || 0),
      rejected: Number(row?.rejected || 0),
    }
  }

  const result = await pool.request().query(`
      SELECT
        SUM(CASE WHEN status = 0 THEN 1 ELSE 0 END) AS pending,
        SUM(CASE WHEN status = 1 THEN 1 ELSE 0 END) AS approved,
        SUM(CASE WHEN status = 2 THEN 1 ELSE 0 END) AS rejected
      FROM posts
    `)

  const row = result.recordset[0] || {}
  return {
    pending: Number(row.pending || 0),
    approved: Number(row.approved || 0),
    rejected: Number(row.rejected || 0),
  }
}

export const auditPost = async (id: number, params: AuditPostParams) => {
  await ensurePostSchema()

  if (isSqliteClient) {
    const updateResult = sqliteRun(
      `
        UPDATE posts
        SET status = ?,
            audit_remark = ?
        WHERE id = ?
      `,
      [params.status, params.audit_remark || null, id]
    )

    if (Number(updateResult.changes || 0) === 0) {
      return null
    }

    return sqliteGet('SELECT * FROM posts WHERE id = ?', [id])
  }

  const result = await pool
    .request()
    .input('id', sql.Int, id)
    .input('status', sql.Int, params.status)
    .input('audit_remark', sql.NVarChar, params.audit_remark || null).query(`
      UPDATE posts
      SET status = @status,
          audit_remark = @audit_remark
      OUTPUT INSERTED.*
      WHERE id = @id
    `)
  return result.recordset.length ? result.recordset[0] : null
}

export const likePost = async (id: number, userId: number) => {
  await ensurePostSchema()

  if (isSqliteClient) {
    return sqliteTransaction(() => {
      const liked = sqliteGet('SELECT id FROM post_likes WHERE post_id = ? AND user_id = ?', [
        id,
        userId,
      ])

      if (liked) {
        sqliteRun('DELETE FROM post_likes WHERE post_id = ? AND user_id = ?', [id, userId])
        sqliteRun(
          `
            UPDATE posts
            SET like_count = CASE WHEN like_count > 0 THEN like_count - 1 ELSE 0 END
            WHERE id = ?
          `,
          [id]
        )

        const post = sqliteGet('SELECT * FROM posts WHERE id = ?', [id])
        return post ? { ...(post as Record<string, unknown>), liked: false } : null
      }

      sqliteRun('INSERT INTO post_likes (post_id, user_id) VALUES (?, ?)', [id, userId])
      sqliteRun('UPDATE posts SET like_count = like_count + 1 WHERE id = ?', [id])
      const post = sqliteGet('SELECT * FROM posts WHERE id = ?', [id])
      return post ? { ...(post as Record<string, unknown>), liked: true } : null
    })
  }

  const checkResult = await pool
    .request()
    .input('post_id', sql.Int, id)
    .input('user_id', sql.Int, userId).query(`
      SELECT * FROM post_likes 
      WHERE post_id = @post_id AND user_id = @user_id
    `)

  if (checkResult.recordset.length > 0) {
    await pool.request().input('post_id', sql.Int, id).input('user_id', sql.Int, userId).query(`
        DELETE FROM post_likes 
        WHERE post_id = @post_id AND user_id = @user_id
      `)

    const result = await pool.request().input('id', sql.Int, id).query(`
        UPDATE posts
        SET like_count = CASE WHEN like_count > 0 THEN like_count - 1 ELSE 0 END
        OUTPUT INSERTED.*
        WHERE id = @id
      `)
    return { ...result.recordset[0], liked: false }
  }

  await pool.request().input('post_id', sql.Int, id).input('user_id', sql.Int, userId).query(`
      INSERT INTO post_likes (post_id, user_id)
      VALUES (@post_id, @user_id)
    `)

  const result = await pool.request().input('id', sql.Int, id).query(`
      UPDATE posts
      SET like_count = like_count + 1
      OUTPUT INSERTED.*
      WHERE id = @id
    `)
  return { ...result.recordset[0], liked: true }
}

export const checkUserLiked = async (postId: number, userId: number) => {
  await ensurePostSchema()

  if (isSqliteClient) {
    const row = sqliteGet('SELECT id FROM post_likes WHERE post_id = ? AND user_id = ?', [
      postId,
      userId,
    ])
    return !!row
  }

  const result = await pool
    .request()
    .input('post_id', sql.Int, postId)
    .input('user_id', sql.Int, userId).query(`
      SELECT * FROM post_likes 
      WHERE post_id = @post_id AND user_id = @user_id
    `)
  return result.recordset.length > 0
}
