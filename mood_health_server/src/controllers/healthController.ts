import type { RequestHandler } from 'express'
import { API_ERROR_CODES, apiFailure, apiSuccess } from '../utils/apiResponse'

type DependencyCheck = () => Promise<boolean>

export interface HealthDependencies {
  checkMysql: DependencyCheck
  checkRedis: DependencyCheck
  timeoutMs?: number
}

const runWithTimeout = async (check: DependencyCheck, timeoutMs: number): Promise<boolean> =>
  new Promise<boolean>((resolve) => {
    const timer = setTimeout(() => resolve(false), timeoutMs)
    void check()
      .then((result) => {
        clearTimeout(timer)
        resolve(result)
      })
      .catch(() => {
        clearTimeout(timer)
        resolve(false)
      })
  })

export const createHealthHandler = ({
  checkMysql,
  checkRedis,
  timeoutMs = 2000,
}: HealthDependencies): RequestHandler => {
  return async (_request, response) => {
    try {
      const [mysqlHealthy, redisHealthy] = await Promise.all([
        runWithTimeout(checkMysql, timeoutMs),
        runWithTimeout(checkRedis, timeoutMs),
      ])
      const data = {
        status: mysqlHealthy ? (redisHealthy ? 'ok' : 'degraded') : 'unhealthy',
        api: 'healthy',
        mysql: mysqlHealthy ? 'connected' : 'disconnected',
        redis: redisHealthy ? 'connected' : 'disconnected',
      }

      if (!mysqlHealthy) {
        response
          .status(503)
          .json(apiFailure(API_ERROR_CODES.SERVICE_UNAVAILABLE, '服务不可用', data))
        return
      }

      response.json(apiSuccess(data, redisHealthy ? '服务健康' : '服务降级'))
    } catch (error) {
      response
        .status(500)
        .json(apiFailure(API_ERROR_CODES.INTERNAL_ERROR, '健康检查失败'))
    }
  }
}
