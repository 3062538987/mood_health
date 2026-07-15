import { Response } from 'express'
import { getOperationLogsHandler } from '../../../src/controllers/auditController'
import { sqliteAll, sqliteGet } from '../../../src/config/sqlite'

jest.mock('../../../src/config/database', () => ({
  __esModule: true,
  default: { request: jest.fn() },
  isSqliteClient: true,
}))

jest.mock('../../../src/config/sqlite', () => ({
  sqliteAll: jest.fn(),
  sqliteGet: jest.fn(),
}))

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

  it('returns only the audit fields needed by the management page', async () => {
    jest.mocked(sqliteAll).mockReturnValueOnce([
      {
        id: 1,
        operator_id: 2,
        operator_role: 'super_admin',
        permission_code: 'user.manage',
        operation_type: 'USER_LIST',
        target_id: null,
        content: '不应返回的内部操作正文',
        ip_address: '192.0.2.1',
        operation_time: '2026-01-01T00:00:00.000Z',
        operation_result: 'success',
      },
    ] as never)
    jest.mocked(sqliteGet).mockReturnValueOnce({ total: 1 } as never)
    const response = createResponse()

    await getOperationLogsHandler(
      { query: { page: '1', pageSize: '20' } } as never,
      response
    )

    const serializedCalls = JSON.stringify((response.json as jest.Mock).mock.calls)
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
    expect(serializedCalls).not.toContain('内部操作正文')
    expect(serializedCalls).not.toContain('192.0.2.1')
  })
})
