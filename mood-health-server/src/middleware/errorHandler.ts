import { Request, Response, NextFunction } from "express";
import logger from "../utils/logger";
import { AppError } from "../utils/errors";

/**
 * 全局错误处理中间件
 * @param err 错误对象
 * @param req 请求对象
 * @param res 响应对象
 * @param next 下一个中间件
 */
export const errorHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  // 构建错误信息
  const errorInfo = {
    message: err.message || "服务器内部错误",
    statusCode: err.statusCode || 500,
    path: req.originalUrl,
    method: req.method,
    timestamp: new Date().toISOString(),
    stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
    data: err.data || null,
  };

  // 记录错误日志
  if (err.statusCode >= 500) {
    logger.error(`[${req.method}] ${req.originalUrl}`, errorInfo);
  } else if (err.statusCode >= 400) {
    logger.warn(`[${req.method}] ${req.originalUrl}`, errorInfo);
  } else {
    logger.info(`[${req.method}] ${req.originalUrl}`, errorInfo);
  }

  // 统一返回格式
  const response = {
    success: false,
    code: errorInfo.statusCode,
    message: errorInfo.message,
    path: errorInfo.path,
    timestamp: errorInfo.timestamp,
  };

  // 处理验证错误
  if (err.name === "ValidationError") {
    return res.status(400).json({
      ...response,
      code: 400,
      message: "请求参数验证失败",
    });
  }

  // 处理 express-validator 错误
  if (err.array) {
    return res.status(400).json({
      ...response,
      code: 400,
      message: "请求参数验证失败",
    });
  }

  // 处理自定义错误
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      code: err.statusCode,
      message: err.message,
      path: err.path || req.originalUrl,
      timestamp: err.timestamp || new Date().toISOString(),
    });
  }

  // 处理其他错误
  res.status(errorInfo.statusCode).json(response);
};

/**
 * 404 处理中间件
 * @param req 请求对象
 * @param res 响应对象
 * @param next 下一个中间件
 */
export const notFoundHandler = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const error = new AppError("请求的资源不存在", 404, null, req.originalUrl);
  next(error);
};
