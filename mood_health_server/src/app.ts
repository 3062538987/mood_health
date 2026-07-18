import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import cookieParser from 'cookie-parser'
import dotenv from 'dotenv'
import morgan from 'morgan'
import compression from 'compression'
import rateLimit from 'express-rate-limit'
import type { CorsOptions } from 'cors'
import { checkMysqlHealth } from './config/mysql'
import authRoutes from './routes/authRoutes'
import moodRoutes from './routes/moodRoutes'
import questionnaireRoutes from './routes/questionnaireRoutes'
import auditRoutes from './routes/auditRoutes'
import managementRoutes from './routes/managementRoutes'
import caseRoutes from './routes/caseRoutes'
import promptRoutes from './routes/promptRoutes'
import aiInterpretationRoutes from './routes/aiInterpretationRoutes'
import aiHistoryRoutes from './routes/aiHistoryRoutes'
import activityRoutes from './routes/activityRoutes'
import postRoutes from './routes/postRoutes'
import musicRoutes from './routes/musicRoutes'
import courseRoutes from './routes/courseRoutes'
import relaxRoutes from './routes/relaxRoutes'
import achievementRoutes from './routes/achievementRoutes'
import recommendRoutes from './routes/recommendRoutes'
import feedbackRoutes from './routes/feedbackRoutes'
import moodAnalysisRoutes from './routes/moodAnalysisRoutes'
import logger, { summarizeRequestBody } from './utils/logger'
import redisClient from './utils/redis.client'
import { errorHandler, notFoundHandler } from './middleware/errorHandler'
import { requestIdMiddleware } from './middleware/requestId'
import { csrfMiddleware } from './middleware/csrf'
import { requireNonCoreModules } from './middleware/featureFlag'
import { API_ERROR_CODES, apiFailure, apiSuccess } from './utils/apiResponse'
import { createHealthHandler, HealthDependencies } from './controllers/healthController'

dotenv.config()

const validateEnv = () => {
  const requiredVars = [
    'JWT_SECRET',
    'MYSQL_HOST',
    'MYSQL_DATABASE',
    'MYSQL_APP_USER',
    'MYSQL_APP_PASSWORD',
  ]
  const missing = requiredVars.filter((key) => !process.env[key]?.trim())
  if (missing.length > 0) {
    const message = `服务启动失败：缺少必要的环境变量: ${missing.join(', ')}`
    logger.error(message)
    throw new Error(message)
  }
}

const NON_CORE_ROUTES = [] as const

export interface AppDependencies {
  health?: HealthDependencies
}

export const createApp = (dependencies: AppDependencies = {}) => {
  validateEnv()
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

  // 安全: 配置 CSP 作为 XSS 纵深防御 (EXPRESS-HEADERS-001)
  const isProduction = process.env.NODE_ENV === 'production'
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: isProduction ? ["'self'"] : ["'self'", "'unsafe-inline'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:', 'https:'],
          connectSrc: isProduction ? ["'self'"] : ["'self'", 'http://localhost:*', 'ws://localhost:*'],
          fontSrc: ["'self'", 'https://cdnjs.cloudflare.com'],
          objectSrc: ["'none'"],
          frameAncestors: ["'none'"],
        },
      },
    })
  )
  app.disable('x-powered-by')
  app.use(requestIdMiddleware)
  app.use(cookieParser())
  // 安全: CSRF 防护 (Double Submit Cookie 模式)
  app.use('/api', csrfMiddleware)
  app.use(cors(corsOptions))
  // 安全: 限制请求体大小防止 DoS 攻击 (EXPRESS-BODY-001)
  app.use(express.json({ limit: '1mb' }))
  app.use(compression())

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

  const isDevelopment = process.env.NODE_ENV !== 'production'
  const loginRateLimitWindowMs = Number(
    process.env.AUTH_LOGIN_RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000
  )
  const loginRateLimitMax = Number(
    process.env.AUTH_LOGIN_RATE_LIMIT_MAX || (isDevelopment ? 100 : 20)
  )
  const limiter = rateLimit({
    windowMs: loginRateLimitWindowMs,
    max: loginRateLimitMax,
    message: '请求过于频繁，请稍后再试',
  })

  app.use('/api/auth/login', limiter)
  app.use('/api/auth', authRoutes)
  app.use('/api/moods', moodRoutes)
  app.use('/api/questionnaires', questionnaireRoutes)

  for (const routePath of NON_CORE_ROUTES) {
    app.use(routePath, (_request, response) => {
      response.status(503).json(apiFailure(API_ERROR_CODES.FEATURE_DISABLED, '功能未启用'))
    })
  }

  app.use('/api/audit', auditRoutes)
app.use('/api/cases', caseRoutes)
app.use('/api/prompts', promptRoutes)
app.use('/api/ai', aiInterpretationRoutes)
app.use('/api/ai', aiHistoryRoutes)
app.use('/api/activities', requireNonCoreModules, activityRoutes)
app.use('/api/posts', requireNonCoreModules, postRoutes)
app.use('/api/music', requireNonCoreModules, musicRoutes)
app.use('/api/courses', requireNonCoreModules, courseRoutes)
app.use('/api/relax', requireNonCoreModules, relaxRoutes)
app.use('/api/achievements', requireNonCoreModules, achievementRoutes)
app.use('/api/recommend', recommendRoutes)
app.use('/api', feedbackRoutes)
app.use('/api', managementRoutes)
app.use('/api', moodAnalysisRoutes)

  app.get(
    '/health',
    createHealthHandler(
      dependencies.health ?? {
        checkMysql: checkMysqlHealth,
        checkRedis: () => redisClient.ping(),
      }
    )
  )

  // E2E 测试探活端点 — Playwright webServer 用此端点检测后端就绪
  app.get('/__e2e/ready', (_request, response) => {
    response.status(200).json({ status: 'ok' })
  })

  app.use(notFoundHandler)
  app.use(errorHandler)

  return app
}

if (require.main === module) {
  void import('./server.js').then(({ runServer }) => runServer())
}

export default createApp
