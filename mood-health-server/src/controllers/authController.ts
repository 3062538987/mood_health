import { AuthRequest } from "../middleware/auth";
import { Request, Response } from "express";
import jwt from "jsonwebtoken";
import {
  createUser,
  findUserByUsername,
  findUserByEmail,
  comparePassword,
  findUserById,
} from "../models/userModel";
import dotenv from "dotenv";
import { BusinessError, HttpException } from "../utils/errors";

dotenv.config();

/**
 * 用户注册
 * @param req 请求对象，包含用户名、密码和邮箱
 * @param res 响应对象，返回注册结果
 * @returns 201状态码表示注册成功，400表示参数错误，500表示服务器错误
 */
export const register = async (req: Request, res: Response) => {
  try {
    // 从请求体中获取注册信息
    const { username, password, email } = req.body;

    // 简单校验
    if (!username || !password || !email) {
      throw new BusinessError(
        "请提供用户名、密码和邮箱",
        null,
        req.originalUrl,
      );
    }

    // 检查用户名是否已存在
    const existingUser = await findUserByUsername(username);
    if (existingUser) {
      throw new BusinessError(
        `用户名 "${username}" 已存在，请更换其他用户名`,
        null,
        req.originalUrl,
      );
    }

    // 检查邮箱是否已存在
    const existingEmail = await findUserByEmail(email);
    if (existingEmail) {
      throw new BusinessError(
        `邮箱 "${email}" 已被注册，请更换其他邮箱`,
        null,
        req.originalUrl,
      );
    }

    // 创建新用户
    await createUser(username, password, email);
    // 返回成功响应
    res.status(201).json({ code: 0, message: "注册成功" });
  } catch (error: any) {
    // 捕获并记录错误
    console.error(error);
    // 让错误处理中间件处理错误
    throw error;
  }
};

/**
 * 用户登录
 * @param req 请求对象，包含用户名和密码
 * @param res 响应对象，返回登录结果和JWT令牌
 * @returns 200状态码表示登录成功，400表示参数错误，401表示认证失败，500表示服务器错误
 */
export const login = async (req: Request, res: Response) => {
  try {
    // 从请求体中获取登录信息
    const { username, password } = req.body;

    // 简单校验
    if (!username || !password) {
      throw new BusinessError("请提供用户名和密码", null, req.originalUrl);
    }

    // 查找用户
    const user = await findUserByUsername(username);
    if (!user) {
      throw new HttpException("用户名或密码错误", 401, null, req.originalUrl);
    }

    // 验证密码
    const isValid = await comparePassword(password, user.password);
    if (!isValid) {
      throw new HttpException("用户名或密码错误", 401, null, req.originalUrl);
    }

    // 生成 JWT 令牌
    if (!process.env.JWT_SECRET) {
      throw new HttpException("JWT 密钥未配置", 500, null, req.originalUrl);
    }

    const token = jwt.sign(
      { userId: user.id, username: user.username, role: user.role || "user" },
      process.env.JWT_SECRET,
      { expiresIn: "7d" },
    );

    // 返回用户信息（不含密码）
    const { password: _, ...userInfo } = user;
    res.json({ code: 0, data: { token, user: userInfo } });
  } catch (error: any) {
    // 捕获并记录错误
    console.error(error);
    // 让错误处理中间件处理错误
    throw error;
  }
};

/**
 * 获取当前登录用户信息
 * @param req 请求对象，包含用户信息
 * @param res 响应对象，返回用户信息
 * @returns 200状态码表示成功，401表示未登录，404表示用户不存在，500表示服务器错误
 */
export const getMe = async (req: AuthRequest, res: Response) => {
  try {
    // 检查用户是否已登录
    if (!req.user) {
      throw new HttpException("未登录", 401, null, req.originalUrl);
    }

    // 查找用户信息
    const user = await findUserById(req.user.userId);
    if (!user) {
      throw new HttpException("用户不存在", 404, null, req.originalUrl);
    }

    // 返回用户信息
    res.json({ code: 0, data: { user } });
  } catch (error: any) {
    // 捕获并记录错误
    console.error(error);
    // 让错误处理中间件处理错误
    throw error;
  }
};
