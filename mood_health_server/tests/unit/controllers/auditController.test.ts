import { Response } from 'express'

var mockAuditService: { list: jest.Mock } = {
  list: jest.fn(),
}

jest.mock('../../../src/config/database', () => ({
  __esModule: true,
  default: { request: jest.fn(() => ({ input: jest.fn(), query: jest.fn() })) },
  isSqliteClient: false,
}))

jest.mock('../../../src/services/auditService', () => ({
  createAuditService: jest.fn(() => mockAuditService),
}))

const { getOperationLogsHandler } = require('../../../src/controllers/auditController')

const createResponse = () => {
  const response = { status: jest.fn(), json: jest.fn() }
  response.status.mockReturnValue(response)
  response.json.mockReturnValue(response)
  return response as unknown as Response
}

describe('auditController contract', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns only the audit fields provided by the MySQL service boundary', async () => {
    mockAuditService.list.mockResolvedValue({
      list: [
        {
          id: 1,
          operatorId: 2,
          operatorRole: 'super_admin',
          permissionCode: 'user.manage',
          operationType: 'USER_LIST',
          targetId: null,
          operationTime: '2026-01-01T00:00:00.000Z',
          operationResult: 'success',
        },
      ],
      total: 1,
      page: 1,
      pageSize: 20,
    })
    const response = createResponse()

    await getOperationLogsHandler(
      {
        query: {
          role: 'super_admin',
          permission: 'user.manage',
          page: '1',
          pageSize: '20',
        },
      } as never,
      response
    )

    expect(mockAuditService.list).toHaveBeenCalledWith({
      role: 'super_admin',
      permission: 'user.manage',
      startTime: undefined,
      endTime: undefined,
      page: 1,
      pageSize: 20,
    })
    expect(response.json).toHaveBeenCalledWith({
      code: 0,
      message: '获取审计日志成功',
      data: {
        list: [
          {
            id: 1,
            operatorId: 2,
            operatorRole: 'super_admin',
            permissionCode: 'user.manage',
            operationType: 'USER_LIST',
            targetId: null,
            operationTime: '2026-01-01T00:00:00.000Z',
            operationResult: 'success',
          },
        ],
        pagination: { page: 1, pageSize: 20, total: 1 },
      },
    })
  })
})
