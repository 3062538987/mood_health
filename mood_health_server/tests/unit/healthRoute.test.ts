import type { AddressInfo } from 'node:net'
import type { Server } from 'node:http'

jest.mock('../../src/config/database', () => ({
  connectDB: jest.fn(),
  query: jest.fn(),
}))

jest.mock('../../src/utils/redis.client', () => ({
  __esModule: true,
  default: { ping: jest.fn().mockResolvedValue(true) },
}))

describe('GET /health', () => {
  let server: Server
  let baseUrl: string
  let mysqlHealthy = true
  let redisHealthy = true

  beforeAll(async () => {
    process.env.ENCRYPTION_KEY = '0'.repeat(64)
    const { createApp } = await import('../../src/app')
    server = createApp({
      health: {
        checkMysql: async () => mysqlHealthy,
        checkRedis: async () => redisHealthy,
        timeoutMs: 50,
      },
    }).listen(0, '127.0.0.1')
    await new Promise<void>((resolve) => server.once('listening', resolve))
    const address = server.address() as AddressInfo
    baseUrl = `http://127.0.0.1:${address.port}`
  })

  afterEach(() => {
    mysqlHealthy = true
    redisHealthy = true
  })

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()))
    })
  })

  it('reports all dependencies when the service is healthy', async () => {
    const response = await fetch(`${baseUrl}/health`)

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      code: 0,
      message: '服务健康',
      data: {
        status: 'ok',
        api: 'healthy',
        mysql: 'connected',
        redis: 'connected',
      },
    })
  })

  it('degrades without failing when Redis is unavailable', async () => {
    redisHealthy = false

    const response = await fetch(`${baseUrl}/health`)

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      code: 0,
      message: '服务降级',
      data: {
        status: 'degraded',
        api: 'healthy',
        mysql: 'connected',
        redis: 'disconnected',
      },
    })
  })

  it('returns service unavailable when MySQL is unavailable', async () => {
    mysqlHealthy = false

    const response = await fetch(`${baseUrl}/health`)

    expect(response.status).toBe(503)
    await expect(response.json()).resolves.toEqual({
      code: 1503,
      message: '服务不可用',
      data: {
        status: 'unhealthy',
        api: 'healthy',
        mysql: 'disconnected',
        redis: 'connected',
      },
    })
  })
})
