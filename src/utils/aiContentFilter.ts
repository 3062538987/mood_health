import { debounce } from './debounce'
import type { AIContentFilterResult } from '@/types/ai'

/**
 * 敏感词列表（作为基础过滤）
 */
const SENSITIVE_WORDS = [
  '暴力',
  '恐怖',
  '自杀',
  '杀人',
  '毒品',
  '赌博',
  '色情',
  '诈骗',
  '传销',
  '邪教',
  '枪支',
  '炸弹',
  '爆炸',
  '投毒',
  '绑架',
  '勒索',
  '抢劫',
  '强奸',
  '猥亵',
  '卖淫',
  '嫖娼',
  '赌博',
  '吸毒',
  '贩毒',
  '制毒',
  '洗钱',
  '贪污',
  '受贿',
  '行贿',
  '诈骗',
  '敲诈',
  '勒索',
  '诽谤',
  '造谣',
  '传谣',
  '煽动',
  '颠覆',
  '分裂',
  '恐怖主义',
  '极端主义',
  '邪教组织',
  '黑社会',
  '黑恶势力',
  '涉黑',
  '涉恶',
  '涉毒',
  '涉黄',
  '涉赌',
  '涉枪',
  '涉爆',
  '涉恐',
  '涉邪',
  '涉诈',
  '涉骗',
  '涉黑涉恶',
  '涉黄涉赌',
  '涉毒涉枪',
  '涉恐涉爆',
  '涉邪涉诈',
  '涉黑涉恶涉毒',
  '涉黄涉赌涉枪',
  '涉恐涉爆涉邪',
  '涉诈涉骗涉黑',
  '涉恶涉毒涉黄',
  '涉赌涉枪涉爆',
  '涉恐涉邪涉诈',
  '涉黑涉恶涉毒涉黄',
  '涉赌涉枪涉爆涉邪',
  '涉恐涉邪涉诈涉骗',
  '涉黑涉恶涉毒涉黄涉赌',
  '涉枪涉爆涉邪涉诈涉骗',
  '涉黑涉恶涉毒涉黄涉赌涉枪',
  '涉爆涉邪涉诈涉骗涉黑涉恶',
  '涉毒涉黄涉赌涉枪涉爆涉邪',
  '涉邪涉诈涉骗涉黑涉恶涉毒涉黄',
  '涉赌涉枪涉爆涉邪涉诈涉骗涉黑涉恶',
  '涉恐涉邪涉诈涉骗涉黑涉恶涉毒涉黄涉赌',
  '涉枪涉爆涉邪涉诈涉骗涉黑涉恶涉毒涉黄涉赌涉恐',
  '涉爆涉邪涉诈涉骗涉黑涉恶涉毒涉黄涉赌涉枪涉爆',
  '涉邪涉诈涉骗涉黑涉恶涉毒涉黄涉赌涉枪涉爆涉邪',
  '涉诈涉骗涉黑涉恶涉毒涉黄涉赌涉枪涉爆涉邪涉诈',
  '涉骗涉黑涉恶涉毒涉黄涉赌涉枪涉爆涉邪涉诈涉骗',
  '涉黑涉恶涉毒涉黄涉赌涉枪涉爆涉邪涉诈涉骗涉黑',
  '涉恶涉毒涉黄涉赌涉枪涉爆涉邪涉诈涉骗涉黑涉恶',
  '涉毒涉黄涉赌涉枪涉爆涉邪涉诈涉骗涉黑涉恶涉毒',
  '涉黄涉赌涉枪涉爆涉邪涉诈涉骗涉黑涉恶涉毒涉黄',
  '涉赌涉枪涉爆涉邪涉诈涉骗涉黑涉恶涉毒涉黄涉赌',
  '涉枪涉爆涉邪涉诈涉骗涉黑涉恶涉毒涉黄涉赌涉枪',
  '涉爆涉邪涉诈涉骗涉黑涉恶涉毒涉黄涉赌涉枪涉爆',
  '涉邪涉诈涉骗涉黑涉恶涉毒涉黄涉赌涉枪涉爆涉邪',
  '涉诈涉骗涉黑涉恶涉毒涉黄涉赌涉枪涉爆涉邪涉诈',
  '涉骗涉黑涉恶涉毒涉黄涉赌涉枪涉爆涉邪涉诈涉骗',
]

/**
 * 内容审核结果接口
 * @interface ContentFilterResult
 * @property {boolean} isSafe - 是否安全
 * @property {string[]} detectedWords - 检测到的敏感词
 * @property {string} severity - 严重程度（low/medium/high）
 */
export interface ContentFilterResult {
  isSafe: boolean
  detectedWords: string[]
  severity: 'low' | 'medium' | 'high'
}

/**
 * AI内容审核
 * @param content 待审核的内容
 * @returns 审核结果
 */
export const filterContent = async (content: string): Promise<AIContentFilterResult> => {
  try {
    // 数据脱敏处理
    const sanitizedContent = sanitizeContent(content)

    // P0下线: 后端暂无 /api/ai/content-filter，保留结构并走本地审核
    // const response = await request<AIContentFilterResult>({
    //   url: buildAiApiUrl('/content-filter'),
    //   method: 'post',
    //   data: {
    //     content: sanitizedContent,
    //   },
    // })

    return getLocalContentFilter(sanitizedContent)
  } catch (error) {
    console.error('AI content filter error:', error)
    // 本地fallback方案
    return getLocalContentFilter(content)
  }
}

/**
 * 防抖版本的内容审核
 * @param content 待审核的内容
 * @returns 审核结果
 */
export const debouncedFilterContent = debounce((...args: unknown[]) => {
  const [content] = args
  return filterContent(content as string)
}, 500)

/**
 * 检查内容是否应该自动拒绝
 * @param content 待审核的内容
 * @returns 是否应该自动拒绝
 */
export const shouldAutoReject = async (content: string): Promise<boolean> => {
  const result = await filterContent(content)
  return !result.isSafe && result.severity === 'high'
}

/**
 * 检查内容是否应该标记为需要人工审核
 * @param content 待审核的内容
 * @returns 是否应该标记为需要人工审核
 */
export const shouldMarkForReview = async (content: string): Promise<boolean> => {
  const result = await filterContent(content)
  return !result.isSafe && result.severity !== 'high'
}

/**
 * 数据脱敏处理
 * @param content 原始内容
 * @returns 脱敏后的内容
 */
const sanitizeContent = (content: string): string => {
  // 简单的脱敏处理，实际项目中可以根据需要扩展
  return content
    .replace(/\d{11}/g, '***') // 隐藏手机号
    .replace(/\d{18}/g, '***') // 隐藏身份证号
    .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '***') // 隐藏邮箱
    .replace(/https?:\/\/[^\s]+/g, '***') // 隐藏链接
}

/**
 * 本地内容过滤fallback方案
 * @param content 待审核的内容
 * @returns 审核结果
 */
const getLocalContentFilter = (content: string): AIContentFilterResult => {
  const detectedIssues: string[] = []
  const lowerContent = content.toLowerCase()

  // 检查敏感词
  for (const word of SENSITIVE_WORDS) {
    if (lowerContent.includes(word.toLowerCase())) {
      detectedIssues.push(word)
    }
  }

  // 检查其他违规内容
  if (content.length > 5000) {
    detectedIssues.push('内容过长')
  }

  if (detectedIssues.length === 0) {
    return {
      isSafe: true,
      detectedIssues: [],
      severity: 'low',
      suggestion: '内容安全，可以发布',
    }
  }

  let severity: 'low' | 'medium' | 'high' = 'low'
  if (detectedIssues.length >= 3) {
    severity = 'high'
  } else if (detectedIssues.length >= 2) {
    severity = 'medium'
  }

  let suggestion = '内容存在问题，建议修改后重新提交'
  if (severity === 'high') {
    suggestion = '内容违规，无法发布'
  }

  return {
    isSafe: false,
    detectedIssues,
    severity,
    suggestion,
  }
}
