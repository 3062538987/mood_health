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
      requestId: expect.any(String),
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
      requestId: expect.any(String),
    })
  })

  it('does not turn a disallowed CORS origin into a 500 response', async () => {
    const response = await fetch(`${baseUrl}/health`, {
      headers: { Origin: 'https://evil.example' },
    })
    const body = await response.text()

    expect(response.status).not.toBe(500)
    expect(response.headers.get('access-control-allow-origin')).toBeNull()
    expect(body).not.toContain('Not allowed by CORS')
  })

  it('allows the production preview origin used by browser performance tests', async () => {
    const response = await fetch(`${baseUrl}/health`, {
      headers: { Origin: 'http://127.0.0.1:4173' },
    })

    expect(response.status).toBe(200)
    expect(response.headers.get('access-control-allow-origin')).toBe('http://127.0.0.1:4173')
  })

  it('allows localhost and 127.0.0.1 API connections in the CSP', async () => {
    const response = await fetch(`${baseUrl}/health`)
    const csp = response.headers.get('content-security-policy')

    expect(csp).toContain('connect-src')
    expect(csp).toContain('http://localhost:*')
    expect(csp).toContain('http://127.0.0.1:*')
  })

  it('keeps public mood metadata readable while protecting private mood records', async () => {
    const typesResponse = await fetch(`${baseUrl}/api/moods/types`)
    const listResponse = await fetch(`${baseUrl}/api/moods/list`)

    expect(typesResponse.status).toBe(200)
    expect(listResponse.status).toBe(401)
  })
})
