/**
 * 自定义错误类模块
 * 提供项目中使用的各种错误类型，用于统一错误处理
 */

/**
 * 基础错误类
 * 所有自定义错误类的父类，提供统一的错误格式
 */
export class AppError extends Error {
  public statusCode: number;
  public isOperational: boolean;
  public path: string;
  public timestamp: string;
  public data: unknown;

  constructor(
    message: string,
    statusCode: number,
    data: unknown = null,
    path: string = "",
  ) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    this.path = path;
    this.timestamp = new Date().toISOString();
    this.data = data;

    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * 业务错误类
 * 用于处理业务逻辑错误，如参数验证失败、资源不存在等
 * @example
 * throw new BusinessError("用户名已存在", null, "/api/auth/register");
 */
export class BusinessError extends AppError {
  constructor(message: string, data: unknown = null, path: string = "") {
    super(message, 400, data, path);
  }
}

/**
 * HTTP 异常类
 * 用于处理 HTTP 相关错误，如 401 未授权、404 未找到等
 * @example
 * throw new HttpException("未登录", 401, null, "/api/auth/me");
 */
export class HttpException extends AppError {
  constructor(
    message: string,
    statusCode: number,
    data: unknown = null,
    path: string = "",
  ) {
    super(message, statusCode, data, path);
  }
}

/**
 * 数据库错误类
 * 用于处理数据库操作错误，如连接失败、查询失败等
 * @example
 * throw new DatabaseError("数据库连接失败", error);
 */
export class DatabaseError extends AppError {
  public originalError: unknown;

  constructor(message: string, originalError: unknown, path: string = "") {
    super(message, 500, null, path);
    this.originalError = originalError;
  }
}

/**
 * Redis 错误类
 * 用于处理 Redis 操作错误，如连接失败、命令执行失败等
 * @example
 * throw new RedisError("Redis 命令执行失败", error);
 */
export class RedisError extends AppError {
  public originalError: unknown;

  constructor(message: string, originalError: unknown, path: string = "") {
    super(message, 500, null, path);
    this.originalError = originalError;
  }
}

/**
 * API 错误类
 * 用于处理第三方 API 调用错误，如网络错误、超时等
 * @example
 * throw new ApiError("API 调用失败", error, "https://api.example.com/data");
 */
export class ApiError extends AppError {
  public originalError: unknown;
  public apiUrl: string;

  constructor(
    message: string,
    originalError: unknown,
    apiUrl: string,
    path: string = "",
  ) {
    super(message, 500, null, path);
    this.originalError = originalError;
    this.apiUrl = apiUrl;
  }
}

/**
 * AI 服务错误类
 * 用于处理 AI 服务调用错误，如服务不可用、响应错误等
 * @example
 * throw new AiServiceError("AI 服务调用失败", error, "OpenAI");
 */
export class AiServiceError extends AppError {
  public originalError: unknown;
  public serviceName: string;

  constructor(
    message: string,
    originalError: unknown,
    serviceName: string,
    path: string = "",
  ) {
    super(message, 500, null, path);
    this.originalError = originalError;
    this.serviceName = serviceName;
  }
}
