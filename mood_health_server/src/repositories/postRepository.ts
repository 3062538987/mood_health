import { ResultSetHeader, RowDataPacket } from 'mysql2'
import { getMysqlPool } from '../config/mysql'

export interface PostDatabase {
  query<T>(sql: string, params?: unknown[]): Promise<[T, unknown]>
  getConnection(): Promise<PostConnection>
}

export interface PostConnection {
  beginTransaction(): Promise<void>
  commit(): Promise<void>
  rollback(): Promise<void>
  release(): void
  query<T>(sql: string, params?: unknown[]): Promise<[T, unknown]>
}

export interface PostDto {
  id: number
  title: string
  content: string
  userId: number | null
  isAnonymous: boolean
  likeCount: number
  status: number
  auditRemark: string | null
  createdAt: string
  username?: string | null
  commentCount?: number
  liked?: boolean
  hasAiReply?: boolean
}

export interface CommentDto {
  id: number
  postId: number
  userId: number | null
  content: string
  isAnonymous: boolean
  likeCount: number
  createdAt: string
  username?: string | null
  liked?: boolean
}

export interface CreatePostInput {
  title: string
  content: string
  userId: number | null
  isAnonymous: boolean
  riskLevel?: 'low' | 'medium' | 'high'
  needsReview?: number
}

export interface AiReplyDto {
  id: number
  postId: number
  content: string
  createdAt: string
}

export interface CreateCommentInput {
  postId: number
  userId: number | null
  content: string
  isAnonymous: boolean
}

export interface AuditPostInput {
  status: number
  auditRemark?: string | null
}

type PostRow = RowDataPacket & {
  id: number
  title: string
  content: string
  user_id: number | null
  is_anonymous: number
  like_count: number
  status: number
  audit_remark: string | null
  created_at: Date | string
  username?: string | null
  comment_count?: number
  ai_reply_count?: number
}

type CommentRow = RowDataPacket & {
  id: number
  post_id: number
  user_id: number | null
  content: string
  is_anonymous: number
  like_count: number
  created_at: Date | string
  username?: string | null
}

const toIsoString = (value: Date | string): string =>
  value instanceof Date ? value.toISOString() : String(value)

const mapPost = (row: PostRow): PostDto => ({
  id: row.id,
  title: row.title,
  content: row.content,
  userId: row.user_id,
  isAnonymous: row.is_anonymous === 1,
  likeCount: row.like_count,
  status: row.status,
  auditRemark: row.audit_remark,
  createdAt: toIsoString(row.created_at),
  username: row.username ?? null,
  commentCount: row.comment_count != null ? Number(row.comment_count) : undefined,
  hasAiReply: row.ai_reply_count != null ? row.ai_reply_count > 0 : false,
})

type AiReplyRow = RowDataPacket & {
  id: number
  post_id: number
  content: string
  created_at: Date | string
}

const mapComment = (row: CommentRow): CommentDto => ({
  id: row.id,
  postId: row.post_id,
  userId: row.user_id,
  content: row.content,
  isAnonymous: row.is_anonymous === 1,
  likeCount: row.like_count,
  createdAt: toIsoString(row.created_at),
  username: row.username ?? null,
})

const mapAiReply = (row: AiReplyRow): AiReplyDto => ({
  id: row.id,
  postId: row.post_id,
  content: row.content,
  createdAt: toIsoString(row.created_at),
})

export const createPostRepository = (db: PostDatabase = getMysqlPool()) => {
  // --- Posts ---
  const createPost = async (input: CreatePostInput): Promise<PostDto> => {
    const needsReview = input.needsReview ?? 0
    const riskLevel = input.riskLevel || 'low'
    const [result] = await db.query<ResultSetHeader>(
      'INSERT INTO posts (title, content, user_id, is_anonymous, status, needs_review, risk_level) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [input.title, input.content, input.userId, input.isAnonymous ? 1 : 0, needsReview > 0 ? 0 : 1, needsReview, riskLevel]
    )
    const [rows] = await db.query<PostRow[]>(
      'SELECT * FROM posts WHERE id = ? LIMIT 1',
      [result.insertId]
    )
    return mapPost(rows[0])
  }

  const findPosts = async (page: number = 1, pageSize: number = 10): Promise<{ list: PostDto[]; total: number }> => {
    const safePage = page > 0 ? Math.floor(page) : 1
    const safePageSize = pageSize > 0 ? Math.min(Math.floor(pageSize), 50) : 10
    const offset = (safePage - 1) * safePageSize

    const [countRows] = await db.query<RowDataPacket[]>(
      'SELECT COUNT(*) AS total FROM posts WHERE status = 1 AND deleted_at IS NULL'
    )
    const total = Number(countRows[0]?.total || 0)

    const [rows] = await db.query<PostRow[]>(
      `SELECT p.*, u.username,
        (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id AND c.deleted_at IS NULL) AS comment_count,
        (SELECT COUNT(*) FROM ai_replies ar WHERE ar.post_id = p.id) AS ai_reply_count
       FROM posts p
       LEFT JOIN users u ON p.user_id = u.id
       WHERE p.status = 1 AND p.deleted_at IS NULL
       ORDER BY p.created_at DESC
       LIMIT ? OFFSET ?`,
      [safePageSize, offset]
    )
    return { list: rows.map(mapPost), total }
  }

  const findPostById = async (id: number): Promise<PostDto | null> => {
    const [rows] = await db.query<PostRow[]>(
      `SELECT p.*, u.username
       FROM posts p
       LEFT JOIN users u ON p.user_id = u.id
       WHERE p.id = ? LIMIT 1`,
      [id]
    )
    return rows[0] ? mapPost(rows[0]) : null
  }

  const findPendingPosts = async (page: number = 1, pageSize: number = 10, status: number = 0): Promise<PostDto[]> => {
    const safePage = page > 0 ? Math.floor(page) : 1
    const safePageSize = pageSize > 0 ? Math.min(Math.floor(pageSize), 50) : 10
    const safeStatus = [0, 1, 2].includes(status) ? status : 0

    const [rows] = await db.query<PostRow[]>(
      `SELECT p.*, u.username
       FROM posts p
       LEFT JOIN users u ON p.user_id = u.id
       WHERE p.status = ?
       ORDER BY p.created_at DESC
       LIMIT ? OFFSET ?`,
      [safeStatus, safePageSize, (safePage - 1) * safePageSize]
    )
    return rows.map(mapPost)
  }

  const getAuditStats = async (): Promise<{ pending: number; approved: number; rejected: number }> => {
    const [rows] = await db.query<RowDataPacket[]>(
      `SELECT
        SUM(CASE WHEN status = 0 THEN 1 ELSE 0 END) AS pending,
        SUM(CASE WHEN status = 1 THEN 1 ELSE 0 END) AS approved,
        SUM(CASE WHEN status = 2 THEN 1 ELSE 0 END) AS rejected
       FROM posts`
    )
    return {
      pending: Number(rows[0]?.pending || 0),
      approved: Number(rows[0]?.approved || 0),
      rejected: Number(rows[0]?.rejected || 0),
    }
  }

  const auditPost = async (id: number, input: AuditPostInput): Promise<PostDto | null> => {
    const [result] = await db.query<ResultSetHeader>(
      'UPDATE posts SET status = ?, audit_remark = ? WHERE id = ?',
      [input.status, input.auditRemark ?? null, id]
    )
    if (result.affectedRows === 0) return null
    return findPostById(id)
  }

  const likePost = async (postId: number, userId: number): Promise<PostDto | null> => {
    const conn = await db.getConnection()
    try {
      await conn.beginTransaction()

      const [liked] = await conn.query<RowDataPacket[]>(
        'SELECT id FROM post_likes WHERE post_id = ? AND user_id = ? LIMIT 1',
        [postId, userId]
      )

      if (liked.length > 0) {
        await conn.query('DELETE FROM post_likes WHERE post_id = ? AND user_id = ?', [postId, userId])
        await conn.query(
          'UPDATE posts SET like_count = GREATEST(like_count - 1, 0) WHERE id = ?',
          [postId]
        )
      } else {
        await conn.query('INSERT INTO post_likes (post_id, user_id) VALUES (?, ?)', [postId, userId])
        await conn.query('UPDATE posts SET like_count = like_count + 1 WHERE id = ?', [postId])
      }

      await conn.commit()

      const [rows] = await conn.query<PostRow[]>(
        `SELECT p.*, u.username
         FROM posts p
         LEFT JOIN users u ON p.user_id = u.id
         WHERE p.id = ? LIMIT 1`,
        [postId]
      )
      return rows[0] ? { ...mapPost(rows[0]), liked: liked.length === 0 } : null
    } catch (error) {
      await conn.rollback()
      throw error
    } finally {
      conn.release()
    }
  }

  const checkUserLikedPost = async (postId: number, userId: number): Promise<boolean> => {
    const [rows] = await db.query<RowDataPacket[]>(
      'SELECT id FROM post_likes WHERE post_id = ? AND user_id = ? LIMIT 1',
      [postId, userId]
    )
    return rows.length > 0
  }

  // --- Comments ---
  const createComment = async (input: CreateCommentInput): Promise<CommentDto> => {
    const [result] = await db.query<ResultSetHeader>(
      'INSERT INTO comments (post_id, user_id, content, is_anonymous) VALUES (?, ?, ?, ?)',
      [input.postId, input.userId, input.content, input.isAnonymous ? 1 : 0]
    )
    const [rows] = await db.query<CommentRow[]>(
      'SELECT * FROM comments WHERE id = ? LIMIT 1',
      [result.insertId]
    )
    return mapComment(rows[0])
  }

  const findCommentsByPostId = async (postId: number): Promise<CommentDto[]> => {
    const [rows] = await db.query<CommentRow[]>(
      `SELECT c.*, u.username
       FROM comments c
       LEFT JOIN users u ON c.user_id = u.id
       WHERE c.post_id = ?
       ORDER BY c.created_at ASC`,
      [postId]
    )
    return rows.map(mapComment)
  }

  const likeComment = async (commentId: number, userId: number): Promise<CommentDto | null> => {
    const conn = await db.getConnection()
    try {
      await conn.beginTransaction()

      const [liked] = await conn.query<RowDataPacket[]>(
        'SELECT id FROM comment_likes WHERE comment_id = ? AND user_id = ? LIMIT 1',
        [commentId, userId]
      )

      if (liked.length > 0) {
        await conn.query('DELETE FROM comment_likes WHERE comment_id = ? AND user_id = ?', [commentId, userId])
        await conn.query(
          'UPDATE comments SET like_count = GREATEST(like_count - 1, 0) WHERE id = ?',
          [commentId]
        )
      } else {
        await conn.query('INSERT INTO comment_likes (comment_id, user_id) VALUES (?, ?)', [commentId, userId])
        await conn.query('UPDATE comments SET like_count = like_count + 1 WHERE id = ?', [commentId])
      }

      await conn.commit()

      const [rows] = await conn.query<CommentRow[]>(
        `SELECT c.*, u.username
         FROM comments c
         LEFT JOIN users u ON c.user_id = u.id
         WHERE c.id = ? LIMIT 1`,
        [commentId]
      )
      return rows[0] ? { ...mapComment(rows[0]), liked: liked.length === 0 } : null
    } catch (error) {
      await conn.rollback()
      throw error
    } finally {
      conn.release()
    }
  }

  const checkUserLikedComment = async (commentId: number, userId: number): Promise<boolean> => {
    const [rows] = await db.query<RowDataPacket[]>(
      'SELECT id FROM comment_likes WHERE comment_id = ? AND user_id = ? LIMIT 1',
      [commentId, userId]
    )
    return rows.length > 0
  }

  const deleteById = async (id: number): Promise<void> => {
    await db.query('UPDATE posts SET deleted_at = NOW() WHERE id = ? AND deleted_at IS NULL', [id])
  }

  // --- AI Replies ---
  const saveAiReply = async (postId: number, content: string): Promise<AiReplyDto> => {
    const [result] = await db.query<ResultSetHeader>(
      'INSERT INTO ai_replies (post_id, content) VALUES (?, ?)',
      [postId, content]
    )
    const [rows] = await db.query<AiReplyRow[]>(
      'SELECT * FROM ai_replies WHERE id = ? LIMIT 1',
      [result.insertId]
    )
    return mapAiReply(rows[0])
  }

  const getAiReply = async (postId: number): Promise<AiReplyDto | null> => {
    const [rows] = await db.query<AiReplyRow[]>(
      'SELECT * FROM ai_replies WHERE post_id = ? ORDER BY created_at DESC LIMIT 1',
      [postId]
    )
    return rows.length > 0 ? mapAiReply(rows[0]) : null
  }

  return {
    createPost, findPosts, findPostById, findPendingPosts, getAuditStats, auditPost,
    likePost, checkUserLikedPost,
    createComment, findCommentsByPostId, likeComment, checkUserLikedComment,
    deleteById,
    saveAiReply, getAiReply,
  }
}

export type PostRepository = ReturnType<typeof createPostRepository>