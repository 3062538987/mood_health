import pool from '../config/database'
import sql from 'mssql'
import { isSqliteClient } from '../config/database'
import { sqliteAll, sqliteGet, sqliteRun, sqliteTransaction } from '../config/sqlite'

export interface Comment {
  id: number
  post_id: number
  user_id: number | null
  content: string
  is_anonymous: boolean
  like_count: number
  created_at: Date
}

export interface CreateCommentParams {
  post_id: number
  user_id: number | null
  content: string
  isAnonymous: boolean
}

let commentSchemaChecked = false

const ensureCommentSchema = async () => {
  if (commentSchemaChecked) {
    return
  }

  if (isSqliteClient) {
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

    commentSchemaChecked = true
    return
  }

  await pool.request().query(`
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
  `)

  commentSchemaChecked = true
}

export const createComment = async (params: CreateCommentParams) => {
  await ensureCommentSchema()

  if (isSqliteClient) {
    const insertResult = sqliteRun(
      'INSERT INTO comments (post_id, user_id, content, is_anonymous) VALUES (?, ?, ?, ?)',
      [params.post_id, params.user_id, params.content, params.isAnonymous ? 1 : 0]
    )

    return sqliteGet('SELECT * FROM comments WHERE id = ?', [Number(insertResult.lastInsertRowid)])
  }

  const result = await pool
    .request()
    .input('post_id', sql.Int, params.post_id)
    .input('user_id', sql.Int, params.user_id)
    .input('content', sql.NVarChar, params.content)
    .input('is_anonymous', sql.Bit, params.isAnonymous ? 1 : 0).query(`
      INSERT INTO comments (post_id, user_id, content, is_anonymous)
      OUTPUT INSERTED.*
      VALUES (@post_id, @user_id, @content, @is_anonymous)
    `)
  return result.recordset[0]
}

export const getCommentsByPostId = async (post_id: number) => {
  await ensureCommentSchema()

  if (isSqliteClient) {
    return sqliteAll(
      `
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
        WHERE c.post_id = ?
        ORDER BY datetime(c.created_at) ASC
      `,
      [post_id]
    )
  }

  const result = await pool.request().input('post_id', sql.Int, post_id).query(`
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
    `)
  return result.recordset
}

export const likeComment = async (id: number, userId: number) => {
  await ensureCommentSchema()

  if (isSqliteClient) {
    return sqliteTransaction(() => {
      const liked = sqliteGet('SELECT id FROM comment_likes WHERE comment_id = ? AND user_id = ?', [
        id,
        userId,
      ])

      if (liked) {
        sqliteRun('DELETE FROM comment_likes WHERE comment_id = ? AND user_id = ?', [id, userId])
        sqliteRun(
          `
            UPDATE comments
            SET like_count = CASE WHEN like_count > 0 THEN like_count - 1 ELSE 0 END
            WHERE id = ?
          `,
          [id]
        )
        const comment = sqliteGet('SELECT * FROM comments WHERE id = ?', [id])
        return comment ? { ...(comment as Record<string, unknown>), liked: false } : null
      }

      sqliteRun('INSERT INTO comment_likes (comment_id, user_id) VALUES (?, ?)', [id, userId])
      sqliteRun('UPDATE comments SET like_count = like_count + 1 WHERE id = ?', [id])
      const comment = sqliteGet('SELECT * FROM comments WHERE id = ?', [id])
      return comment ? { ...(comment as Record<string, unknown>), liked: true } : null
    })
  }

  const checkResult = await pool
    .request()
    .input('comment_id', sql.Int, id)
    .input('user_id', sql.Int, userId).query(`
      SELECT * FROM comment_likes 
      WHERE comment_id = @comment_id AND user_id = @user_id
    `)

  if (checkResult.recordset.length > 0) {
    await pool.request().input('comment_id', sql.Int, id).input('user_id', sql.Int, userId).query(`
        DELETE FROM comment_likes 
        WHERE comment_id = @comment_id AND user_id = @user_id
      `)

    const result = await pool.request().input('id', sql.Int, id).query(`
        UPDATE comments
        SET like_count = CASE WHEN like_count > 0 THEN like_count - 1 ELSE 0 END
        OUTPUT INSERTED.*
        WHERE id = @id
      `)
    return { ...result.recordset[0], liked: false }
  }

  await pool.request().input('comment_id', sql.Int, id).input('user_id', sql.Int, userId).query(`
      INSERT INTO comment_likes (comment_id, user_id)
      VALUES (@comment_id, @user_id)
    `)

  const result = await pool.request().input('id', sql.Int, id).query(`
      UPDATE comments
      SET like_count = like_count + 1
      OUTPUT INSERTED.*
      WHERE id = @id
    `)
  return { ...result.recordset[0], liked: true }
}

export const checkUserLikedComment = async (commentId: number, userId: number) => {
  await ensureCommentSchema()

  if (isSqliteClient) {
    const row = sqliteGet('SELECT id FROM comment_likes WHERE comment_id = ? AND user_id = ?', [
      commentId,
      userId,
    ])
    return !!row
  }

  const result = await pool
    .request()
    .input('comment_id', sql.Int, commentId)
    .input('user_id', sql.Int, userId).query(`
      SELECT * FROM comment_likes 
      WHERE comment_id = @comment_id AND user_id = @user_id
    `)
  return result.recordset.length > 0
}
