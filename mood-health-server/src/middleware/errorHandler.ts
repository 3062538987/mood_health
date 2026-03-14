import { Request, Response, NextFunction } from 'express';

/**
 * 全局错误处理中间件
 * @param err 错误对象
 * @param req 请求对象
 * @param res 响应对象
 * @param next 下一个中间件
 */
export const errorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('Global Error:', err);
  
  // 处理验证错误
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      code: 400,
      message: '请求参数验证失败',
      details: err.errors
    });
  }
  
  // 处理 express-validator 错误
  if (err.array) {
    const errors = err.array();
    return res.status(400).json({
      code: 400,
      message: '请求参数验证失败',
      details: errors
    });
  }
  
  // 处理其他错误
  const statusCode = err.statusCode || 500;
  const message = err.message || '服务器内部错误';
  
  res.status(statusCode).json({
    code: statusCode,
    message: message,
    details: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
};
