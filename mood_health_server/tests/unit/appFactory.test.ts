import express from 'express'

const mockConnectDB = jest.fn().mockResolvedValue(undefined)

jest.mock('../../src/config/database', () => ({
  connectDB: mockConnectDB,
  query: jest.fn(),
}))

jest.mock('../../src/config/mysql', () => ({
  checkMysqlHealth: jest.fn(),
}))

jest.mock('../../src/utils/redis.client', () => ({
  __esModule: true,
  default: {
    ping: jest.fn().mockResolvedValue(true),
  },
}))

describe('application factory', () => {
  type AppModule = {
    createApp?: () => express.Express
  }

  const listenSpy = jest
    .spyOn(express.application, 'listen')
    .mockImplementation(function mockListen() {
      return {} as ReturnType<typeof express.application.listen>
    })

  beforeAll(() => {
    process.env.ENCRYPTION_KEY = '0'.repeat(64)
  })

  afterAll(() => {
    listenSpy.mockRestore()
  })

  it('imports without connecting to the database or listening on a port', async () => {
    const appModule = (await import('../../src/app')) as AppModule

    await Promise.resolve()

    expect(appModule.createApp).toEqual(expect.any(Function))
    expect(mockConnectDB).not.toHaveBeenCalled()
    expect(listenSpy).not.toHaveBeenCalled()
  })

  it('creates an independent Express application for each call', async () => {
    const { createApp } = (await import('../../src/app')) as AppModule

    expect(createApp).toEqual(expect.any(Function))

    const firstApp = createApp!()
    const secondApp = createApp!()

    expect(firstApp).not.toBe(secondApp)
    expect(firstApp.use).toEqual(expect.any(Function))
    expect(secondApp.use).toEqual(expect.any(Function))
  })
})
