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

const ensureCommentSchema = () => {
  if (commentSchemaChecked) return

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
}

export const createComment = async (params: CreateCommentParams) => {
  ensureCommentSchema()
  const result = sqliteRun(
    'INSERT INTO comments (post_id, user_id, content, is_anonymous) VALUES (?, ?, ?, ?)',
    [params.post_id, params.user_id, params.content, params.isAnonymous ? 1 : 0]
  )
  return sqliteGet('SELECT * FROM comments WHERE id = ?', [Number(result.lastInsertRowid)])
}

export const getCommentsByPostId = async (postId: number) => {
  ensureCommentSchema()
  return sqliteAll(
    `
      SELECT c.*, u.username
      FROM comments c
      LEFT JOIN users u ON c.user_id = u.id
      WHERE c.post_id = ?
      ORDER BY datetime(c.created_at) ASC
    `,
    [postId]
  )
}

export const likeComment = async (id: number, userId: number) => {
  ensureCommentSchema()
  return sqliteTransaction(() => {
    const liked = sqliteGet(
      'SELECT id FROM comment_likes WHERE comment_id = ? AND user_id = ?',
      [id, userId]
    )
    if (liked) {
      sqliteRun('DELETE FROM comment_likes WHERE comment_id = ? AND user_id = ?', [id, userId])
      sqliteRun(
        'UPDATE comments SET like_count = CASE WHEN like_count > 0 THEN like_count - 1 ELSE 0 END WHERE id = ?',
        [id]
      )
    } else {
      sqliteRun('INSERT INTO comment_likes (comment_id, user_id) VALUES (?, ?)', [id, userId])
      sqliteRun('UPDATE comments SET like_count = like_count + 1 WHERE id = ?', [id])
    }
    const comment = sqliteGet('SELECT * FROM comments WHERE id = ?', [id])
    return comment ? { ...(comment as Record<string, unknown>), liked: !liked } : null
  })
}

export const checkUserLikedComment = async (commentId: number, userId: number) => {
  ensureCommentSchema()
  return Boolean(
    sqliteGet('SELECT id FROM comment_likes WHERE comment_id = ? AND user_id = ?', [
      commentId,
      userId,
    ])
  )
}
