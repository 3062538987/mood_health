import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
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
import logger, { summarizeRequestBody } from './utils/logger'
import redisClient from './utils/redis.client'
import { errorHandler, notFoundHandler } from './middleware/errorHandler'
import { API_ERROR_CODES, apiFailure, apiSuccess } from './utils/apiResponse'
import { getFeatureFlags } from './config/featureFlags'
import { createHealthHandler, HealthDependencies } from './controllers/healthController'

dotenv.config()

const NON_CORE_ROUTES = [
  { path: '/api/activities', modulePath: './routes/activityRoutes' },
  { path: '/api/posts', modulePath: './routes/postRoutes' },
  { path: '/api/music', modulePath: './routes/musicRoutes' },
  { path: '/api/courses', modulePath: './routes/courseRoutes' },
  { path: '/api/relax', modulePath: './routes/relaxRoutes' },
  { path: '/api/achievements', modulePath: './routes/achievementRoutes' },
] as const

export interface AppDependencies {
  health?: HealthDependencies
}

export const createApp = (dependencies: AppDependencies = {}) => {
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

  app.use(helmet())
  app.use(cors(corsOptions))
  app.use(express.json())
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

  if (getFeatureFlags().nonCoreModules) {
    for (const route of NON_CORE_ROUTES) {
      const routeModule = require(route.modulePath) as { default: express.Router }
      app.use(route.path, routeModule.default)
    }
  } else {
    for (const route of NON_CORE_ROUTES) {
      app.use(route.path, (_request, response) => {
        response
          .status(503)
          .json(apiFailure(API_ERROR_CODES.FEATURE_DISABLED, '功能未启用'))
      })
    }
  }

  app.use('/api/audit', auditRoutes)
  app.use('/api', managementRoutes)

  app.get(
    '/health',
    createHealthHandler(
      dependencies.health ?? {
        checkMysql: checkMysqlHealth,
        checkRedis: () => redisClient.ping(),
      }
    )
  )

  app.use(notFoundHandler)
  app.use(errorHandler)

  return app
}

if (require.main === module) {
  void import('./server.js').then(({ runServer }) => runServer())
}

export default createApp
