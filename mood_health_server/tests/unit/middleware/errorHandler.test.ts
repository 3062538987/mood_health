import type { NextFunction, Request, Response } from 'express'
import { API_ERROR_CODES, apiFailure, apiSuccess } from '../../../src/utils/apiResponse'
import { errorHandler, notFoundHandler } from '../../../src/middleware/errorHandler'

const createResponse = () => {
  const response = {
    status: jest.fn(),
    json: jest.fn(),
  }
  response.status.mockReturnValue(response)
  return response as unknown as Response
}

const request = {
  method: 'GET',
  originalUrl: '/missing',
} as Request

describe('API response contract', () => {
  it('creates a success response with business code zero', () => {
    expect(apiSuccess({ id: 1 }, '查询成功')).toEqual({
      code: 0,
      message: '查询成功',
      data: { id: 1 },
      requestId: expect.any(String),
    })
  })

  it('creates a failure response with a non-zero business code', () => {
    expect(apiFailure(API_ERROR_CODES.BAD_REQUEST, '参数错误')).toEqual({
      code: API_ERROR_CODES.BAD_REQUEST,
      message: '参数错误',
      data: null,
      requestId: expect.any(String),
    })
  })
})

describe('error middleware contract', () => {
  const next = jest.fn() as NextFunction

  afterEach(() => {
    jest.clearAllMocks()
    delete process.env.NODE_ENV
  })

  it('returns the unified 400 response for validation errors', () => {
    const response = createResponse()
    const error = Object.assign(new Error('invalid input'), { name: 'ValidationError' })

    errorHandler(error, request, response, next)

    expect(response.status).toHaveBeenCalledWith(400)
    expect(response.json).toHaveBeenCalledWith({
      code: API_ERROR_CODES.BAD_REQUEST,
      message: '请求参数验证失败',
      data: null,
      requestId: expect.any(String),
    })
  })

  it('turns an unknown route into the unified 404 response', () => {
    const response = createResponse()
    const captureNext = jest.fn((error) => errorHandler(error, request, response, next))

    notFoundHandler(request, response, captureNext)

    expect(response.status).toHaveBeenCalledWith(404)
    expect(response.json).toHaveBeenCalledWith({
      code: API_ERROR_CODES.NOT_FOUND,
      message: '请求的资源不存在',
      data: null,
      requestId: expect.any(String),
    })
  })

  it('hides internal details in a production 500 response', () => {
    process.env.NODE_ENV = 'production'
    const response = createResponse()
    const error = new Error('database password leaked')

    errorHandler(error, request, response, next)

    expect(response.status).toHaveBeenCalledWith(500)
    expect(response.json).toHaveBeenCalledWith({
      code: API_ERROR_CODES.INTERNAL_ERROR,
      message: '服务器内部错误',
      data: null,
      requestId: expect.any(String),
    })
    expect(JSON.stringify((response.json as jest.Mock).mock.calls)).not.toContain('database password leaked')
    expect(JSON.stringify((response.json as jest.Mock).mock.calls)).not.toContain('stack')
  })
})
