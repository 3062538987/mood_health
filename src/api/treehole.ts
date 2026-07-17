/**
 * 树洞 API
 * 调用后端 AI 生成温柔回复
 */

import request from '@/utils/request'

const SENSITIVE_WORDS = ['暴力', '色情', '赌博', '毒品', '诈骗', '违法', '攻击']

export interface GentleReplyResponse {
  reply: string
  is_fallback: boolean
}

/**
 * 检查敏感内容
 */
export const checkSensitiveContent = (content: string): boolean => {
  return SENSITIVE_WORDS.some((word) => content.includes(word))
}

/**
 * 验证树洞内容
 */
export const validateTreeHoleContent = (content: string): string | null => {
  if (!content || !content.trim()) {
    return '内容不能为空'
  }
  if (content.length > 1000) {
    return '内容长度不能超过1000字'
  }
  if (checkSensitiveContent(content)) {
    return '内容包含敏感信息，请修改后重试'
  }
  return null
}

/**
 * 生成树洞温柔回复
 * @param content 倾诉内容
 * @returns 温柔回复
 */
export const generateGentleReply = async (content: string): Promise<GentleReplyResponse> => {
  if (!content || !content.trim()) {
    throw new Error('内容不能为空')
  }

  if (content.length > 1000) {
    throw new Error('内容长度不能超过1000字')
  }

  const res = await request<GentleReplyResponse>({
    url: '/api/ai/treehole/gentle-reply',
    method: 'post',
    data: { content },
  })

  return res
}