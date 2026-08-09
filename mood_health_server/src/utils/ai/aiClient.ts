/**
 * Compatibility facade for the internal FastAPI chat-completion endpoint.
 */

import aiConfig from '../../config/aiConfig'
import {
  callChatCompletionRequest,
  ChatCompletionMessage,
} from '../../services/fastApiClient'
import { getUserProfile, profileToPromptText } from '../../services/userProfileService'
import { AiServiceError } from '../errors'
import logger from '../logger'

export interface ChatCompletionOptions {
  model?: string
  temperature?: number
  maxTokens?: number
  userId?: number
  injectProfile?: boolean
}

export const callChatCompletion = async (
  messages: ChatCompletionMessage[],
  options: ChatCompletionOptions = {}
): Promise<string> => {
  if (!aiConfig.enabled) {
    throw new AiServiceError('AI 服务未启用', null, 'chat', 'chat/completions')
  }

  let finalMessages = [...messages]
  if (options.injectProfile && options.userId) {
    try {
      const profile = await getUserProfile(options.userId)
      if (profile) {
        const profileText = profileToPromptText(profile)
        if (profileText) {
          const systemIndex = finalMessages.findIndex((message) => message.role === 'system')
          if (systemIndex >= 0) {
            finalMessages[systemIndex] = {
              ...finalMessages[systemIndex],
              content: `${finalMessages[systemIndex].content}\n\n${profileText}`,
            }
          } else {
            finalMessages.unshift({ role: 'system', content: profileText })
          }
        }
      }
    } catch {
      logger.warn('用户画像注入失败，继续正常调用')
    }
  }

  const response = await callChatCompletionRequest({
    messages: finalMessages,
    model: options.model || aiConfig.models.moodAnalysis,
    temperature: options.temperature ?? 0.7,
    maxTokens: options.maxTokens ?? 2048,
  })
  const content = response.content?.trim()
  if (!content) {
    throw new AiServiceError('AI 返回空内容', null, 'chat', 'chat/completions')
  }
  return content
}
