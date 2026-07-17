/**
 * AI 安全服务
 * 提供输出安全校验、固定兜底、高风险处理
 */

import logger from '../logger'

/**
 * 安全兜底消息
 */
export const SAFETY_FALLBACK = {
  summary: '暂时无法生成分析，AI 服务暂时不可用，请稍后重试。',
  possibleCauses: '无法分析可能原因，请稍后重试。',
  todayActions: [
    '深呼吸，放松身心',
    '回顾今天的感受，写下来',
    '做一件让自己开心的小事',
  ],
  whenToSeekHelp: '如果持续感到不适，建议联系专业心理咨询师。',
}

/**
 * 高风险升级提示
 */
export const HIGH_RISK_ESCALATION = {
  prefix: '⚠️ 检测到高风险内容\n\n',
  suffix: '\n\n如果你正在经历严重的情绪困扰，请联系：\n- 全国心理援助热线：400-161-9995\n- 北京心理危机研究与干预中心：010-82951332',
  fixedResponse: {
    summary: '检测到高风险内容，建议立即寻求专业帮助。',
    possibleCauses: '无法通过 AI 分析高风险情况，请联系专业机构。',
    todayActions: [
      '立即联系信任的人，告诉他们你的感受',
      '拨打心理援助热线：400-161-9995',
      '前往最近的医院急诊科',
    ],
    whenToSeekHelp: '请立即联系专业机构，不要独自面对。',
  },
}

/**
 * 高风险关键词
 */
const HIGH_RISK_KEYWORDS = [
  '自杀', '自残', '自伤', '想死', '不想活', '活不下去',
  '结束生命', '了结', '轻生', '寻死', '杀了自己',
  '割腕', '跳楼', '上吊', '安眠药',
  '伤害别人', '杀人', '报复社会',
]

/**
 * 检测输入是否包含高风险内容
 */
export const detectHighRisk = (text: string): boolean => {
  if (!text) return false
  const lower = text.toLowerCase()
  return HIGH_RISK_KEYWORDS.some((kw) => lower.includes(kw))
}

/**
 * 校验输出字段完整性
 */
export const validateOutput = (output: Record<string, unknown>): boolean => {
  if (!output) return false
  const requiredFields = ['summary', 'possibleCauses', 'todayActions', 'whenToSeekHelp']
  return requiredFields.every((field) => {
    const val = output[field]
    if (field === 'todayActions') {
      return Array.isArray(val) && val.length > 0 && val.every((a: unknown) => typeof a === 'string' && a.trim())
    }
    return typeof val === 'string' && val.trim().length > 0
  })
}

/**
 * 获取安全兜底消息
 */
export const getSafeFallback = (isHighRisk: boolean) => {
  if (isHighRisk) {
    return HIGH_RISK_ESCALATION.fixedResponse
  }
  return { ...SAFETY_FALLBACK }
}

/**
 * 脱敏处理 - 移除输出中的敏感个人信息
 */
export const sanitizeOutput = (output: Record<string, unknown>): Record<string, unknown> => {
  const sanitized: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(output)) {
    if (typeof value === 'string') {
      sanitized[key] = value
        .replace(/\b1[3-9]\d{9}\b/g, '[手机号]')
        .replace(/\b\d{17}[\dXx]\b/g, '[身份证号]')
        .replace(/\b\d{6}\d{8}\d{4}\b/g, '[身份证号]')
    } else if (Array.isArray(value)) {
      sanitized[key] = value.map((v) =>
        typeof v === 'string'
          ? v
            .replace(/\b1[3-9]\d{9}\b/g, '[手机号]')
            .replace(/\b\d{17}[\dXx]\b/g, '[身份证号]')
          : v,
      )
    } else {
      sanitized[key] = value
    }
  }
  return sanitized
}

/**
 * 统一错误码
 */
export const AI_ERROR_CODES = {
  TIMEOUT: 1503,
  EMPTY_RESPONSE: 1504,
  FORMAT_ERROR: 1505,
  HIGH_RISK: 1506,
  SAFETY_BLOCKED: 1507,
}

/**
 * 构建安全响应
 */
export const buildSafeResponse = (errorCode: number, isHighRisk: boolean) => {
  const fallback = getSafeFallback(isHighRisk)

  let message = 'AI 服务暂时不可用'
  if (errorCode === AI_ERROR_CODES.TIMEOUT) message = 'AI 服务响应超时，请稍后重试'
  if (errorCode === AI_ERROR_CODES.EMPTY_RESPONSE) message = 'AI 服务返回空响应，请稍后重试'
  if (errorCode === AI_ERROR_CODES.FORMAT_ERROR) message = 'AI 响应格式异常，请稍后重试'
  if (errorCode === AI_ERROR_CODES.HIGH_RISK) message = '检测到高风险内容，建议寻求专业帮助'
  if (errorCode === AI_ERROR_CODES.SAFETY_BLOCKED) message = '内容因安全策略被拦截'

  logger.warn('AI 安全兜底触发', { errorCode, isHighRisk })

  return {
    code: errorCode,
    message,
    data: {
      analysis: fallback,
      isFallback: true,
      isHighRisk,
    },
  }
}