import axios, {
  AxiosError,
  AxiosRequestConfig,
  AxiosResponse,
  InternalAxiosRequestConfig,
} from 'axios'
import { ElLoading, ElMessage } from 'element-plus'
import router from '@/router'
import type { ApiRequestErrorOptions, ApiResponse } from '@/types/api'
import { getApiBaseUrl } from '@/utils/apiBase'

type ApiPayload<T = unknown> = Partial<ApiResponse<T>> & Record<string, unknown>

type RequestConfigWithLoading = InternalAxiosRequestConfig & {
  _withLoading?: boolean
  showLoading?: boolean
}

export class ApiRequestError extends Error {
  readonly kind: ApiRequestErrorOptions['kind']
  readonly code?: number
  readonly status?: number
  readonly data?: unknown
  readonly cause?: unknown

  constructor(options: ApiRequestErrorOptions) {
    super(options.message)
    this.name = 'ApiRequestError'
    this.kind = options.kind
    this.code = options.code
    this.status = options.status
    this.data = options.data
    this.cause = options.cause
  }
}

let loadingCount = 0
let loadingInstance: ReturnType<typeof ElLoading.service> | null = null
const apiBaseUrl = getApiBaseUrl()
const apiBaseUsesApiPrefix = apiBaseUrl.endsWith('/api')

const startLoading = () => {
  if (loadingCount === 0) {
    loadingInstance = ElLoading.service({
      lock: true,
      text: '加载中...',
      background: 'rgba(0, 0, 0, 0.7)',
    })
  }
  loadingCount++
}

const endLoading = () => {
  if (loadingCount > 0) {
    loadingCount--
  }
  if (loadingCount === 0 && loadingInstance) {
    loadingInstance.close()
    loadingInstance = null
  }
}

const isApiPayload = (value: unknown): value is ApiPayload =>
  typeof value === 'object' && value !== null

const unwrapResponse = <T>(payload: unknown): T => {
  if (!isApiPayload(payload) || payload.code === undefined) {
    throw new ApiRequestError({
      kind: 'business',
      message: '响应缺少业务状态码',
      data: payload,
    })
  }

  if (payload.code === 0) {
    return payload.data as T
  }

  throw new ApiRequestError({
    kind: 'business',
    code: typeof payload.code === 'number' ? payload.code : undefined,
    message: typeof payload.message === 'string' ? payload.message : '请求失败',
    data: payload.data,
  })
}

const service = axios.create({
  baseURL: apiBaseUrl,
  timeout: 10000,
  withCredentials: true, // 安全: 发送 HttpOnly Cookie 认证令牌 (VUE-AUTH-001)
  headers: {
    'Content-Type': 'application/json',
  },
})

service.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const typedConfig = config as RequestConfigWithLoading
    if (typedConfig.showLoading !== false) {
      startLoading()
      typedConfig._withLoading = true
    }

    if (apiBaseUsesApiPrefix && config.url?.startsWith('/api/')) {
      config.url = config.url.slice(4)
    }

    // 安全: Token 通过 HttpOnly Cookie 自动发送，无需手动添加 Authorization 头 (VUE-AUTH-001)
    return config
  },
  (error: unknown) => {
    endLoading()
    const requestError = new ApiRequestError({
      kind: 'config',
      message: '请求发送失败',
      cause: error,
    })
    ElMessage.error(requestError.message)
    return Promise.reject(requestError)
  }
)

service.interceptors.response.use(
  (response: AxiosResponse) => {
    const responseConfig = response.config as RequestConfigWithLoading
    if (responseConfig._withLoading) {
      endLoading()
    }

    try {
      return unwrapResponse(response.data)
    } catch (error) {
      if (error instanceof ApiRequestError) {
        ElMessage.error(error.message)
      }
      throw error
    }
  },
  (error: AxiosError<ApiPayload>) => {
    const errorConfig = error.config as RequestConfigWithLoading | undefined
    if (errorConfig?._withLoading) {
      endLoading()
    }

    console.error('API Error:', error)

    if (error.response) {
      const status = error.response.status
      const responseData = error.response.data
      const responseMessage =
        typeof responseData?.message === 'string' ? responseData.message : undefined
      const code = typeof responseData?.code === 'number' ? responseData.code : undefined
      let message = responseMessage || `请求失败 (${status})`

      switch (status) {
        case 401:
          message = '登录已过期，请重新登录'
          router.push('/login')
          break
        case 403:
          message = responseMessage || '没有权限访问该资源'
          break
        case 404:
          message = responseMessage || '请求的资源不存在'
          break
        case 500:
          message = responseMessage || '服务器内部错误'
          break
      }

      const requestError = new ApiRequestError({
        kind: 'http',
        status,
        code,
        message,
        data: responseData?.data,
        cause: error,
      })
      ElMessage.error(requestError.message)
      return Promise.reject(requestError)
    }

    const requestError = new ApiRequestError({
      kind: error.request ? 'network' : 'config',
      message: error.request ? '网络连接失败，请检查网络' : '请求配置错误',
      cause: error,
    })
    ElMessage.error(requestError.message)
    return Promise.reject(requestError)
  }
)

const request = <T = unknown>(config: AxiosRequestConfig): Promise<T> => {
  return service.request(config) as Promise<T>
}

export default request
