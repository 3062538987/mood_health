/**
 * 树洞温柔回复 API 模块
 *
 * 提供树洞帖子的温柔回复功能
 */

import request from '@/utils/request'
import { ElMessage } from 'element-plus'
import { buildAiApiUrl } from '@/utils/apiBase'

/**
 * 温柔回复请求参数
 */
export interface GentleReplyRequest {
  /** 用户的树洞内容 */
  content: string
  /** 用户ID（可选，用于记录调用日志） */
  user_id?: number
}

/**
 * 温柔回复响应结果
 */
export interface GentleReplyResponse {
  /** 温柔回复内容 */
  reply: string
  /** 是否为兜底回复 */
  is_fallback: boolean
}

/**
 * 生成树洞温柔回复
 *
 * @param data - 请求参数
 * @returns 温柔回复响应
 * @throws 当内容为空或请求失败时抛出错误
 */
export const generateGentleReply = async (
  data: GentleReplyRequest
): Promise<GentleReplyResponse> => {
  // 内容为空拦截
  if (!data.content || !data.content.trim()) {
    throw new Error('内容不能为空')
  }

  // 内容长度检查
  if (data.content.length > 1000) {
    throw new Error('内容长度不能超过1000字')
  }

  try {
    const response = await request<GentleReplyResponse>({
      url: buildAiApiUrl('/treehole/gentle-reply'),
      method: 'post',
      data: {
        content: data.content.trim(),
        user_id: data.user_id,
      },
      timeout: 35000, // 35秒超时，给AI生成留出足够时间
    })

    return response
  } catch (error: any) {
    console.error('生成温柔回复失败:', error)

    // 统一错误处理
    if (error.response) {
      const status = error.response.status
      const message = error.response.data?.detail || error.response.data?.message

      if (status === 400) {
        throw new Error(message || '请求参数错误')
      } else if (status === 429) {
        throw new Error('请求太频繁，请稍后再试')
      } else if (status >= 500) {
        // 服务器错误，返回兜底文案
        return getFallbackReply()
      }
    } else if (error.code === 'ECONNABORTED') {
      // 请求超时，返回兜底文案
      return getFallbackReply()
    } else if (error.message && error.message.includes('Network Error')) {
      // 网络错误，返回兜底文案
      return getFallbackReply()
    }

    // 其他错误，返回兜底文案
    return getFallbackReply()
  }
}

/**
 * 生成树洞温柔回复（带重试机制）
 *
 * @param data - 请求参数
 * @param maxRetries - 最大重试次数，默认2次
 * @returns 温柔回复响应
 */
export const generateGentleReplyWithRetry = async (
  data: GentleReplyRequest,
  maxRetries: number = 2
): Promise<GentleReplyResponse> => {
  // 内容为空拦截
  if (!data.content || !data.content.trim()) {
    throw new Error('内容不能为空')
  }

  // 内容长度检查
  if (data.content.length > 1000) {
    throw new Error('内容长度不能超过1000字')
  }

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await request<GentleReplyResponse>({
        url: buildAiApiUrl('/treehole/gentle-reply'),
        method: 'post',
        data: {
          content: data.content.trim(),
          user_id: data.user_id,
        },
        timeout: 35000,
      })

      return response
    } catch (error: any) {
      console.error(`生成温柔回复失败 (尝试 ${attempt + 1}/${maxRetries + 1}):`, error)

      // 如果是最后一次尝试，返回兜底文案
      if (attempt === maxRetries) {
        return getFallbackReply()
      }

      // 等待后重试（指数退避）
      const delay = Math.pow(2, attempt) * 1000
      await new Promise((resolve) => setTimeout(resolve, delay))
    }
  }

  // 所有重试都失败，返回兜底文案
  return getFallbackReply()
}

/**
 * 获取兜底回复文案
 *
 * @returns 兜底回复响应
 */
const getFallbackReply = (): GentleReplyResponse => {
  const fallbackReplies = [
    '你的感受很重要，无论遇到什么，都请记得照顾好自己。',
    '每个人都会有低落的时候，这很正常。给自己一些时间，慢慢恢复。',
    '谢谢你愿意分享你的心事。请记住，你并不孤单。',
    '生活中的困难都是暂时的，相信你一定能够度过这个阶段。',
    '你的努力和坚持都值得被看到。请对自己温柔一点。',
    '有时候，允许自己放松也是一种勇敢。抱抱你。',
    '无论今天过得怎样，明天都是新的开始。',
    '你的存在本身就是一种美好，请珍惜自己。',
  ]

  const randomReply = fallbackReplies[Math.floor(Math.random() * fallbackReplies.length)]

  return {
    reply: randomReply,
    is_fallback: true,
  }
}

/**
 * 检查内容是否包含敏感词
 *
 * @param content - 需要检查的内容
 * @returns 是否包含敏感词
 */
export const checkSensitiveContent = (content: string): boolean => {
  const sensitiveWords = [
    '自杀',
    '自残',
    '跳楼',
    '杀人',
    '暴力',
    '血腥',
    '色情',
    '赌博',
    '毒品',
    '吸毒',
    '贩毒',
    '诈骗',
    '黑客',
    '攻击',
  ]

  const contentLower = content.toLowerCase()
  return sensitiveWords.some((word) => contentLower.includes(word))
}

/**
 * 验证树洞内容
 *
 * @param content - 需要验证的内容
 * @returns 验证结果，通过返回null，不通过返回错误信息
 */
export const validateTreeHoleContent = (content: string): string | null => {
  // 空内容检查
  if (!content || !content.trim()) {
    return '内容不能为空'
  }

  // 长度检查
  if (content.length > 1000) {
    return '内容长度不能超过1000字'
  }

  // 敏感词检查
  if (checkSensitiveContent(content)) {
    return '内容包含不当信息，请修改后重试'
  }

  return null
}

/**
 * 提交树洞帖子并获取温柔回复
 *
 * @param content - 树洞内容
 * @param userId - 用户ID
 * @returns 温柔回复响应
 */
export const submitTreeHoleAndGetReply = async (
  content: string,
  userId?: number
): Promise<GentleReplyResponse> => {
  // 前端验证
  const validationError = validateTreeHoleContent(content)
  if (validationError) {
    ElMessage.warning(validationError)
    throw new Error(validationError)
  }

  try {
    const response = await generateGentleReplyWithRetry({
      content: content,
      user_id: userId,
    })

    // 如果是兜底回复，显示提示
    if (response.is_fallback) {
      console.log('使用了兜底回复文案')
    }

    return response
  } catch (error: any) {
    console.error('提交树洞并获取回复失败:', error)

    // 显示错误提示
    if (error.message) {
      ElMessage.error(error.message)
    } else {
      ElMessage.error('获取回复失败，请稍后重试')
    }

    throw error
  }
}
