import pool from '../config/database'
import { hashPassword, comparePassword as comparePasswordUtil } from '../utils/password'
import sql from 'mssql'
import { isSqliteClient } from '../config/database'
import { sqliteGet, sqliteRun, sqliteTransaction } from '../config/sqlite'

/**
 * 用户角色类型
 */
export type UserRole = 'user' | 'admin' | 'super_admin'

const USER_ROLES: readonly UserRole[] = ['user', 'admin', 'super_admin']

/**
 * 判断输入值是否为合法角色
 * @param {unknown} role - 待校验角色
 * @returns {role is UserRole} 是否为合法角色
 */
export const isValidUserRole = (role: unknown): role is UserRole => {
  return typeof role === 'string' && USER_ROLES.includes(role as UserRole)
}

/**
 * 判断是否为超级管理员
 * @param {unknown} role - 待校验角色
 * @returns {boolean} 是否为超级管理员
 */
export const isSuperAdmin = (role: unknown): boolean => {
  return role === 'super_admin'
}

/**
 * 判断是否具备管理员权限（admin 或 super_admin）
 * @param {unknown} role - 待校验角色
 * @returns {boolean} 是否具备管理员权限
 */
export const isAdmin = (role: unknown): boolean => {
  return role === 'admin' || role === 'super_admin'
}

/**
 * 用户接口
 * @interface User
 * @property {number} id - 用户ID
 * @property {string} username - 用户名
 * @property {string} password - 密码（加密后）
 * @property {string} email - 邮箱
 * @property {string} [avatar] - 头像（可选）
 * @property {string} role - 用户角色
 * @property {Date} created_at - 创建时间
 * @property {Date} updated_at - 更新时间
 */
export interface User {
  id: number
  username: string
  password: string
  email: string
  avatar?: string
  role: UserRole
  created_at: Date
  updated_at: Date
}

type UserPublic = Omit<User, 'password'>

type UpdateUserRoleResult = {
  rowsAffected: number[]
}

type DeleteUserResult = {
  rowsAffected: number[]
}

const normalizeRole = (role: unknown): UserRole => {
  return isValidUserRole(role) ? role : 'user'
}

const toDate = (value: unknown): Date => {
  if (value instanceof Date) {
    return value
  }

  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value)
    if (!Number.isNaN(parsed.getTime())) {
      return parsed
    }
  }

  return new Date()
}

const mapSqliteUser = (row: any): User => ({
  id: Number(row.id),
  username: String(row.username),
  password: String(row.password),
  email: String(row.email),
  avatar: row.avatar || undefined,
  role: normalizeRole(row.role),
  created_at: toDate(row.created_at),
  updated_at: toDate(row.updated_at),
})

const mapSqliteUserPublic = (row: any): UserPublic => ({
  id: Number(row.id),
  username: String(row.username),
  email: String(row.email),
  avatar: row.avatar || undefined,
  role: normalizeRole(row.role),
  created_at: toDate(row.created_at),
  updated_at: toDate(row.updated_at),
})

/**
 * 创建用户（密码加密）
 * @param {string} username - 用户名
 * @param {string} password - 密码
 * @param {string} email - 邮箱
 * @returns {Promise<number>} - 新用户的ID
 */
export const createUser = async (username: string, password: string, email: string) => {
  // 对密码进行加密
  const hashedPassword = await hashPassword(password)

  if (isSqliteClient) {
    const result = sqliteRun(
      `
      INSERT INTO users (username, password, email)
      VALUES (?, ?, ?)
      `,
      [username, hashedPassword, email]
    )
    return Number(result.lastInsertRowid)
  }

  // 插入用户数据并返回新用户ID
  const result = await pool
    .request()
    .input('username', sql.NVarChar, username)
    .input('password', sql.NVarChar, hashedPassword)
    .input('email', sql.NVarChar, email).query(`
      INSERT INTO users (username, password, email)
      OUTPUT INSERTED.id
      VALUES (@username, @password, @email)
    `)
  return result.recordset[0].id // 返回新用户的ID
}

/**
 * 根据用户名查找用户
 * @param {string} username - 用户名
 * @returns {Promise<User | null>} - 用户对象或null
 */
export const findUserByUsername = async (username: string): Promise<User | null> => {
  if (isSqliteClient) {
    const row = sqliteGet('SELECT * FROM users WHERE username = ? LIMIT 1', [username])
    return row ? mapSqliteUser(row) : null
  }

  const result = await pool
    .request()
    .input('username', sql.NVarChar, username)
    .query('SELECT * FROM users WHERE username = @username')
  return result.recordset.length ? result.recordset[0] : null
}

/**
 * 根据邮箱查找用户
 * @param {string} email - 邮箱
 * @returns {Promise<User | null>} - 用户对象或null
 */
export const findUserByEmail = async (email: string): Promise<User | null> => {
  if (isSqliteClient) {
    const row = sqliteGet('SELECT * FROM users WHERE email = ? LIMIT 1', [email])
    return row ? mapSqliteUser(row) : null
  }

  const result = await pool
    .request()
    .input('email', sql.NVarChar, email)
    .query('SELECT * FROM users WHERE email = @email')
  return result.recordset.length ? result.recordset[0] : null
}

/**
 * 根据ID查找用户（返回不包含密码的字段）
 * @param {number} id - 用户ID
 * @returns {Promise<Omit<User, "password"> | null>} - 不含密码的用户对象或null
 */
export const findUserById = async (id: number): Promise<UserPublic | null> => {
  if (isSqliteClient) {
    const row = sqliteGet(
      `
      SELECT id, username, email, avatar, role, created_at, updated_at
      FROM users
      WHERE id = ?
      LIMIT 1
      `,
      [id]
    )
    return row ? mapSqliteUserPublic(row) : null
  }

  const result = await pool.request().input('id', sql.Int, id).query(`
      SELECT id, username, email, avatar, role, created_at, updated_at
      FROM users
      WHERE id = @id
    `)
  return result.recordset.length ? result.recordset[0] : null
}

/**
 * 更新用户角色
 * @param {number} id - 用户ID
 * @param {UserRole} role - 新角色
 * @returns {Promise<sql.IProcedureResult<any>>} - 数据库操作结果
 */
export const updateUserRole = async (id: number, role: UserRole): Promise<UpdateUserRoleResult> => {
  if (isSqliteClient) {
    const result = sqliteRun(
      `
      UPDATE users
      SET role = ?,
          updated_at = datetime('now', 'localtime')
      WHERE id = ?
      `,
      [role, id]
    )

    return { rowsAffected: [Number(result.changes || 0)] }
  }

  const result = await pool.request().input('id', sql.Int, id).input('role', sql.NVarChar, role)
    .query(`
      UPDATE users
      SET role = @role,
          updated_at = GETDATE()
      WHERE id = @id
    `)
  return result
}

/**
 * 删除用户及其关联数据
 * @param {number} id - 用户ID
 * @returns {Promise<DeleteUserResult>} - 数据库操作结果
 */
export const deleteUserById = async (id: number): Promise<DeleteUserResult> => {
  if (isSqliteClient) {
    const result = sqliteTransaction(() => {
      sqliteRun('DELETE FROM comment_likes WHERE user_id = ?', [id])
      sqliteRun(
        `
        DELETE FROM comment_likes
        WHERE comment_id IN (
          SELECT id FROM comments WHERE user_id = ? OR post_id IN (SELECT id FROM posts WHERE user_id = ?)
        )
        `,
        [id, id]
      )
      sqliteRun(
        `
        DELETE FROM comments
        WHERE user_id = ? OR post_id IN (SELECT id FROM posts WHERE user_id = ?)
        `,
        [id, id]
      )
      sqliteRun('DELETE FROM post_likes WHERE user_id = ?', [id])
      sqliteRun('DELETE FROM post_likes WHERE post_id IN (SELECT id FROM posts WHERE user_id = ?)', [id])
      sqliteRun('DELETE FROM activity_participants WHERE user_id = ?', [id])
      sqliteRun('DELETE FROM user_answers WHERE user_id = ?', [id])
      sqliteRun('DELETE FROM user_assessments WHERE user_id = ?', [id])
      sqliteRun('DELETE FROM user_achievements WHERE user_id = ?', [id])
      sqliteRun('DELETE FROM relax_records WHERE user_id = ?', [id])
      sqliteRun('DELETE FROM moods WHERE user_id = ?', [id])
      sqliteRun('DELETE FROM tags WHERE user_id = ? AND COALESCE(is_system, 0) = 0', [id])
      sqliteRun('DELETE FROM posts WHERE user_id = ?', [id])
      return sqliteRun('DELETE FROM users WHERE id = ?', [id])
    })

    return { rowsAffected: [Number(result.changes || 0)] }
  }

  const transaction = new sql.Transaction(pool)
  await transaction.begin()

  try {
    const request = transaction.request().input('userId', sql.Int, id)

    await request.query(`
      DELETE FROM comment_likes
      WHERE user_id = @userId
    `)

    await request.query(`
      DELETE FROM comment_likes
      WHERE comment_id IN (
        SELECT id FROM comments WHERE user_id = @userId OR post_id IN (SELECT id FROM posts WHERE user_id = @userId)
      )
    `)

    await request.query(`
      DELETE FROM comments
      WHERE user_id = @userId OR post_id IN (SELECT id FROM posts WHERE user_id = @userId)
    `)

    await request.query(`
      DELETE FROM post_likes
      WHERE user_id = @userId
    `)

    await request.query(`
      DELETE FROM post_likes
      WHERE post_id IN (SELECT id FROM posts WHERE user_id = @userId)
    `)

    await request.query(`
      DELETE FROM activity_participants
      WHERE user_id = @userId
    `)

    await request.query(`
      DELETE FROM user_answers
      WHERE user_id = @userId
    `)

    await request.query(`
      DELETE FROM user_assessments
      WHERE user_id = @userId
    `)

    await request.query(`
      DELETE FROM user_achievements
      WHERE user_id = @userId
    `)

    await request.query(`
      DELETE FROM relax_records
      WHERE user_id = @userId
    `)

    await request.query(`
      DELETE FROM moods
      WHERE user_id = @userId
    `)

    await request.query(`
      DELETE FROM tags
      WHERE user_id = @userId AND ISNULL(is_system, 0) = 0
    `)

    await request.query(`
      DELETE FROM posts
      WHERE user_id = @userId
    `)

    const result = await request.query(`
      DELETE FROM users
      WHERE id = @userId
    `)

    await transaction.commit()
    return result
  } catch (error) {
    await transaction.rollback()
    throw error
  }
}

/**
 * 密码比对
 * @param {string} password - 明文密码
 * @param {string} hashedPassword - 加密后的密码
 * @returns {Promise<boolean>} - 密码是否匹配
 */
export const comparePassword = async (password: string, hashedPassword: string) => {
  return comparePasswordUtil(password, hashedPassword)
}
