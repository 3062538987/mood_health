const mockAuditRecord = jest.fn().mockResolvedValue(undefined)
const mockFileInfo = jest.fn()

jest.mock('../../../src/services/auditService', () => ({
  createAuditService: jest.fn(() => ({ record: mockAuditRecord })),
}))

jest.mock('../../../src/config/database', () => ({
  __esModule: true,
  default: {},
  isSqliteClient: true,
}))

jest.mock('../../../src/config/sqlite', () => ({
  sqliteRun: jest.fn(),
}))

jest.mock('../../../src/utils/logger', () => ({
  __esModule: true,
  default: { error: jest.fn() },
  sanitizeForLogs: jest.fn((value) => value),
  summarizeRequestBody: jest.fn(() => null),
}))

jest.mock('winston', () => ({
  __esModule: true,
  default: {
    createLogger: jest.fn(() => ({ info: mockFileInfo })),
    format: {
      combine: jest.fn(),
      timestamp: jest.fn(),
      json: jest.fn(),
    },
    transports: {
      File: jest.fn(),
    },
  },
}))

describe('operationLogger', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('writes operation audits through the MySQL audit service', async () => {
    const { logOperation } = await import('../../../src/utils/operationLogger')

    await logOperation(
      7,
      'super_admin',
      'user.manage',
      'USER_LIST',
      '12',
      'count=1',
      'success',
      '127.0.0.1'
    )

    expect(mockAuditRecord).toHaveBeenCalledWith({
      actorUserId: 7,
      actorRoleCode: 'super_admin',
      permissionCode: 'user.manage',
      action: 'USER_LIST',
      targetType: null,
      targetId: '12',
      result: 'success',
      summary: 'count=1',
      ipAddress: '127.0.0.1',
      requestId: null,
    })
    expect(mockFileInfo).toHaveBeenCalledWith('operation_audit', expect.any(Object))
  })
})
