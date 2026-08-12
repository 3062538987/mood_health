import { PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2'
import { getMysqlPool } from '../config/mysql'
import logger from '../utils/logger'

export type UserRoleCode = 'student' | 'counselor' | 'super_admin'
export type UserStatus = 'active' | 'disabled'

export interface MysqlExecutor {
  query<T>(sql: string, params?: unknown[]): Promise<[T, unknown]>
}

export interface AuthUser {
  id: number
  username: string
  passwordHash: string
  email: string
  nickname: string | null
  avatarUrl: string | null
  status: UserStatus
  role: UserRoleCode
  createdAt: Date
  updatedAt: Date
  lastLoginAt: Date | null
}

export interface PublicUser {
  id: number
  username: string
  email: string
  nickname: string | null
  avatarUrl: string | null
  status: UserStatus
  role: UserRoleCode
  createdAt: Date
  updatedAt: Date
  lastLoginAt: Date | null
}

export interface CreateStudentUserInput {
  username: string
  passwordHash: string
  email: string
  nickname?: string | null
}

export interface UpdateUserProfileInput {
  username: string
  avatarUrl: string | null
}

type UserRow = RowDataPacket & {
  id: number
  username: string
  password_hash: string
  email: string
  nickname: string | null
  avatar_url: string | null
  status: UserStatus
  role_code: UserRoleCode
  created_at: Date
  updated_at: Date
  last_login_at: Date | null
}

type RoleIdRow = RowDataPacket & {
  id: number
}

export class DuplicateUserError extends Error {
  constructor() {
    super('用户名或邮箱已存在')
    this.name = 'DuplicateUserError'
  }
}

export class MissingRoleError extends Error {
  constructor(roleCode: UserRoleCode) {
    super(`缺少系统角色: ${roleCode}`)
    this.name = 'MissingRoleError'
  }
}

const isDuplicateEntryError = (error: unknown): boolean => {
  if (!error || typeof error !== 'object') return false
  const candidate = error as { code?: unknown; errno?: unknown }
  return candidate.code === 'ER_DUP_ENTRY' || candidate.errno === 1062
}

const mapAuthUser = (row: UserRow): AuthUser => ({
  id: Number(row.id),
  username: row.username,
  passwordHash: row.password_hash,
  email: row.email,
  nickname: row.nickname,
  avatarUrl: row.avatar_url,
  status: row.status,
  role: row.role_code,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  lastLoginAt: row.last_login_at,
})

const publicFieldsSql = `
  u.id,
  u.username,
  u.email,
  u.nickname,
  u.avatar_url,
  u.status,
  r.code AS role_code,
  u.created_at,
  u.updated_at,
  u.last_login_at
`

const authFieldsSql = `
  ${publicFieldsSql},
  u.password_hash
`

export const createUserRepository = (db: MysqlExecutor = getMysqlPool()) => {
  const findAuthUserByUsername = async (username: string): Promise<AuthUser | null> => {
    const [rows] = await db.query<UserRow[]>(
      `
      SELECT ${authFieldsSql}
      FROM users u
      JOIN roles r ON r.id = u.role_id
      WHERE u.username = ?
        AND u.status = ?
      LIMIT 1
      `,
      [username, 'active']
    )

    return rows.length > 0 ? mapAuthUser(rows[0]) : null
  }

  const findPublicUserById = async (id: number): Promise<PublicUser | null> => {
    const [rows] = await db.query<UserRow[]>(
      `
      SELECT ${publicFieldsSql}
      FROM users u
      JOIN roles r ON r.id = u.role_id
      WHERE u.id = ?
      LIMIT 1
      `,
      [id]
    )

    if (rows.length === 0) return null
    const { passwordHash: _passwordHash, ...publicUser } = mapAuthUser(rows[0])
    return publicUser
  }

  const createStudentUser = async (input: CreateStudentUserInput): Promise<number> => {
    const [roleRows] = await db.query<RoleIdRow[]>(
      `
      SELECT id
      FROM roles
      WHERE code = ?
      LIMIT 1
      `,
      ['student']
    )

    if (roleRows.length === 0) {
      throw new MissingRoleError('student')
    }

    try {
      const [result] = await db.query<ResultSetHeader>(
        `
        INSERT INTO users (
          role_id,
          username,
          password_hash,
          email,
          nickname,
          created_at,
          updated_at
        )
        VALUES (?, ?, ?, ?, ?, UTC_TIMESTAMP(3), UTC_TIMESTAMP(3))
        `,
        [roleRows[0].id, input.username, input.passwordHash, input.email, input.nickname ?? null]
      )

      return Number(result.insertId)
    } catch (error) {
      if (isDuplicateEntryError(error)) {
        throw new DuplicateUserError()
      }
      throw error
    }
  }

  const updateLastLoginAt = async (id: number): Promise<void> => {
    await db.query<ResultSetHeader>(
      `
      UPDATE users
      SET last_login_at = UTC_TIMESTAMP(3),
          updated_at = UTC_TIMESTAMP(3)
      WHERE id = ?
      `,
      [id]
    )
  }

  const updateProfile = async (
    id: number,
    input: UpdateUserProfileInput
  ): Promise<PublicUser | null> => {
    try {
      await db.query<ResultSetHeader>(
        `UPDATE users
         SET username = ?, avatar_url = ?, updated_at = UTC_TIMESTAMP(3)
         WHERE id = ? AND status = 'active'`,
        [input.username, input.avatarUrl, id]
      )
    } catch (error) {
      if (isDuplicateEntryError(error)) throw new DuplicateUserError()
      throw error
    }
    return findPublicUserById(id)
  }

  const disableUser = async (id: number): Promise<boolean> => {
    const [result] = await db.query<ResultSetHeader>(
      `UPDATE users SET status = 'disabled', updated_at = UTC_TIMESTAMP(3) WHERE id = ? AND status = 'active'`,
      [id]
    )
    return result.affectedRows > 0
  }

  const deleteUser = async (id: number): Promise<{ deleted: boolean; username: string | null }> => {
    const pool = getMysqlPool()
    const connection = await pool.getConnection()

    try {
      await connection.beginTransaction()

      const [rows] = await connection.query<UserRow[]>(
        'SELECT username FROM users WHERE id = ? LIMIT 1',
        [id]
      )
      if (rows.length === 0) {
        await connection.rollback()
        return { deleted: false, username: null }
      }
      const username = rows[0].username

      logger.warn('删除用户及关联数据', { userId: id, username })

      // 1. 删除 case_interventions（RESTRICT FK 必须先删）
      await connection.query<ResultSetHeader>(
        'DELETE FROM case_interventions WHERE counselor_user_id = ? OR case_id IN (SELECT id FROM cases WHERE student_user_id = ?)',
        [id, id]
      )

      // 2. 删除 cases（RESTRICT FK 必须先删）
      await connection.query<ResultSetHeader>(
        'DELETE FROM cases WHERE student_user_id = ?',
        [id]
      )

      // 3. 删除 audit_logs（SET NULL，显式删除更安全）
      await connection.query<ResultSetHeader>(
        'DELETE FROM audit_logs WHERE actor_user_id = ?',
        [id]
      )

      // 4. 删除用户（CASCADE 自动清理 moods、mood_emotions、mood_tags、
      //    assessment_sessions、assessment_answers、activities、relax_records、
      //    achievements、ai_analysis_history、tags、post_likes、comment_likes 等）
      await connection.query<ResultSetHeader>(
        'DELETE FROM users WHERE id = ?',
        [id]
      )

      await connection.commit()
      return { deleted: true, username }
    } catch (error) {
      await connection.rollback()
      throw error
    } finally {
      connection.release()
    }
  }

  return {
    findAuthUserByUsername,
    findPublicUserById,
    createStudentUser,
    updateLastLoginAt,
    updateProfile,
    disableUser,
    deleteUser,
  }
}

export type UserRepository = ReturnType<typeof createUserRepository>
