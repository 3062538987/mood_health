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
      return res.status(400).json({ code: 400, message: "请提供用户名、密码和邮箱" });
    }

    // 检查用户名是否已存在
    const existingUser = await findUserByUsername(username);
    if (existingUser) {
      return res
        .status(400)
        .json({ code: 400, message: `用户名 "${username}" 已存在，请更换其他用户名` });
    }

    // 检查邮箱是否已存在
    const existingEmail = await findUserByEmail(email);
    if (existingEmail) {
      return res
        .status(400)
        .json({ code: 400, message: `邮箱 "${email}" 已被注册，请更换其他邮箱` });
    }

    // 创建新用户
    await createUser(username, password, email);
    // 返回成功响应
    res.status(201).json({ code: 0, message: "注册成功" });
  } catch (error: any) {
    // 捕获并记录错误
    console.error(error);
    // 返回服务器错误响应
    res.status(500).json({ code: 500, message: "服务器错误" });
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
      return res.status(400).json({ code: 400, message: "请提供用户名和密码" });
    }

    // 查找用户
    const user = await findUserByUsername(username);
    if (!user) {
      return res.status(401).json({ code: 401, message: "用户名或密码错误" });
    }

    // 验证密码
    const isValid = await comparePassword(password, user.password);
    if (!isValid) {
      return res.status(401).json({ code: 401, message: "用户名或密码错误" });
    }

    // 生成 JWT 令牌
    const token = jwt.sign(
      { userId: user.id, username: user.username, role: user.role || "user" },
      process.env.JWT_SECRET!,
      { expiresIn: "7d" },
    );

    // 返回用户信息（不含密码）
    const { password: _, ...userInfo } = user;
    res.json({ code: 0, data: { token, user: userInfo } });
  } catch (error) {
    // 捕获并记录错误
    console.error(error);
    // 返回服务器错误响应
    res.status(500).json({ code: 500, message: "服务器错误" });
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
      return res.status(401).json({ code: 401, message: "未登录" });
    }

    // 查找用户信息
    const user = await findUserById(req.user.userId);
    if (!user) {
      return res.status(404).json({ code: 404, message: "用户不存在" });
    }

    // 返回用户信息
    res.json({ code: 0, data: { user } });
  } catch (error) {
    // 捕获并记录错误
    console.error(error);
    // 返回服务器错误响应
    res.status(500).json({ code: 500, message: "服务器错误" });
  }
};
