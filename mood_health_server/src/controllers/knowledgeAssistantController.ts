import { HTTP_STATUS } from '../utils/httpStatus'
import type { Response } from 'express'
import type { AuthRequest } from '../middleware/auth'
import {
  answerKnowledgeQuestion,
  getKnowledgeMessages,
  getKnowledgeSessions,
  KnowledgeAssistantError,
} from '../services/knowledgeAssistantService'
import { FastApiClientError } from '../services/fastApiClient'
import { apiFailure, apiSuccess, businessCodeForHttpStatus } from '../utils/apiResponse'

const errorStatus = (error: unknown): number => {
  if (error instanceof KnowledgeAssistantError) return error.statusCode
  if (error instanceof FastApiClientError) {
    const s = error.status
    if (s === 'network' || s === 'timeout') return 503
    if (s === 'config') return 500
    if (s === 'invalid_json' || s === 'response_too_large') return 502
    if (s === 503) return 503
    if (typeof s === 'number') return 502
    return 500
  }
  // 兼容旧式 Axios 错误对象
  const upstreamStatus = (error as { response?: { status?: number } })?.response?.status
  if (upstreamStatus === 503) return 503
  if (typeof upstreamStatus === 'number') return 502
  return 500
}

const errorRequestId = (error: unknown): string | undefined => {
  if (error instanceof FastApiClientError && typeof error.requestId === 'string') {
    return error.requestId
  }
  const data = (error as { response?: { data?: Record<string, unknown> } })?.response?.data
  const requestId = data?.requestId ?? data?.request_id
  return typeof requestId === 'string' ? requestId : undefined
}

const sendError = (res: Response, error: unknown) => {
  const status = errorStatus(error)
  const message = error instanceof KnowledgeAssistantError
    ? error.message
    : status === 503
      ? '知识助手暂未就绪，请稍后重试'
      : status === 502
        ? '知识助手服务响应异常'
        : '知识助手服务异常'
  const requestId = errorRequestId(error)
  return res
    .status(status)
    .json(apiFailure(businessCodeForHttpStatus(status), message, requestId ? { requestId } : null))
}

export const postMessage = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId
    if (!userId) return res.status(HTTP_STATUS.UNAUTHORIZED).json(apiFailure(businessCodeForHttpStatus(401), '未登录'))
    const data = await answerKnowledgeQuestion(userId, req.body.message, req.body.sessionId)
    return res.json(apiSuccess(data))
  } catch (error) {
    return sendError(res, error)
  }
}

export const getSessions = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId
    if (!userId) return res.status(HTTP_STATUS.UNAUTHORIZED).json(apiFailure(businessCodeForHttpStatus(401), '未登录'))
    return res.json(apiSuccess(await getKnowledgeSessions(userId)))
  } catch (error) {
    return sendError(res, error)
  }
}

export const getMessages = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId
    if (!userId) return res.status(HTTP_STATUS.UNAUTHORIZED).json(apiFailure(businessCodeForHttpStatus(401), '未登录'))
    const sessionId = String(req.params.sessionId)
    return res.json(apiSuccess(await getKnowledgeMessages(userId, sessionId)))
  } catch (error) {
    return sendError(res, error)
  }
}
