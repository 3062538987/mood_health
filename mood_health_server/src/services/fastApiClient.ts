/**
 * FastAPI 客户端 — HMAC 签名认证 + HTTP 重试 + 错误处理。
 * Node 端通过此客户端调用 FastAPI 情绪分析微服务。
 */

import { randomBytes, createHmac } from 'crypto';
import axios, { AxiosInstance, AxiosError } from 'axios';
import logger from '../utils/logger';

const FASTAPI_URL = process.env.FASTAPI_BASE_URL || 'http://127.0.0.1:8001';
const DEFAULT_TIMEOUT = 30000;
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 500;

// ---- HMAC 签名 ----

export function generateAuthHeaders(body: string, token: string): Record<string, string> {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonce = randomBytes(16).toString('hex');

  const message = `${body}${timestamp}${token}`;
  const signature = createHmac('sha256', token)
    .update(message)
    .digest('hex');

  return {
    'X-Signature': signature,
    'X-Timestamp': timestamp,
    'X-Nonce': nonce,
  };
}

// ---- HTTP 客户端 ----

let _client: AxiosInstance | null = null;

function getClient(): AxiosInstance {
  if (!_client) {
    _client = axios.create({
      baseURL: FASTAPI_URL,
      timeout: DEFAULT_TIMEOUT,
      headers: { 'Content-Type': 'application/json' },
    });

    _client.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        if (error.response) {
          logger.error(
            'FastAPI 响应错误: status=%d, path=%s',
            error.response.status,
            error.config?.url
          );
        } else if (error.request) {
          logger.error('FastAPI 无响应: %s', error.message);
        }
        return Promise.reject(error);
      }
    );
  }
  return _client;
}

// ---- 重试逻辑 ----

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = MAX_RETRIES
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt < maxRetries) {
        const backoff = RETRY_DELAY_MS * Math.pow(2, attempt - 1);
        logger.warn(
          'FastAPI 调用重试 (%d/%d): %s, 等待 %dms',
          attempt,
          maxRetries,
          lastError.message,
          backoff
        );
        await delay(backoff);
      }
    }
  }

  throw lastError || new Error('FastAPI 调用失败');
}

// ---- API 调用 ----

function getAuthHeaders(body: string): Record<string, string> {
  const token = process.env.AI_SERVICE_INTERNAL_TOKEN || '';
  return generateAuthHeaders(body, token);
}

/**
 * 调用 FastAPI 情绪分析
 */
export async function callMoodAnalysis(
  requestBody: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const body = JSON.stringify(requestBody);
  const authHeaders = getAuthHeaders(body);

  return withRetry(async () => {
    const response = await getClient().post('/api/analyze/mood', requestBody, {
      headers: authHeaders,
    });
    return response.data;
  });
}

/**
 * 健康检查
 */
export async function checkHealth(): Promise<Record<string, unknown>> {
  const response = await getClient().get('/api/health');
  return response.data;
}

/**
 * 就绪检查
 */
export async function checkReadiness(): Promise<Record<string, unknown>> {
  const response = await getClient().get('/api/health/ready', {
    validateStatus: (status) => status < 600,
  });
  return response.data;
}