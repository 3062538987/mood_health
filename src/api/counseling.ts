/**
 * 心理咨询API
 * 提供心理咨询对话功能，支持多轮对话和上下文管理
 */

import request from '@/utils/request'
import { buildAiApiUrl, isAiFeatureEnabled } from '@/utils/apiBase'

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
 * 网络异常时的兜底响应
 */
const DEFAULT_FALLBACK_RESPONSE: CounselingResponse = {
  response: '很抱歉，我暂时无法为你提供帮助，请稍后再试',
  mood: '平静',
  riskLevel: 'low',
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

  if (!isAiFeatureEnabled()) {
    return {
      ...DEFAULT_FALLBACK_RESPONSE,
      response:
        '倾诉已经是很勇敢的一步。当前系统处于离线陪伴模式，你可以先做一次深呼吸，给自己一点缓冲时间。',
    }
  }

  try {
    const response = await request<CounselingResponse>({
      url: buildAiApiUrl('/counseling'),
      method: 'post',
      data: {
        message: data.message.trim(),
        userId: data.userId,
        context: data.context,
        mood: data.mood,
      },
      timeout: 30000,
    })

    return response
  } catch (error: any) {
    console.error('心理咨询失败:', error)

    if (error.response) {
      const status = error.response.status

      if (status === 400) {
        throw new Error(error.response.data?.message || '请求参数错误')
      }

      if (status === 429) {
        throw new Error('请求过于频繁，请稍后再试')
      }
    }

    if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
      console.warn('请求超时，使用兜底响应')
      return DEFAULT_FALLBACK_RESPONSE
    }

    if (error.message?.includes('Network Error')) {
      console.warn('网络连接失败，使用兜底响应')
      return DEFAULT_FALLBACK_RESPONSE
    }

    console.warn('未知错误，使用兜底响应')
    return DEFAULT_FALLBACK_RESPONSE
  }
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
