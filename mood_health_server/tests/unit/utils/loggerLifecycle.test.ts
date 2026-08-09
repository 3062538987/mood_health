describe('logger lifecycle', () => {
  it('does not create rotating file transports in the test environment', async () => {
    jest.resetModules()
    process.env.NODE_ENV = 'test'

    const { default: logger } = await import('../../../src/utils/logger')

    try {
      const rotatingFileTransports = logger.transports.filter(
        (transport) => transport.constructor.name === 'DailyRotateFile'
      )

      expect(rotatingFileTransports).toHaveLength(0)
    } finally {
      logger.close()
    }
  })
})
