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
    currentRoute: {
      value: {
        path: '/mood/record',
        fullPath: '/mood/record?source=expired',
        meta: {},
      },
    },
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
  default: {
    push: mocks.routerPush,
    currentRoute: mocks.currentRoute,
  },
}))

const response = (data: unknown) => ({ data, config: {} })

describe('request response contract', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
    mocks.currentRoute.value = {
      path: '/mood/record',
      fullPath: '/mood/record?source=expired',
      meta: {},
    }
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

  it('normalizes a 401 HTTP error, clears the expired login, and preserves current route', async () => {
    const { ApiRequestError } = await import('@/utils/request')

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
    // A2-02: 401 处理不再清除 localStorage，改用 HttpOnly Cookie + 重定向
    expect(mocks.routerPush).toHaveBeenCalledWith({
      path: '/login',
      query: { redirect: '/mood/record?source=expired' },
    })

    mocks.responseHandlers.fulfilled?.(response({ code: 0, message: 'ok', data: null }))
  })

  it('suppresses duplicate redirect and message for concurrent 401 responses', async () => {
    const { ApiRequestError } = await import('@/utils/request')

    const first = mocks.responseHandlers.rejected?.({
      config: {},
      response: { status: 401, data: { code: 1002, message: '令牌已过期', data: null } },
    })
    const second = mocks.responseHandlers.rejected?.({
      config: {},
      response: { status: 401, data: { code: 1002, message: '令牌已过期', data: null } },
    })

    await expect(first).rejects.toBeInstanceOf(ApiRequestError)
    await expect(second).rejects.toBeInstanceOf(ApiRequestError)
    expect(mocks.routerPush).toHaveBeenCalledTimes(1)
    expect(mocks.messageError).toHaveBeenCalledTimes(1)

    mocks.responseHandlers.fulfilled?.(response({ code: 0, message: 'ok', data: null }))
  })

  it('does not redirect on 401 when current route is public', async () => {
    const { ApiRequestError } = await import('@/utils/request')
    mocks.currentRoute.value = {
      path: '/register',
      fullPath: '/register',
      meta: { public: true, guestOnly: true },
    }

    const promise = mocks.responseHandlers.rejected?.({
      config: {},
      response: { status: 401, data: { code: 1002, message: '令牌已过期', data: null } },
    })

    await expect(promise).rejects.toBeInstanceOf(ApiRequestError)
    expect(mocks.routerPush).not.toHaveBeenCalled()
    expect(mocks.messageError).not.toHaveBeenCalled()
  })

  it('does not redirect on 401 when current route is guestOnly', async () => {
    const { ApiRequestError } = await import('@/utils/request')
    mocks.currentRoute.value = {
      path: '/login',
      fullPath: '/login',
      meta: { public: true, guestOnly: true },
    }

    const promise = mocks.responseHandlers.rejected?.({
      config: {},
      response: { status: 401, data: { code: 1002, message: '令牌已过期', data: null } },
    })

    await expect(promise).rejects.toBeInstanceOf(ApiRequestError)
    expect(mocks.routerPush).not.toHaveBeenCalled()
    expect(mocks.messageError).not.toHaveBeenCalled()
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

    expect(() =>
      mocks.responseHandlers.fulfilled?.(response({ source: 'no-code' }))
    ).toThrowError(ApiRequestError)
    expect(mocks.messageError).toHaveBeenCalledWith('响应缺少业务状态码')
  })
})
