export interface ApiResponse<T> {
  code: number
  message: string
  data: T
  requestId?: string
  details?: Array<{ field: string; message: string }>
}

export type ApiRequestErrorKind = 'business' | 'http' | 'network' | 'config'

export interface ApiRequestErrorOptions {
  kind: ApiRequestErrorKind
  message: string
  code?: number
  status?: number
  data?: unknown
  cause?: unknown
  requestId?: string
}

export type SafeResult<T> =
  | { ok: true; data: T }
  | { ok: false; message: string; status?: number }
