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
  private retryCount: number = 0;

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
    this.retryCount = 0;

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

      // 重试机制
      if (this.retryCount < aiConfig.maxRetries) {
        this.retryCount++;
        const delay = Math.pow(2, this.retryCount) * 1000; // 指数退避
        logger.info(`Retrying AI API call (${this.retryCount}/${aiConfig.maxRetries}) after ${delay}ms`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.callAI(api, params, options);
      }

      // 抛出AI服务错误
      throw new AiServiceError(
        `AI API调用失败: ${api}`,
        error,
        aiConfig.modelType,
        api
      );
    }
  }

  /**
   * 调用本地AI模型
   * @param api 接口路径
   * @param params 请求参数
   * @returns 响应结果
   */
  async callLocalAI<T>(api: string, params: any): Promise<T> {
    // 本地模型调用逻辑
    // 这里可以根据实际情况实现本地模型的调用
    // 例如调用本地部署的LLM服务
    logger.info(`Calling local AI model: ${api}`);
    
    // 模拟本地模型响应
    // 实际项目中应该替换为真实的本地模型调用
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({} as T);
      }, 1000);
    });
  }

  /**
   * 调用OpenAI API
   * @param endpoint API端点
   * @param params 请求参数
   * @returns 响应结果
   */
  async callOpenAI<T>(endpoint: string, params: any): Promise<T> {
    // OpenAI API调用逻辑
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
   */
  async callByModelType<T>(api: string, params: any, options: { model?: string; timeout?: number } = {}): Promise<T> {
    switch (aiConfig.modelType) {
      case 'openai':
        return this.callOpenAI<T>(api, params);
      case 'local':
        return this.callLocalAI<T>(api, params);
      case 'deepseek':
        // DeepSeek API调用逻辑
        return this.callAI<T>(api, params, options);
      default:
        return this.callAI<T>(api, params, options);
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
