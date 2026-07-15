import type { AddressInfo } from 'node:net'
import type { Server } from 'node:http'

jest.mock('../../src/config/mysql', () => ({
  checkMysqlHealth: jest.fn().mockResolvedValue(true),
  getMysqlPool: jest.fn(() => ({
    query: jest.fn().mockResolvedValue([[], []]),
  })),
}))

jest.mock('../../src/utils/redis.client', () => ({
  __esModule: true,
  default: {
    ping: jest.fn().mockResolvedValue(true),
  },
}))

describe('application API contract', () => {
  let server: Server
  let baseUrl: string

  beforeAll(async () => {
    process.env.ENCRYPTION_KEY = '0'.repeat(64)
    const { createApp } = await import('../../src/app')
    server = createApp().listen(0, '127.0.0.1')
    await new Promise<void>((resolve) => server.once('listening', resolve))
    const address = server.address() as AddressInfo
    baseUrl = `http://127.0.0.1:${address.port}`
  })

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()))
    })
  })

  it('returns the unified success contract from health check', async () => {
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

  it('returns the unified failure contract for an unknown route', async () => {
    const response = await fetch(`${baseUrl}/api/not-found`)
    const body = await response.json()

    expect(response.status).toBe(404)
    expect(body).toEqual({
      code: 1004,
      message: '请求的资源不存在',
      data: null,
    })
  })
})
