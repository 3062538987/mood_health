import winston from "winston";
import DailyRotateFile from "winston-daily-rotate-file";

/**
 * 企业级日志系统
 * 使用 winston + winston-daily-rotate-file 实现
 * 按天自动切割日志文件，保存 14 天
 */

// 日志级别配置
const logLevel = process.env.NODE_ENV === "production" ? "info" : "debug";

// 自定义控制台日志格式（带颜色）
const consoleFormat = winston.format.combine(
  winston.format.colorize({
    all: true,
    colors: {
      info: "green",
      warn: "yellow",
      error: "red",
    },
  }),
  winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
  winston.format.printf(({ timestamp, level, message, stack }) => {
    return stack
      ? `${timestamp} [${level}]: ${message}\n${stack}`
      : `${timestamp} [${level}]: ${message}`;
  }),
);

// 自定义文件日志格式
const fileFormat = winston.format.combine(
  winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
  winston.format.json(),
);

const logger = winston.createLogger({
  level: logLevel,
  format: fileFormat,
  transports: [
    // 按天切割的文件传输
    new DailyRotateFile({
      filename: "logs/app-%DATE%.log",
      datePattern: "YYYY-MM-DD",
      maxFiles: "14d",
      maxSize: "20m",
      zippedArchive: true,
    }),
    // 错误日志单独存储
    new DailyRotateFile({
      filename: "logs/error-%DATE%.log",
      datePattern: "YYYY-MM-DD",
      maxFiles: "14d",
      maxSize: "20m",
      zippedArchive: true,
      level: "error",
    }),
  ],
});

// 开发环境添加控制台输出
if (process.env.NODE_ENV !== "production") {
  logger.add(
    new winston.transports.Console({
      format: consoleFormat,
    }),
  );
}

export default logger;
