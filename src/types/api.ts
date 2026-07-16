export interface ApiResponse<T> {
  code: number
  message: string
  data: T
}

export type ApiRequestErrorKind = 'business' | 'http' | 'network' | 'config'

export interface ApiRequestErrorOptions {
  kind: ApiRequestErrorKind
  message: string
  code?: number
  status?: number
  data?: unknown
  cause?: unknown
}
