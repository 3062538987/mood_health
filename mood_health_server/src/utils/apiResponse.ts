import { randomUUID } from 'node:crypto'

export interface ApiResponse<T> {
  code: number
  message: string
  data: T
  requestId: string
}

export const API_ERROR_CODES = {
  BAD_REQUEST: 1001,
  UNAUTHORIZED: 1002,
  FORBIDDEN: 1003,
  NOT_FOUND: 1004,
  CONFLICT: 1009,
  FEATURE_DISABLED: 1403,
  INTERNAL_ERROR: 1500,
  SERVICE_UNAVAILABLE: 1503,
} as const

export const apiSuccess = <T>(data: T, message = '操作成功'): ApiResponse<T> => ({
  code: 0,
  message,
  data,
  requestId: randomUUID(),
})

export const apiFailure = <T = null>(
  code: number,
  message: string,
  data: T = null as T
): ApiResponse<T> => {
  if (code === 0) {
    throw new Error('失败响应必须使用非零业务码')
  }

  const businessCode = code >= 400 && code < 600 ? businessCodeForHttpStatus(code) : code

  return { code: businessCode, message, data, requestId: randomUUID() }
}

export const businessCodeForHttpStatus = (statusCode: number): number => {
  switch (statusCode) {
    case 400:
      return API_ERROR_CODES.BAD_REQUEST
    case 401:
      return API_ERROR_CODES.UNAUTHORIZED
    case 403:
      return API_ERROR_CODES.FORBIDDEN
    case 404:
      return API_ERROR_CODES.NOT_FOUND
    case 409:
      return API_ERROR_CODES.CONFLICT
    case 503:
      return API_ERROR_CODES.SERVICE_UNAVAILABLE
    default:
      return statusCode >= 500 ? API_ERROR_CODES.INTERNAL_ERROR : API_ERROR_CODES.BAD_REQUEST
  }
}
