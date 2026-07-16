import { Request, Response } from 'express'
import { getMe, login, register } from '../../../src/controllers/authController'

var mockAuthService: {
  register: jest.Mock
  login: jest.Mock
  getMe: jest.Mock
}

jest.mock('../../../src/services/authService', () => ({
  createAuthService: jest.fn(() => {
    mockAuthService = {
      register: jest.fn(),
      login: jest.fn(),
      getMe: jest.fn(),
    }
    return mockAuthService
  }),
}))

jest.mock('../../../src/utils/logger', () => ({
  __esModule: true,
  default: {
    warn: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
  },
}))

const publicUser = {
  id: 1,
  username: 'student_demo',
  email: 'student@example.com',
  nickname: '学生演示',
  avatarUrl: null,
  status: 'active' as const,
  role: 'student' as const,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  lastLoginAt: null,
}

const createResponse = () => {
  const response = {
    status: jest.fn(),
    json: jest.fn(),
    cookie: jest.fn(),
    clearCookie: jest.fn(),
  }
  response.status.mockReturnValue(response)
  response.json.mockReturnValue(response)
  response.cookie.mockReturnValue(response)
  response.clearCookie.mockReturnValue(response)
  return response as unknown as Response
}

describe('authController contract', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns the complete response envelope after registration', async () => {
    mockAuthService.register.mockResolvedValue(undefined)
    const req = {
      body: { username: 'student_demo', password: 'password123' },
      originalUrl: '/api/auth/register',
    } as Request
    const res = createResponse()

    await register(req, res)

    expect(mockAuthService.register).toHaveBeenCalledWith(req.body)
    expect(res.status).toHaveBeenCalledWith(201)
    expect(res.json).toHaveBeenCalledWith({ code: 0, message: '注册成功', data: null, requestId: expect.any(String) })
  })

  it('returns { token, user } without a password after login', async () => {
    mockAuthService.login.mockResolvedValue({ token: 'jwt-token', user: publicUser })
    const req = {
      body: { username: 'student_demo', password: 'password123' },
      originalUrl: '/api/auth/login',
    } as Request
    const res = createResponse()

    await login(req, res)

    expect(mockAuthService.login).toHaveBeenCalledWith(req.body)
    expect(res.json).toHaveBeenCalledWith({
      code: 0,
      message: '登录成功',
      data: { token: 'jwt-token', user: publicUser },
      requestId: expect.any(String),
    })
    expect(res.json).not.toHaveBeenCalledWith(expect.objectContaining({ password: expect.anything() }))
  })

  it('returns { user } from /me using the same envelope', async () => {
    mockAuthService.getMe.mockResolvedValue(publicUser)
    const req = {
      user: { userId: 1, username: 'student_demo', role: 'student' },
      originalUrl: '/api/auth/me',
    } as never
    const res = createResponse()

    await getMe(req, res)

    expect(mockAuthService.getMe).toHaveBeenCalledWith(1)
    expect(res.json).toHaveBeenCalledWith({
      code: 0,
      message: '获取当前用户成功',
      data: { user: publicUser },
      requestId: expect.any(String),
    })
  })

  it('returns 500 when service throws an unknown error', async () => {
    mockAuthService.login.mockRejectedValue(new Error('service failed'))
    const req = {
      body: { username: 'student_demo', password: 'password123' },
      originalUrl: '/api/auth/login',
    } as Request
    const res = createResponse()

    await login(req, res)

    expect(res.status).toHaveBeenCalledWith(500)
    expect(res.json).toHaveBeenCalledWith({ code: 1500, data: null, message: '服务器内部错误', requestId: expect.any(String) })
  })
})
