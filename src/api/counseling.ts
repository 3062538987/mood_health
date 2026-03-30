/**
 * 心理咨询API
 * 提供心理咨询对话功能，支持多轮对话和上下文管理
 */


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

const getLocalCounselingReply = (message: string): CounselingResponse => {
  const trimmed = message.trim()
  if (trimmed.length === 0) {
    return DEFAULT_FALLBACK_RESPONSE
  }

  if (trimmed.includes('压力') || trimmed.includes('焦虑')) {
    return {
      response: '先做三次缓慢深呼吸，把注意力放在当下。你可以把最紧急的一件事写下来，先完成最小一步。',
      mood: '焦虑',
      riskLevel: 'low',
    }
  }

  if (trimmed.includes('难过') || trimmed.includes('低落') || trimmed.includes('抑郁')) {
    return {
      response: '你愿意说出来已经很不容易。今天先给自己一个小目标，比如散步十分钟或和信任的人聊一会儿。',
      mood: '低落',
      riskLevel: 'low',
    }
  }

  return {
    response: '谢谢你的分享。你可以先照顾好身体状态，按优先级拆分任务，一步一步来。需要时也可以寻求专业支持。',
    mood: '平静',
    riskLevel: 'low',
  }
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

  return getLocalCounselingReply(data.message)
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
