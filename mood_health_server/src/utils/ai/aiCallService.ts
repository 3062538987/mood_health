/**
 * AI 调用服务
 * 将 Prompt 模板与 AI 客户端对接，提供统一的 AI 调用入口
 */

import { callChatCompletion } from './aiClient'
import promptService from '../../services/promptService'
import type { PromptTemplate, PromptCategory } from '../../repositories/promptRepository'
import aiConfig from '../../config/aiConfig'
import logger from '../logger'

// 模板缓存，避免每次调用都查询数据库
let templateCache: PromptTemplate[] | null = null
let templateCacheTime = 0
const TEMPLATE_CACHE_TTL = 60_000 // 60秒

const loadAllTemplates = async (): Promise<PromptTemplate[]> => {
  const now = Date.now()
  if (templateCache && now - templateCacheTime < TEMPLATE_CACHE_TTL) {
    return templateCache
  }

  const categories: PromptCategory[] = ['assessment_interpretation', 'mood_report', 'counseling', 'recommendation']
  const results = await Promise.all(categories.map((cat) => promptService.getActiveByCategory(cat)))
  const allTemplates = results.flat()

  templateCache = allTemplates
  templateCacheTime = now
  return allTemplates
}

/**
 * 使用 Prompt 模板调用 AI
 * @param templateName 模板名称
 * @param variables 变量映射
 * @param options 额外选项
 * @returns AI 生成的文本
 */
export const callWithTemplate = async (
  templateName: string,
  variables: Record<string, string> = {},
  options: { model?: string; temperature?: number; maxTokens?: number; userId?: number; injectProfile?: boolean } = {}
): Promise<string> => {
  if (!aiConfig.enabled) {
    throw new Error('AI 服务未启用，请设置 AI_ENABLED=true')
  }

  // 从数据库加载模板（带缓存+降级）
  let allTemplates: PromptTemplate[] = [];
  try {
    allTemplates = await loadAllTemplates();
  } catch (error) {
    logger.error("加载 AI 模板失败，使用空模板列表:", error);
    // 如果模板加载失败，尝试直接调用（适用于 callDirect）
    if (templateName === 'direct') {
      logger.warn("模板加载失败，回退到直接调用模式");
      allTemplates = [];
    } else {
      throw new Error("AI 模板加载失败，服务暂时不可用");
    }
  }
  const template = allTemplates.find((t) => t.name === templateName)

  if (!template) {
    throw new Error(`Prompt 模板 "${templateName}" 不存在或未启用`)
  }

  // 填充模板变量
  let userPrompt = template.userPromptTemplate
  for (const [key, value] of Object.entries(variables)) {
    userPrompt = userPrompt.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value)
  }

  const messages: Array<{ role: 'system' | 'user'; content: string }> = [
    { role: 'system', content: template.systemPrompt },
    { role: 'user', content: userPrompt },
  ]

  logger.info(`AI call with template: ${templateName}, model: ${options.model || template.model}`)

  return callChatCompletion(messages, {
    model: options.model || template.model,
    temperature: options.temperature ?? template.temperature,
    maxTokens: options.maxTokens ?? template.maxTokens,
    userId: options.userId,
    injectProfile: options.injectProfile,
  })
}

/**
 * 直接调用 AI（不使用模板）
 * @param systemPrompt 系统提示词
 * @param userPrompt 用户提示词
 * @param options 选项
 * @returns AI 生成的文本
 */
export const callDirect = async (
  systemPrompt: string,
  userPrompt: string,
  options: { model?: string; temperature?: number; maxTokens?: number; userId?: number; injectProfile?: boolean } = {}
): Promise<string> => {
  if (!aiConfig.enabled) {
    throw new Error('AI 服务未启用，请设置 AI_ENABLED=true')
  }

  const messages: Array<{ role: 'system' | 'user'; content: string }> = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ]

  return callChatCompletion(messages, {
    model: options.model || aiConfig.models.moodAnalysis,
    temperature: options.temperature ?? 0.7,
    maxTokens: options.maxTokens ?? 2048,
    userId: options.userId,
    injectProfile: options.injectProfile,
  })
}

/**
 * 检查 AI 是否可用
 */
export const isAiAvailable = (): boolean => {
  return aiConfig.enabled && !!(process.env.AI_SERVICE_BASE_URL || aiConfig.apiKey)
}