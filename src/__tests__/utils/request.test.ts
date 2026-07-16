import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => {
  const responseHandlers: {
    fulfilled?: (response: unknown) => unknown
    rejected?: (error: unknown) => Promise<never>
  } = {}

  return {
    responseHandlers,
    request: vi.fn(),
    messageError: vi.fn(),
    routerPush: vi.fn(),
    loadingClose: vi.fn(),
  }
})

vi.mock('axios', () => ({
  default: {
    create: vi.fn(() => ({
      interceptors: {
        request: { use: vi.fn() },
        response: {
          use: vi.fn((fulfilled, rejected) => {
            mocks.responseHandlers.fulfilled = fulfilled
            mocks.responseHandlers.rejected = rejected
          }),
        },
      },
      request: mocks.request,
    })),
  },
}))

vi.mock('element-plus', () => ({
  ElMessage: { error: mocks.messageError },
  ElLoading: { service: vi.fn(() => ({ close: mocks.loadingClose })) },
}))

vi.mock('@/router', () => ({
  default: { push: mocks.routerPush },
}))

const response = (data: unknown) => ({ data, config: {} })

describe('request response contract', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
  })

  it('unwraps a standard success response exactly once', async () => {
    const { ApiRequestError } = await import('@/utils/request')
    const result = mocks.responseHandlers.fulfilled?.(
      response({ code: 0, message: '查询成功', data: { id: 1 } })
    )

    expect(result).toEqual({ id: 1 })
    expect(result).not.toHaveProperty('data')
    expect(ApiRequestError).toBeDefined()
  })

  it('rejects a non-zero business code with the unified request error', async () => {
    const { ApiRequestError } = await import('@/utils/request')

    expect(() =>
      mocks.responseHandlers.fulfilled?.(
        response({ code: 1001, message: '参数错误', data: { field: 'name' } })
      )
    ).toThrowError(ApiRequestError)

    try {
      mocks.responseHandlers.fulfilled?.(
        response({ code: 1001, message: '参数错误', data: { field: 'name' } })
      )
    } catch (error) {
      expect(error).toMatchObject({
        kind: 'business',
        code: 1001,
        message: '参数错误',
        data: { field: 'name' },
      })
    }
    expect(mocks.messageError).toHaveBeenCalledWith('参数错误')
  })

  it('normalizes a 401 HTTP error and clears the expired login', async () => {
    const { ApiRequestError } = await import('@/utils/request')
    localStorage.setItem('token', 'expired-token')

    const promise = mocks.responseHandlers.rejected?.({
      config: {},
      response: { status: 401, data: { code: 1002, message: '令牌已过期', data: null } },
    })

    await expect(promise).rejects.toBeInstanceOf(ApiRequestError)
    await expect(promise).rejects.toMatchObject({
      kind: 'http',
      status: 401,
      code: 1002,
      message: '登录已过期，请重新登录',
    })
    expect(localStorage.getItem('token')).toBeNull()
    expect(mocks.routerPush).toHaveBeenCalledWith('/login')
  })

  it('normalizes a 500 HTTP error without exposing a different error shape', async () => {
    const { ApiRequestError } = await import('@/utils/request')

    const promise = mocks.responseHandlers.rejected?.({
      config: {},
      response: { status: 500, data: { code: 1500, message: '服务器内部错误', data: null } },
    })

    await expect(promise).rejects.toBeInstanceOf(ApiRequestError)
    await expect(promise).rejects.toMatchObject({
      kind: 'http',
      status: 500,
      code: 1500,
      message: '服务器内部错误',
    })
  })

  it('rejects the retired code 200 business response', async () => {
    const { ApiRequestError } = await import('@/utils/request')

    expect(() =>
      mocks.responseHandlers.fulfilled?.(
        response({ code: 200, message: 'legacy', data: { source: 'code-200' } })
      )
    ).toThrowError(ApiRequestError)
    expect(mocks.messageError).toHaveBeenCalledWith('legacy')
  })

  it('rejects a response without a business code', async () => {
    const { ApiRequestError } = await import('@/utils/request')

    expect(() => mocks.responseHandlers.fulfilled?.(response({ source: 'no-code' }))).toThrowError(
      ApiRequestError
    )
    expect(mocks.messageError).toHaveBeenCalledWith('响应缺少业务状态码')
  })
})
