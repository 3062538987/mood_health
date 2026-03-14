import express from "express";
import cors from "cors";
import helmet from "helmet";
import dotenv from "dotenv";
import morgan from "morgan";
import compression from "compression";
import rateLimit from "express-rate-limit";
import { connectDB, query } from "./config/database";
import authRoutes from "./routes/authRoutes";
import moodRoutes from "./routes/moodRoutes";
import activityRoutes from "./routes/activityRoutes";
import postRoutes from "./routes/postRoutes";
import questionnaireRoutes from "./routes/questionnaireRoutes";
import musicRoutes from "./routes/musicRoutes";
import courseRoutes from "./routes/courseRoutes";
import logger from "./utils/logger";
import { errorHandler } from "./middleware/errorHandler";

dotenv.config();

const app = express();

// 中间件
app.use(helmet());
app.use(
  cors({
    origin: [
      "http://localhost:3001",
      "http://localhost:3002",
      "http://localhost:3003",
      "http://localhost:5173",
    ],
    credentials: true,
  }),
);
app.use(express.json());
app.use(compression());

// 日志中间件
const morganFormat = process.env.NODE_ENV === "production" ? "combined" : "dev";
app.use(
  morgan(morganFormat, {
    stream: { write: (message) => logger.info(message.trim()) },
  }),
);

// 速率限制 - 开发环境放宽限制
const isDevelopment = process.env.NODE_ENV !== "production";
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分钟
  max: isDevelopment ? 100 : 5, // 开发环境100次，生产环境5次
  message: "请求过于频繁，请稍后再试",
});

// 路由
app.use("/api/auth/login", limiter);
app.use("/api/auth", authRoutes);
app.use("/api/moods", moodRoutes);
app.use("/api/activities", activityRoutes);
app.use("/api/posts", postRoutes);
app.use("/api/questionnaires", questionnaireRoutes);
app.use("/api/music", musicRoutes);
app.use("/api/courses", courseRoutes);

// 健康检查接口
app.get("/health", async (req, res) => {
  try {
    // 测试 SQL Server 连接
    const result = await query("SELECT 1 + 1 AS result");
    res.json({
      status: "ok",
      database: "connected",
      result: result,
    });
  } catch (error) {
    console.error("数据库连接失败:", error);
    res.status(500).json({
      status: "error",
      database: "disconnected",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// 启动服务器
const PORT = process.env.PORT || 3000;

const startServer = async () => {
  try {
    // 先连接数据库
    await connectDB();

    // 再启动服务器
    app.listen(PORT, () => {
      console.log(`🚀 服务器运行在 http://localhost:${PORT}`);
      console.log(`📊 健康检查: http://localhost:${PORT}/health`);
      console.log(`🔐 认证路由: http://localhost:${PORT}/api/auth`);
      console.log(`📋 问卷路由: http://localhost:${PORT}/api/questionnaires`);
    });
  } catch (error) {
    console.error("服务器启动失败:", error);
    process.exit(1);
  }
};

// 全局错误处理中间件
app.use(errorHandler);

startServer();
