/**
 * 用户接口
 * @interface User
 * @property {number} id - 用户ID
 * @property {string} username - 用户名
 * @property {string} email - 邮箱
 * @property {string} [role] - 用户角色（可选）
 * @property {string} [avatar] - 头像（可选）
 * @property {string} [created_at] - 创建时间（可选）
 */
export interface User {
  id: number
  username: string
  email: string
  role?: string
  avatar?: string
  created_at?: string
}

/**
 * 登录请求接口
 * @interface LoginRequest
 * @property {string} username - 用户名
 * @property {string} password - 密码
 */
export interface LoginRequest {
  username: string
  password: string
}

/**
 * 注册请求接口
 * @interface RegisterRequest
 * @property {string} username - 用户名
 * @property {string} password - 密码
 * @property {string} email - 邮箱
 */
export interface RegisterRequest {
  username: string
  password: string
  email: string
}

/**
 * 登录响应接口
 * @interface LoginResponse
 * @property {string} token - JWT 令牌
 * @property {User} user - 用户信息
 */
export interface LoginResponse {
  token: string
  user: User
}
