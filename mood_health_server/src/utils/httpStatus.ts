/**
 * HTTP 状态码命名常量，用于替代散落在各控制器/服务中的魔法数字。
 *
 * 用法：
 *   import { HTTP_STATUS } from '../utils/httpStatus'
 *   res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(apiFailure(...))
 *
 * 注意：仅覆盖本项目中实际出现的状态码；如需其它码可自行补充。
 */
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  ACCEPTED: 202,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  BAD_GATEWAY: 502,
  SERVICE_UNAVAILABLE: 503,
} as const

export type HttpStatusCode = (typeof HTTP_STATUS)[keyof typeof HTTP_STATUS]
