/**
 * 心理咨询API
 * 提供心理咨询对话功能，调用后端 DeepSeek AI 接口
 */

import request from '@/utils/request'

/**
 * AI 推理轨迹单步 —— 用于「AI 是怎么想的」可解释面板。
 */
export interface ReasoningStep {
  phase: string
  label: string
  detail?: string | null
}

/**
 * 心理咨询请求接口
 */
export interface CounselingRequest {
  message: string
  userId?: number
  context?: Array<{
    role: 'user' | 'assistant'
    content: string
  }>
  mood?: string[]
}

/**
 * 心理咨询响应接口
 */
export interface CounselingResponse {
  response: string
  mood?: string
  riskLevel?: 'low' | 'medium' | 'high'
  suggestion?: string
  hasRiskContent?: boolean
}

/**
 * 发送心理咨询消息
 * @param data 咨询请求数据
 * @returns 咨询响应
 */
export const sendCounselingMessage = async (
  data: CounselingRequest
): Promise<CounselingResponse> => {
  if (!data.message || !data.message.trim()) {
    throw new Error('消息内容不能为空')
  }

  if (data.message.length > 1000) {
    throw new Error('消息内容不能超过1000字')
  }

  const res = await request<CounselingResponse>({
    url: '/api/ai/counseling',
    method: 'post',
    data: {
      message: data.message,
      context: data.context,
    },
  })

  return res
}

/**
 * 带上下文的心理咨询
 * @param data 咨询请求数据
 * @returns 咨询响应
 */
export const sendCounselingMessageWithContext = async (
  data: CounselingRequest
): Promise<CounselingResponse> => {
  if (!data.context || data.context.length === 0) {
    throw new Error('上下文不能为空')
  }

  if (data.context.length > 10) {
    throw new Error('上下文长度不能超过10条消息')
  }

  return sendCounselingMessage(data)
}

/**
 * 验证心理咨询请求
 * @param data 咨询请求数据
 * @returns 是否有效
 */
export const validateCounselingRequest = (data: CounselingRequest): boolean => {
  if (!data.message || !data.message.trim()) {
    return false
  }

  if (data.message.length > 1000) {
    return false
  }

  if (data.context && data.context.length > 10) {
    return false
  }

  return true
}

/**
 * 格式化对话历史为上下文格式
 * @param messages 对话历史
 * @returns 上下文数组
 */
export const formatMessagesToContext = (
  messages: Array<{
    role: 'user' | 'assistant'
    content: string
  }>
): Array<{
  role: 'user' | 'assistant'
  content: string
}> => {
  return messages.map((msg) => ({
    role: msg.role,
    content: msg.content,
  }))
}

/**
 * 会话列表项
 */
export interface SessionItem {
  sessionId: string
  title: string
  createdAt: string
  lastMessageAt: string
  messageCount: number
}

export interface SessionMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
  createdAt?: string
  sources?: KnowledgeSource[]
}

export interface KnowledgeSource {
  title: string
  reference: string
}

export interface SessionCounselingResponse {
  response: string
  sessionId: string
  riskLevel?: string
  hasRiskContent?: boolean
  suggestion?: string
  fallbackUsed?: boolean
  provider?: string | null
  model?: string | null
  sources: KnowledgeSource[]
  groundingUsed: boolean
  requestId: string
  reasoningSteps?: ReasoningStep[]
  webSearchStatus?: 'not_requested' | 'not_needed' | 'used' | 'failed'
}

/**
 * 获取会话列表
 */
export function getSessions() {
  return request<SessionItem[]>({
    url: '/api/counseling/sessions',
    method: 'get',
  })
}

/**
 * 加载指定会话的消息
 */
export function loadSessionMessages(sessionId: string) {
  return request<SessionMessage[]>({
    url: `/api/counseling/sessions/${sessionId}`,
    method: 'get',
  })
}

/**
 * 重命名指定会话
 */
export function renameSession(sessionId: string, title: string) {
  return request<{ sessionId: string; title: string }>({
    url: `/api/counseling/sessions/${sessionId}`,
    method: 'patch',
    data: { title },
  })
}

/**
 * 发送基于会话的咨询消息
 */
export function sendSessionCounselingMessage(data: { message: string; sessionId: string }) {
  return request<SessionCounselingResponse>({
    url: '/api/counseling/send',
    method: 'post',
    data,
    timeout: 60_000,
  })
}
