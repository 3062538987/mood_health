import { NextFunction, Response } from 'express'
import { adminMoodsListHandler, adminUsersListHandler } from '../../../src/controllers/managementController'
import { requirePermission } from '../../../src/middleware/auth'
import { sqliteAll } from '../../../src/config/sqlite'

jest.mock('../../../src/config/database', () => ({
  __esModule: true,
  default: { request: jest.fn() },
  isSqliteClient: true,
}))

jest.mock('../../../src/config/sqlite', () => ({
  sqliteAll: jest.fn(),
  sqliteRun: jest.fn(),
}))

jest.mock('../../../src/utils/encryption', () => ({
  decryptField: jest.fn((value: string) => value),
}))

jest.mock('../../../src/utils/operationLogger', () => ({
  logOperation: jest.fn().mockResolvedValue(undefined),
}))

jest.mock('../../../src/models/userModel', () => ({
  deleteUserById: jest.fn(),
  findUserById: jest.fn(),
  isValidUserRole: jest.fn((role: string) => ['user', 'admin', 'super_admin'].includes(role)),
  updateUserRole: jest.fn(),
}))

const sqliteAllMock = jest.mocked(sqliteAll)

const createResponse = () => {
  const response = { status: jest.fn(), json: jest.fn() }
  response.status.mockReturnValue(response)
  response.json.mockReturnValue(response)
  return response as unknown as Response
}

const createRequest = (overrides: Record<string, unknown> = {}) =>
  ({
    user: { userId: 1, username: 'admin_demo', role: 'super_admin' },
    headers: {},
    ip: '127.0.0.1',
    body: {},
    params: {},
    query: {},
    originalUrl: '/api/admin/moods',
    ...overrides,
  }) as never

describe('managementController contract', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns the user list in the complete response envelope', async () => {
    sqliteAllMock.mockReturnValueOnce([
      {
        id: 2,
        username: 'student_demo',
        email: 'student@example.com',
        role: 'user',
        created_at: '2026-01-01T00:00:00.000Z',
      },
    ] as never)
    const response = createResponse()

    await adminUsersListHandler(createRequest({ originalUrl: '/api/admin/users' }), response)

    expect(response.json).toHaveBeenCalledWith({
      code: 0,
      message: '获取用户列表成功',
      data: {
        list: [
          {
            id: 2,
            username: 'student_demo',
            email: 'student@example.com',
            role: 'user',
            createdAt: '2026-01-01T00:00:00.000Z',
          },
        ],
      },
    })
  })

  it('does not query, return or expose mood note and trigger text', async () => {
    sqliteAllMock.mockImplementation((sqlText: string) => {
      if (sqlText.includes('COUNT')) return [{ total: 1 }] as never
      return [
        {
          id: 10,
          userId: 2,
          username: 'student_demo',
          moodTypeRaw: '平静',
          intensity: 6,
          note: '不应返回的私密正文',
          trigger: '不应返回的触发因素',
          createdAt: '2026-01-01T00:00:00.000Z',
        },
      ] as never
    })
    const response = createResponse()

    await adminMoodsListHandler(createRequest(), response)

    const serializedCalls = JSON.stringify((response.json as jest.Mock).mock.calls)
    expect(response.json).toHaveBeenCalledWith({
      code: 0,
      message: '获取情绪统计成功',
      data: {
        list: [
          {
            id: 10,
            userId: 2,
            username: 'student_demo',
            moodType: ['平静'],
            intensity: 6,
            createdAt: '2026-01-01T00:00:00.000Z',
          },
        ],
        total: 1,
        page: 1,
        pageSize: 20,
      },
    })
    expect(serializedCalls).not.toContain('私密正文')
    expect(serializedCalls).not.toContain('触发因素')
    expect(sqliteAllMock.mock.calls[1][0]).not.toContain('note_encrypted')
    expect(sqliteAllMock.mock.calls[1][0]).not.toContain('m.trigger')
  })

  it('denies a student access with the unified 403 contract', () => {
    const response = createResponse()
    const next = jest.fn() as NextFunction
    const middleware = requirePermission('user.manage')

    middleware(
      createRequest({
        user: { userId: 2, username: 'student_demo', role: 'user' },
        originalUrl: '/api/admin/users',
      }),
      response,
      next
    )

    expect(next).not.toHaveBeenCalled()
    expect(response.status).toHaveBeenCalledWith(403)
    expect(response.json).toHaveBeenCalledWith({
      code: 1003,
      message: '权限不足：该操作被禁止',
      data: null,
    })
  })
})
