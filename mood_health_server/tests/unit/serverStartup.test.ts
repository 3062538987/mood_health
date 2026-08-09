const mockListen = jest.fn(() => ({ close: jest.fn() }))
const mockCreateApp = jest.fn(() => ({ listen: mockListen }))
const mockConnectMysql = jest.fn().mockResolvedValue(undefined)

jest.mock('../../src/app', () => ({
  createApp: mockCreateApp,
}))

jest.mock('../../src/config/mysql', () => ({
  connectMysql: mockConnectMysql,
}))

jest.mock('../../src/utils/logger', () => ({
  __esModule: true,
  default: { error: jest.fn() },
}))

describe('server startup', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env.PORT = '3000'
    process.env.HOST = '127.0.0.1'
  })

  it('connects only to MySQL before listening', async () => {
    const { startServer } = await import('../../src/server')

    await startServer()

    expect(mockConnectMysql).toHaveBeenCalledTimes(1)
    expect(mockListen).toHaveBeenCalledWith(3000, '127.0.0.1', expect.any(Function))
  })
})
