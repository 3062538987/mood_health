import { randomUUID } from 'crypto'
import {
  callAssistantResponse,
  AssistantSource,
  WebSearchStatus,
} from './fastApiClient'
import { loadSession, saveMessagePair } from './counselingSessionService'
import logger from '../utils/logger'

const RISK_KEYWORDS = [
  '自杀',
  '自尽',
  '轻生',
  '寻死',
  '自残',
  '自虐',
  '割腕',
  '伤害自己',
  '不想活',
  '活不下去',
]

const NORMAL_FALLBACK =
  '当前 AI 服务暂时无法连接，因此未生成真实 AI 回复。你可以稍后再试；如果压力已经明显影响学习、睡眠或安全感，建议联系学校心理中心或可信任的老师同学获得支持。'
const RISK_FALLBACK =
  '当前 AI 服务暂时无法连接，因此未生成真实 AI 回复。你的表达包含较高风险信号，请先联系身边可信任的人或学校心理中心；如果你正处于紧急危险中，请立即拨打当地急救电话或心理危机热线。'

export interface UnifiedAssistantResult {
  response: string
  sessionId: string
  riskLevel: 'low' | 'medium'
  hasRiskContent: boolean
  suggestion?: string
  sources: AssistantSource[]
  groundingUsed: boolean
  requestId: string
  provider: string | null
  model: string | null
  fallbackUsed: boolean
  webSearchStatus: WebSearchStatus
}

export const containsRiskContent = (message: string): boolean =>
  RISK_KEYWORDS.some((keyword) => message.includes(keyword))

export async function generateUnifiedAssistantResponse(
  userId: number,
  sessionId: string,
  message: string,
  allowWebSearch: boolean
): Promise<UnifiedAssistantResult> {
  const hasRiskContent = containsRiskContent(message)
  const history = (await loadSession(userId, sessionId, 10))
    .filter((item) => item.role === 'user' || item.role === 'assistant')
    .map((item) => ({
      role: item.role as 'user' | 'assistant',
      content: item.content,
    }))
  const requestId = randomUUID()
  let responseRequestId: string = requestId

  let response: string
  let sources: AssistantSource[] = []
  let groundingUsed = false
  let provider: string | null = null
  let model: string | null = null
  let fallbackUsed = false
  let webSearchStatus: WebSearchStatus = allowWebSearch ? 'failed' : 'not_requested'

  try {
    const result = await callAssistantResponse({
      query: message,
      requestId,
      history,
      riskDetected: hasRiskContent,
      allowWebSearch,
    })
    response = result.answer
    sources = result.sources
    groundingUsed = result.groundingUsed
    provider = result.provider
    model = result.model
    responseRequestId = result.requestId
    webSearchStatus = result.webSearchStatus
  } catch (error) {
    fallbackUsed = true
    response = hasRiskContent ? RISK_FALLBACK : NORMAL_FALLBACK
    logger.warn('统一 AI 心理助手不可用，返回显式降级响应', {
      userId,
      sessionId,
      requestId,
      error: error instanceof Error ? error.message : String(error),
      fallbackUsed,
    })
  }

  await saveMessagePair(userId, sessionId, message, response, {
    sources,
    requestId: responseRequestId,
    provider,
    model,
    groundingUsed,
    fallbackUsed,
    webSearchStatus,
  })

  return {
    response,
    sessionId,
    riskLevel: hasRiskContent ? 'medium' : 'low',
    hasRiskContent,
    suggestion: hasRiskContent
      ? '如果你正在经历困难，建议寻求专业心理咨询师的帮助'
      : undefined,
    sources,
    groundingUsed,
    requestId: responseRequestId,
    provider,
    model,
    fallbackUsed,
    webSearchStatus,
  }
}
