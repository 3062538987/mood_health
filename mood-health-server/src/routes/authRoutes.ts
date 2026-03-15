/**
 * 认证路由模块
 * 提供用户注册、登录、获取用户信息等认证相关接口
 * 
 * @module authRoutes
 */

import { Router } from 'express';
import { body } from 'express-validator';
import { register, login, getMe } from '../controllers/authController';
import { authenticate } from '../middleware/auth';
import { validateRequest } from '../middleware/validateRequest';

const router = Router();

/**
 * 用户注册接口
 * @route POST /api/auth/register
 * @description 创建新用户账号
 * @access 公开
 * @param {string} username - 用户名，至少3个字符
 * @param {string} email - 邮箱地址，必须为有效邮箱格式
 * @param {string} password - 密码，至少6个字符
 * @returns {Object} 201 - 注册成功
 * @returns {Object} 400 - 参数错误或用户已存在
 * @returns {Object} 500 - 服务器错误
 * @example
 * POST /api/auth/register
 * {
 *   "username": "testuser",
 *   "email": "test@example.com",
 *   "password": "password123"
 * }
 */
router.post(
  '/register',
  [
    body('username').isLength({ min: 3 }).withMessage('用户名至少3个字符'),
    body('email').isEmail().withMessage('请输入有效邮箱'),
    body('password').isLength({ min: 6 }).withMessage('密码至少6个字符')
  ],
  validateRequest,
  register
);

/**
 * 用户登录接口
 * @route POST /api/auth/login
 * @description 用户登录并获取访问令牌
 * @access 公开
 * @param {string} username - 用户名
 * @param {string} password - 密码
 * @returns {Object} 200 - 登录成功，返回token和用户信息
 * @returns {Object} 400 - 参数错误
 * @returns {Object} 401 - 用户名或密码错误
 * @returns {Object} 500 - 服务器错误
 * @example
 * POST /api/auth/login
 * {
 *   "username": "testuser",
 *   "password": "password123"
 * }
 */
router.post(
  '/login',
  [
    body('username').notEmpty().withMessage('用户名不能为空'),
    body('password').notEmpty().withMessage('密码不能为空')
  ],
  validateRequest,
  login
);

/**
 * 获取当前用户信息接口
 * @route GET /api/auth/me
 * @description 获取当前登录用户的详细信息
 * @access 需要认证
 * @header {string} Authorization - Bearer token
 * @returns {Object} 200 - 成功返回用户信息
 * @returns {Object} 401 - 未登录或token无效
 * @returns {Object} 404 - 用户不存在
 * @returns {Object} 500 - 服务器错误
 * @example
 * GET /api/auth/me
 * Headers: { "Authorization": "Bearer eyJhbGciOiJIUzI1NiIs..." }
 */
router.get('/me', authenticate, getMe);

export default router;
