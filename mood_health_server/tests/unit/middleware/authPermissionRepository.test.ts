const mockAccessRepository = {
  hasPermission: jest.fn(),
}

const mockAuditRepository = {
  record: jest.fn(),
}

jest.mock('../../../src/repositories/accessRepository', () => ({
  createAccessRepository: jest.fn(() => mockAccessRepository),
}))

jest.mock('../../../src/repositories/auditRepository', () => ({
  createAuditRepository: jest.fn(() => mockAuditRepository),
}))

jest.mock('../../../src/utils/logger', () => ({
  __esModule: true,
  default: {
    warn: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
  },
}))

import { Response } from 'express'
import { AuthRequest, requirePermission } from '../../../src/middleware/auth'

const createResponse = () => {
  const response = {
    status: jest.fn(),
    json: jest.fn(),
  }
  response.status.mockReturnValue(response)
  response.json.mockReturnValue(response)
  return response as unknown as Response
}

describe('requirePermission repository boundary', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('allows the request when MySQL role permission mapping grants the permission', async () => {
    mockAccessRepository.hasPermission.mockResolvedValue(true)
    const middleware = requirePermission('auth.profile.read')
    const req = {
      user: { userId: 1, username: 'student_demo', role: 'student' },
      originalUrl: '/api/auth/me',
      headers: {},
      ip: '127.0.0.1',
    } as AuthRequest
    const res = createResponse()
    const next = jest.fn()

    await middleware(req, res, next)

    expect(mockAccessRepository.hasPermission).toHaveBeenCalledWith('student', 'auth.profile.read')
    expect(next).toHaveBeenCalled()
    expect(mockAuditRepository.record).not.toHaveBeenCalled()
  })

  it('denies and records a MySQL audit log when the mapping does not grant the permission', async () => {
    mockAccessRepository.hasPermission.mockResolvedValue(false)
    const middleware = requirePermission('user.manage')
    const req = {
      user: { userId: 1, username: 'student_demo', role: 'student' },
      originalUrl: '/api/admin/users',
      headers: { 'x-forwarded-for': '10.0.0.1, 10.0.0.2' },
      ip: '127.0.0.1',
    } as unknown as AuthRequest
    const res = createResponse()
    const next = jest.fn()

    await middleware(req, res, next)

    expect(res.status).toHaveBeenCalledWith(403)
    expect(next).not.toHaveBeenCalled()
    expect(mockAuditRepository.record).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId: 1,
        actorRoleCode: 'student',
        permissionCode: 'user.manage',
        action: 'ACCESS_DENIED',
        result: 'failed',
        ipAddress: '10.0.0.1',
      })
    )
  })
})
