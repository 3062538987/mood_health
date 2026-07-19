/**
 * AI模型统一调用客户端
 * 封装第三方AI接口的调用逻辑，处理鉴权、重试、错误封装
 */

import axios, { AxiosError, AxiosInstance, AxiosRequestConfig } from 'axios';
import logger from '../logger';
import { AiServiceError } from '../errors';
import aiConfig from '../../config/aiConfig';
import { generateAuthHeaders } from '../../services/fastApiClient';
import { getUserProfile, profileToPromptText } from '../../services/userProfileService';

/**
 * AI客户端类
 */
export class AIClient {
  private axiosInstance: AxiosInstance;

  constructor() {
    this.axiosInstance = axios.create({
      baseURL: aiConfig.apiBaseUrl,
      timeout: aiConfig.timeout,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': aiConfig.apiKey ? `Bearer ${aiConfig.apiKey}` : ''
      }
    });

    // 请求拦截器
    this.axiosInstance.interceptors.request.use(
      (config) => {
        logger.debug(`AI API Request: ${config.method?.toUpperCase()} ${config.url}`);
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // 响应拦截器
    this.axiosInstance.interceptors.response.use(
      (response) => {
        logger.debug(`AI API Response: ${response.status} ${response.config?.url}`);
        return response;
      },
      (error: AxiosError) => {
        logger.error(`AI API Error: ${error.message} ${error.config?.url}`);
        return Promise.reject(error);
      }
    );
  }

  /**
   * 调用AI接口
   * @param api 接口路径
   * @param params 请求参数
   * @param options 额外选项
   * @returns 响应结果
   */
  async callAI<T>(api: string, params: any, options: { model?: string; timeout?: number } = {}): Promise<T> {
    const startTime = Date.now();
    let retryCount = 0;

    const doCall = async (): Promise<T> => {
      try {
        const response = await this.axiosInstance.post<T>(api, params, {
          timeout: options.timeout || aiConfig.timeout,
          headers: {
            'X-AI-Model': options.model || aiConfig.models.moodAnalysis
          }
        });

        const endTime = Date.now();
        logger.info(`AI API Call Success: ${api} - ${endTime - startTime}ms`);
        return response.data;
      } catch (error) {
        const endTime = Date.now();
        logger.error(`AI API Call Failed: ${api} - ${endTime - startTime}ms - ${error instanceof Error ? error.message : 'Unknown error'}`);

        if (retryCount < aiConfig.maxRetries) {
          retryCount++;
          const delay = Math.pow(2, retryCount) * 1000;
          logger.info(`Retrying AI API call (${retryCount}/${aiConfig.maxRetries}) after ${delay}ms`);
          await new Promise(resolve => setTimeout(resolve, delay));
          return doCall();
        }

        throw new AiServiceError(
          `AI API调用失败: ${api}`,
          error,
          aiConfig.modelType,
          api
        );
      }
    };

    return doCall();
  }

  /**
   * 调用本地AI模型
   * @param api 接口路径
   * @param params 请求参数
   * @returns 响应结果
   * @deprecated 本地模型不可用，请使用 callChatCompletion 调用 DeepSeek API
   */
  async callLocalAI<T>(api: string, params: any): Promise<T> {
    throw new AiServiceError(
      `本地AI模型不可用 (${api})，请使用 callChatCompletion 调用 DeepSeek API`,
      null,
      'local',
      api
    );
  }

  /**
   * 调用OpenAI API
   * @param endpoint API端点
   * @param params 请求参数
   * @returns 响应结果
   */
  async callOpenAI<T>(endpoint: string, params: any): Promise<T> {
    const openaiConfig = {
      baseURL: 'https://api.openai.com/v1',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${aiConfig.apiKey}`
      }
    };

    try {
      const response = await axios.post<T>(`${openaiConfig.baseURL}${endpoint}`, params, {
        headers: openaiConfig.headers,
        timeout: aiConfig.timeout
      });
      return response.data;
    } catch (error) {
      throw new AiServiceError(
        `OpenAI API调用失败: ${endpoint}`,
        error,
        'openai',
        endpoint
      );
    }
  }

  /**
   * 根据模型类型调用AI
   * @param api 接口路径
   * @param params 请求参数
   * @param options 额外选项
   * @returns 响应结果
   * @deprecated 请使用 callChatCompletion 直接调用 DeepSeek API
   */
  async callByModelType<T>(api: string, params: any, options: { model?: string; timeout?: number } = {}): Promise<T> {
    switch (aiConfig.modelType) {
      case 'openai':
        return this.callOpenAI<T>(api, params);
      case 'local':
        return this.callLocalAI<T>(api, params);
      case 'deepseek':
        throw new AiServiceError(
          `请使用 callChatCompletion 直接调用 DeepSeek API，而非通过 callByModelType(${api})`,
          null,
          'deepseek',
          api
        );
      default:
        throw new AiServiceError(
          `不支持的模型类型: ${aiConfig.modelType} (${api})`,
          null,
          aiConfig.modelType,
          api
        );
    }
  }
}

// 导出单例实例
const aiClient = new AIClient();

/**
 * 调用 DeepSeek / OpenAI 兼容的 Chat Completion API
 * @param messages 消息数组
 * @param options 选项（model, temperature, maxTokens）
 * @returns 纯文本响应内容
 */
export const callChatCompletion = async (
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
  options: { model?: string; temperature?: number; maxTokens?: number; userId?: number; injectProfile?: boolean } = {}
): Promise<string> => {
  if (!aiConfig.enabled) {
    throw new AiServiceError('AI 服务未启用', null, 'chat', 'chat/completions')
  }

  // 画像注入：当 injectProfile 为 true 且提供了 userId 时，将用户画像注入到 system prompt
  let finalMessages = [...messages]
  if (options.injectProfile && options.userId) {
    try {
      const profile = await getUserProfile(options.userId)
      if (profile) {
        const profileText = profileToPromptText(profile)
        if (profileText) {
          const systemIdx = finalMessages.findIndex(m => m.role === 'system')
          if (systemIdx >= 0) {
            finalMessages[systemIdx] = {
              ...finalMessages[systemIdx],
              content: finalMessages[systemIdx].content + '\n\n' + profileText
            }
          } else {
            finalMessages.unshift({ role: 'system', content: profileText })
          }
        }
      }
    } catch (err) {
      logger.warn('画像注入失败，继续正常调用', { error: err })
    }
  }

  const baseUrl = process.env.AI_SERVICE_BASE_URL || 'http://127.0.0.1:8001'
  const url = `${baseUrl}/api/ai/chat`
  const token = process.env.AI_SERVICE_INTERNAL_TOKEN || ''

  const body = {
    messages: finalMessages,
    model: options.model || aiConfig.models.moodAnalysis,
    temperature: options.temperature ?? 0.7,
    maxTokens: options.maxTokens ?? 2048,
  }

  const bodyStr = JSON.stringify(body)
  const authHeaders = generateAuthHeaders(bodyStr, token)

  let retryCount = 0
  const maxRetries = aiConfig.maxRetries || 3

  const doRequest = async (): Promise<string> => {
    try {
      const response = await axios.post<{
        content: string
        model: string
        usage?: { promptTokens: number; completionTokens: number; totalTokens: number }
      }>(url, body, {
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders,
        },
        timeout: aiConfig.timeout,
      })

      const content = response.data?.content
      if (!content) {
        throw new AiServiceError('AI 返回空内容', null, 'chat', 'chat/completions')
      }
      return content.trim()
    } catch (error: any) {
      if (error instanceof AiServiceError && error.message === 'AI 返回空内容') throw error

      const status = error?.response?.status
      if (status === 401) {
        throw new AiServiceError('AI 服务认证失败', error, 'chat', '/api/ai/chat')
      }
      if (status === 400 || status === 422) {
        throw new AiServiceError('AI 请求参数错误', error, 'chat', '/api/ai/chat')
      }

      if (retryCount < maxRetries) {
        retryCount++
        const delay = Math.pow(2, retryCount) * 1000
        logger.info(`AI 调用重试 (${retryCount}/${maxRetries})，等待 ${delay}ms`)
        await new Promise(resolve => setTimeout(resolve, delay))
        return doRequest()
      }

      if (status === 429) {
        throw new AiServiceError('AI API 请求频率超限', error, 'chat', '/api/ai/chat')
      }
      if (status === 502) {
        throw new AiServiceError(
          `AI 调用失败: ${error?.response?.data?.detail || '未知错误'}`,
          error,
          'chat',
          '/api/ai/chat'
        )
      }
      throw new AiServiceError(
        `AI 调用失败: ${error?.message || '未知错误'}`,
        error,
        'chat',
        '/api/ai/chat'
      )
    }
  }

  return doRequest()
}

export default aiClient;
