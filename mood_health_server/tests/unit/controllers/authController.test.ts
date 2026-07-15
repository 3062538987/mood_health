import { Request, Response } from 'express'
import jwt from 'jsonwebtoken'
import { getMe, login, register } from '../../../src/controllers/authController'
import {
  comparePassword,
  createUser,
  findUserById,
  findUserByUsername,
} from '../../../src/models/userModel'

jest.mock('../../../src/models/userModel', () => ({
  comparePassword: jest.fn(),
  createUser: jest.fn(),
  findUserById: jest.fn(),
  findUserByUsername: jest.fn(),
}))

jest.mock('jsonwebtoken', () => ({
  __esModule: true,
  default: { sign: jest.fn() },
}))

jest.mock('../../../src/utils/logger', () => ({
  __esModule: true,
  default: {
    warn: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
  },
}))

const mockedFindUserByUsername = jest.mocked(findUserByUsername)
const mockedFindUserById = jest.mocked(findUserById)
const mockedComparePassword = jest.mocked(comparePassword)
const mockedCreateUser = jest.mocked(createUser)
const mockedJwtSign = jest.mocked(jwt.sign)

const databaseUser = {
  id: 1,
  username: 'student_demo',
  password: 'hashed-password',
  email: 'student@example.com',
  role: 'user' as const,
  created_at: new Date('2026-01-01T00:00:00.000Z'),
  updated_at: new Date('2026-01-01T00:00:00.000Z'),
}

const publicUser = (({ password: _password, ...safeUser }) => safeUser)(databaseUser)

const createResponse = () => {
  const response = {
    status: jest.fn(),
    json: jest.fn(),
  }
  response.status.mockReturnValue(response)
  response.json.mockReturnValue(response)
  return response as unknown as Response
}

describe('authController contract', () => {
  const originalJwtSecret = process.env.JWT_SECRET

  beforeEach(() => {
    jest.clearAllMocks()
    process.env.JWT_SECRET = 'test-secret'
  })

  afterAll(() => {
    process.env.JWT_SECRET = originalJwtSecret
  })

  it('returns the complete response envelope after registration', async () => {
    mockedFindUserByUsername.mockResolvedValue(null)
    mockedCreateUser.mockResolvedValue(1)
    const req = {
      body: { username: 'student_demo', password: 'password123' },
      originalUrl: '/api/auth/register',
    } as Request
    const res = createResponse()

    await register(req, res)

    expect(res.status).toHaveBeenCalledWith(201)
    expect(res.json).toHaveBeenCalledWith({ code: 0, message: '注册成功', data: null })
  })

  it('returns { token, user } without a password after login', async () => {
    mockedFindUserByUsername.mockResolvedValue(databaseUser)
    mockedComparePassword.mockResolvedValue(true)
    mockedJwtSign.mockReturnValue('jwt-token' as never)
    const req = {
      body: { username: 'student_demo', password: 'password123' },
      originalUrl: '/api/auth/login',
    } as Request
    const res = createResponse()

    await login(req, res)

    expect(res.json).toHaveBeenCalledWith({
      code: 0,
      message: '登录成功',
      data: { token: 'jwt-token', user: publicUser },
    })
    expect(res.json).not.toHaveBeenCalledWith(expect.objectContaining({ password: expect.anything() }))
  })

  it('returns { user } from /me using the same envelope', async () => {
    mockedFindUserById.mockResolvedValue(publicUser)
    const req = {
      user: { userId: 1, username: 'student_demo', role: 'user' },
      originalUrl: '/api/auth/me',
    } as never
    const res = createResponse()

    await getMe(req, res)

    expect(res.json).toHaveBeenCalledWith({
      code: 0,
      message: '获取当前用户成功',
      data: { user: publicUser },
    })
  })

  it('does not expose JWT configuration details to the client', async () => {
    delete process.env.JWT_SECRET
    mockedFindUserByUsername.mockResolvedValue(databaseUser)
    mockedComparePassword.mockResolvedValue(true)
    const req = {
      body: { username: 'student_demo', password: 'password123' },
      originalUrl: '/api/auth/login',
    } as Request
    const res = createResponse()

    await expect(login(req, res)).rejects.toMatchObject({
      statusCode: 500,
      message: '服务配置错误',
    })
  })
})
