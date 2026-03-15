import pool from "../config/database";
import {
  hashPassword,
  comparePassword as comparePasswordUtil,
} from "../utils/password";
import sql from "mssql";

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
  id: number;
  username: string;
  password: string;
  email: string;
  avatar?: string;
  role: string;
  created_at: Date;
  updated_at: Date;
}

/**
 * 创建用户（密码加密）
 * @param {string} username - 用户名
 * @param {string} password - 密码
 * @param {string} email - 邮箱
 * @returns {Promise<number>} - 新用户的ID
 */
export const createUser = async (
  username: string,
  password: string,
  email: string,
) => {
  // 对密码进行加密
  const hashedPassword = await hashPassword(password);
  // 插入用户数据并返回新用户ID
  const result = await pool
    .request()
    .input("username", sql.NVarChar, username)
    .input("password", sql.NVarChar, hashedPassword)
    .input("email", sql.NVarChar, email).query(`
      INSERT INTO users (username, password, email)
      OUTPUT INSERTED.id
      VALUES (@username, @password, @email)
    `);
  return result.recordset[0].id; // 返回新用户的ID
};

/**
 * 根据用户名查找用户
 * @param {string} username - 用户名
 * @returns {Promise<User | null>} - 用户对象或null
 */
export const findUserByUsername = async (
  username: string,
): Promise<User | null> => {
  const result = await pool
    .request()
    .input("username", sql.NVarChar, username)
    .query("SELECT * FROM users WHERE username = @username");
  return result.recordset.length ? result.recordset[0] : null;
};

/**
 * 根据邮箱查找用户
 * @param {string} email - 邮箱
 * @returns {Promise<User | null>} - 用户对象或null
 */
export const findUserByEmail = async (email: string): Promise<User | null> => {
  const result = await pool
    .request()
    .input("email", sql.NVarChar, email)
    .query("SELECT * FROM users WHERE email = @email");
  return result.recordset.length ? result.recordset[0] : null;
};

/**
 * 根据ID查找用户（返回不包含密码的字段）
 * @param {number} id - 用户ID
 * @returns {Promise<Omit<User, "password"> | null>} - 不含密码的用户对象或null
 */
export const findUserById = async (
  id: number,
): Promise<Omit<User, "password"> | null> => {
  const result = await pool.request().input("id", sql.Int, id).query(`
      SELECT id, username, email, avatar, role, created_at, updated_at
      FROM users
      WHERE id = @id
    `);
  return result.recordset.length ? result.recordset[0] : null;
};

/**
 * 更新用户角色
 * @param {number} id - 用户ID
 * @param {string} role - 新角色
 * @returns {Promise<sql.IProcedureResult<any>>} - 数据库操作结果
 */
export const updateUserRole = async (id: number, role: string) => {
  const result = await pool
    .request()
    .input("id", sql.Int, id)
    .input("role", sql.NVarChar, role).query(`
      UPDATE users
      SET role = @role,
          updated_at = GETDATE()
      WHERE id = @id
    `);
  return result;
};

/**
 * 密码比对
 * @param {string} password - 明文密码
 * @param {string} hashedPassword - 加密后的密码
 * @returns {Promise<boolean>} - 密码是否匹配
 */
export const comparePassword = async (
  password: string,
  hashedPassword: string,
) => {
  return comparePasswordUtil(password, hashedPassword);
};
