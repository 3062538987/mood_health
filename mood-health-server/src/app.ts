import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import dotenv from 'dotenv'
import morgan from 'morgan'
import compression from 'compression'
import rateLimit from 'express-rate-limit'
import type { CorsOptions } from 'cors'
import { connectDB, query } from './config/database'
import authRoutes from './routes/authRoutes'
import moodRoutes from './routes/moodRoutes'
import activityRoutes from './routes/activityRoutes'
import postRoutes from './routes/postRoutes'
import questionnaireRoutes from './routes/questionnaireRoutes'
import musicRoutes from './routes/musicRoutes'
import courseRoutes from './routes/courseRoutes'
import aiRoutes from './routes/aiRoutes'
import relaxRoutes from './routes/relaxRoutes'
import achievementRoutes from './routes/achievementRoutes'
import logger, { summarizeRequestBody } from './utils/logger'
import redisClient from './utils/redis.client'
import { errorHandler, notFoundHandler } from './middleware/errorHandler'

dotenv.config()

const app = express()
const allowedOrigins = process.env.FRONTEND_URL
  ? process.env.FRONTEND_URL.split(',')
      .map((origin) => origin.trim())
      .filter(Boolean)
  : [
      'http://localhost:5173',
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:3002',
      'http://localhost:3003',
    ]

const corsOptions: CorsOptions = {
  origin(origin, callback) {
    // 允许无 origin 的请求，例如 Postman 或同源探活请求
    if (!origin) {
      callback(null, true)
      return
    }

    if (allowedOrigins.includes(origin)) {
      callback(null, true)
      return
    }

    callback(new Error('Not allowed by CORS'))
  },
  credentials: true,
}

// 中间件
app.use(helmet())
app.use(cors(corsOptions))
app.use(express.json())
app.use(compression())

// 请求摘要日志中间件，避免将完整请求体落盘
morgan.token('client-ip', (req) => {
  const request = req as express.Request
  const forwardedFor = req.headers['x-forwarded-for']
  if (typeof forwardedFor === 'string' && forwardedFor.length > 0) {
    return forwardedFor.split(',')[0].trim()
  }
  return request.ip || '-'
})

morgan.token('auth-state', (req) => (req.headers.authorization ? 'present' : 'absent'))

morgan.token('body-summary', (req) => {
  const request = req as express.Request
  const summary = summarizeRequestBody(request.body)
  return summary ? JSON.stringify(summary) : '-'
})

const requestLogFormat = (tokens: any, req: any, res: any) => {
  return JSON.stringify({
    method: tokens.method(req, res),
    url: tokens.url(req, res),
    status: Number(tokens.status(req, res) || 0),
    responseTimeMs: Number(tokens['response-time'](req, res) || 0),
    contentLength: tokens.res(req, res, 'content-length') || '0',
    ip: tokens['client-ip'](req, res),
    auth: tokens['auth-state'](req, res),
    body: tokens['body-summary'](req, res),
  })
}

app.use(
  morgan(requestLogFormat, {
    stream: {
      write: (message) => {
        const trimmedMessage = message.trim()
        try {
          logger.info('http_request', JSON.parse(trimmedMessage))
        } catch {
          logger.info(trimmedMessage)
        }
      },
    },
  })
)

// 速率限制 - 开发环境放宽限制
const isDevelopment = process.env.NODE_ENV !== 'production'
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分钟
  max: isDevelopment ? 100 : 5, // 开发环境100次，生产环境5次
  message: '请求过于频繁，请稍后再试',
})

// 路由
app.use('/api/auth/login', limiter)
app.use('/api/auth', authRoutes)
app.use('/api/moods', moodRoutes)
app.use('/api/activities', activityRoutes)
app.use('/api/posts', postRoutes)
app.use('/api/questionnaires', questionnaireRoutes)
app.use('/api/music', musicRoutes)
app.use('/api/courses', courseRoutes)
app.use('/api/ai', aiRoutes)
app.use('/api/relax', relaxRoutes)
app.use('/api/achievements', achievementRoutes)

// 健康检查接口
app.get('/health', async (req, res) => {
  try {
    // 测试 SQL Server 连接
    const dbResult = await query('SELECT 1 + 1 AS result')

    // 测试 Redis 连接
    const redisStatus = await redisClient.ping()

    res.json({
      status: 'ok',
      database: 'connected',
      redis: redisStatus ? 'connected' : 'disconnected',
      result: dbResult,
    })
  } catch (error) {
    logger.error('健康检查失败', { error })

    // 单独检查 Redis 状态
    let redisStatus
    try {
      redisStatus = await redisClient.ping()
    } catch (redisError) {
      redisStatus = false
    }

    res.status(500).json({
      success: false,
      code: 500,
      message: '健康检查失败',
      path: req.originalUrl,
      timestamp: new Date().toISOString(),
    })
  }
})

// 404 处理中间件
app.use(notFoundHandler)

// 全局错误处理中间件
app.use(errorHandler)

// 启动服务器
const PORT = process.env.PORT || 3000

const startServer = async () => {
  try {
    // 先连接数据库
    await connectDB()

    // 再启动服务器
    app.listen(PORT, () => {
      console.log(`🚀 服务器运行在 http://localhost:${PORT}`)
      console.log(`📊 健康检查: http://localhost:${PORT}/health`)
      console.log(`🔐 认证路由: http://localhost:${PORT}/api/auth`)
      console.log(`📋 问卷路由: http://localhost:${PORT}/api/questionnaires`)
    })
  } catch (error) {
    logger.error('服务器启动失败', { error })
    process.exit(1)
  }
}

startServer()
