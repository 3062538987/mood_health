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

const ensurePostSchema = () => {
  if (postSchemaChecked) return

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
}

export const createPost = async (params: CreatePostParams) => {
  ensurePostSchema()
  const result = sqliteRun(
    'INSERT INTO posts (title, content, user_id, is_anonymous, status) VALUES (?, ?, ?, ?, ?)',
    [params.title, params.content, params.user_id, params.isAnonymous ? 1 : 0, 0]
  )
  return sqliteGet('SELECT * FROM posts WHERE id = ?', [Number(result.lastInsertRowid)])
}

export const getPosts = async (page: number = 1, pageSize: number = 10) => {
  ensurePostSchema()
  const safePage = page > 0 ? Math.floor(page) : 1
  const safePageSize = pageSize > 0 ? Math.min(Math.floor(pageSize), 50) : 10
  const offset = (safePage - 1) * safePageSize

  try {
    const totalRow = sqliteGet('SELECT COUNT(*) AS total FROM posts WHERE status = 1') as
      | { total: number }
      | undefined
    const list = sqliteAll(
      `
        SELECT p.*, u.username,
          (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id) AS comment_count
        FROM posts p
        LEFT JOIN users u ON p.user_id = u.id
        WHERE p.status = 1
        ORDER BY datetime(p.created_at) DESC
        LIMIT ? OFFSET ?
      `,
      [safePageSize, offset]
    )
    return { list, total: Number(totalRow?.total || 0) }
  } catch (error) {
    logger.error('获取帖子列表查询失败', { page, pageSize, error })
    throw error
  }
}

export const getPostById = async (id: number) => {
  ensurePostSchema()
  return (
    sqliteGet(
      `
        SELECT p.*, u.username
        FROM posts p
        LEFT JOIN users u ON p.user_id = u.id
        WHERE p.id = ?
      `,
      [id]
    ) || null
  )
}

export const getPendingPosts = async (
  page: number = 1,
  pageSize: number = 10,
  status: number = 0
) => {
  ensurePostSchema()
  const safePage = page > 0 ? Math.floor(page) : 1
  const safePageSize = pageSize > 0 ? Math.min(Math.floor(pageSize), 50) : 10
  const safeStatus = [0, 1, 2].includes(status) ? status : 0
  return sqliteAll(
    `
      SELECT p.*, u.username
      FROM posts p
      LEFT JOIN users u ON p.user_id = u.id
      WHERE p.status = ?
      ORDER BY datetime(p.created_at) DESC
      LIMIT ? OFFSET ?
    `,
    [safeStatus, safePageSize, (safePage - 1) * safePageSize]
  )
}

export const getPostAuditStats = async () => {
  ensurePostSchema()
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

export const auditPost = async (id: number, params: AuditPostParams) => {
  ensurePostSchema()
  const result = sqliteRun('UPDATE posts SET status = ?, audit_remark = ? WHERE id = ?', [
    params.status,
    params.audit_remark || null,
    id,
  ])
  return result.changes === 0 ? null : sqliteGet('SELECT * FROM posts WHERE id = ?', [id])
}

export const likePost = async (id: number, userId: number) => {
  ensurePostSchema()
  return sqliteTransaction(() => {
    const liked = sqliteGet('SELECT id FROM post_likes WHERE post_id = ? AND user_id = ?', [
      id,
      userId,
    ])
    if (liked) {
      sqliteRun('DELETE FROM post_likes WHERE post_id = ? AND user_id = ?', [id, userId])
      sqliteRun(
        'UPDATE posts SET like_count = CASE WHEN like_count > 0 THEN like_count - 1 ELSE 0 END WHERE id = ?',
        [id]
      )
    } else {
      sqliteRun('INSERT INTO post_likes (post_id, user_id) VALUES (?, ?)', [id, userId])
      sqliteRun('UPDATE posts SET like_count = like_count + 1 WHERE id = ?', [id])
    }
    const post = sqliteGet('SELECT * FROM posts WHERE id = ?', [id])
    return post ? { ...(post as Record<string, unknown>), liked: !liked } : null
  })
}

export const checkUserLiked = async (postId: number, userId: number) => {
  ensurePostSchema()
  return Boolean(
    sqliteGet('SELECT id FROM post_likes WHERE post_id = ? AND user_id = ?', [postId, userId])
  )
}
