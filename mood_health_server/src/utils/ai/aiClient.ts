/**
 * AI模型统一调用客户端
 * 封装第三方AI接口的调用逻辑，处理鉴权、重试、错误封装
 */

import axios, { AxiosError, AxiosInstance, AxiosRequestConfig } from 'axios';
import logger from '../logger';
import { AiServiceError } from '../errors';
import aiConfig from '../../config/aiConfig';

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
  options: { model?: string; temperature?: number; maxTokens?: number } = {}
): Promise<string> => {
  if (!aiConfig.enabled) {
    throw new AiServiceError('AI 服务未启用', null, 'chat', 'chat/completions')
  }

  const apiKey = aiConfig.deepseekApiKey || aiConfig.apiKey
  if (!apiKey) {
    throw new AiServiceError('AI API Key 未配置', null, 'chat', 'chat/completions')
  }

  const baseUrl = aiConfig.deepseekApiKey ? aiConfig.deepseekBaseUrl : 'https://api.openai.com'
  const url = `${baseUrl}/v1/chat/completions`

  const body = {
    model: options.model || aiConfig.models.moodAnalysis,
    messages,
    temperature: options.temperature ?? 0.7,
    max_tokens: options.maxTokens ?? 2048,
  }

  try {
    const response = await axios.post<{
      choices: Array<{ message: { content: string } }>
    }>(url, body, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      timeout: aiConfig.timeout,
    })

    const content = response.data?.choices?.[0]?.message?.content
    if (!content) {
      throw new AiServiceError('AI 返回空内容', null, 'chat', 'chat/completions')
    }
    return content.trim()
  } catch (error: any) {
    if (error instanceof AiServiceError) throw error

    const status = error?.response?.status
    if (status === 401) {
      throw new AiServiceError('AI API Key 无效', error, 'chat', 'chat/completions')
    }
    if (status === 429) {
      throw new AiServiceError('AI API 请求频率超限', error, 'chat', 'chat/completions')
    }
    throw new AiServiceError(
      `AI 调用失败: ${error?.message || '未知错误'}`,
      error,
      'chat',
      'chat/completions'
    )
  }
}

export default aiClient;
