/**
 * AI 服务客户端 — HMAC 签名认证 + HTTP 重试 + 错误处理。
 * Node 端通过此客户端调用 AI 情绪分析微服务。
 */

import { randomBytes, createHash, createHmac } from 'crypto';
import type { MoodAnalysisRequest, MoodAnalysisResponse } from '../contracts/moodAnalysis';
import logger from '../utils/logger';

const DEFAULT_AI_SERVICE_URL = 'http://127.0.0.1:8001';
const DEFAULT_TIMEOUT_MS = 30000;
const MAX_TIMEOUT_MS = 60000;
const DEFAULT_MAX_RETRIES = 3;
const RESPONSE_SIZE_LIMIT_BYTES = 1024 * 1024;
const RETRY_DELAY_MS = 500;

// ---- HMAC 签名 ----

export function computeAuthSignature(
  body: string,
  timestamp: string,
  nonce: string,
  token: string
): string {
  const bodyHash = createHash('sha256').update(body).digest('hex');
  const message = `v1\n${timestamp}\n${nonce}\n${bodyHash}`;

  return createHmac('sha256', token).update(message).digest('hex');
}

export function generateAuthHeaders(body: string, token: string): Record<string, string> {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonce = randomBytes(16).toString('hex');
  const signature = computeAuthSignature(body, timestamp, nonce, token);

  return {
    'X-Signature': signature,
    'X-Timestamp': timestamp,
    'X-Nonce': nonce,
  };
}

// ---- HTTP 客户端 ----

type SafeFailureStatus = number | 'config' | 'invalid_json' | 'network' | 'response_too_large' | 'timeout';

export class FastApiClientError extends Error {
  constructor(
    readonly status: SafeFailureStatus,
    readonly path: string,
    readonly retryable: boolean,
    readonly requestId?: string
  ) {
    super(`FastAPI request failed: status=${status}, path=${path}`);
    this.name = 'FastApiClientError';
  }
}

function configurationError(path: string): FastApiClientError {
  return new FastApiClientError('config', path, false);
}

function resolveRequestUrl(path: string): string {
  try {
    const configured = new URL(process.env.AI_SERVICE_BASE_URL || DEFAULT_AI_SERVICE_URL);
    if (
      (configured.protocol !== 'http:' && configured.protocol !== 'https:') ||
      configured.username !== '' ||
      configured.password !== ''
    ) {
      throw configurationError(path);
    }

    const requestUrl = new URL(path, `${configured.origin}/`);
    if (requestUrl.origin !== configured.origin || requestUrl.pathname !== path) {
      throw configurationError(path);
    }
    return requestUrl.toString();
  } catch (error) {
    if (error instanceof FastApiClientError) {
      throw error;
    }
    throw configurationError(path);
  }
}

function resolveTimeout(path: string): number {
  if (process.env.AI_TIMEOUT === undefined) {
    return DEFAULT_TIMEOUT_MS;
  }
  const configured = Number(process.env.AI_TIMEOUT);
  if (!Number.isFinite(configured) || configured <= 0) {
    throw configurationError(path);
  }
  return Math.min(configured, MAX_TIMEOUT_MS);
}

function resolveMaxRetries(path: string): number {
  if (process.env.AI_MAX_RETRIES === undefined) {
    return DEFAULT_MAX_RETRIES;
  }
  const configured = Number(process.env.AI_MAX_RETRIES);
  if (!Number.isInteger(configured) || configured < 0 || configured > 3) {
    throw configurationError(path);
  }
  return configured;
}

function isRetryableStatus(status: number): boolean {
  return status === 408 || status === 429 || status >= 500;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function readBoundedJson<T>(
  response: Response,
  path: string,
  controller: AbortController
): Promise<T> {
  const declaredLength = response.headers.get('content-length');
  if (declaredLength !== null) {
    const parsedLength = Number(declaredLength);
    if (Number.isFinite(parsedLength) && parsedLength > RESPONSE_SIZE_LIMIT_BYTES) {
      controller.abort();
      await response.body?.cancel().catch(() => undefined);
      throw new FastApiClientError('response_too_large', path, false);
    }
  }

  const reader = response.body?.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  if (reader) {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      totalBytes += value.byteLength;
      if (totalBytes > RESPONSE_SIZE_LIMIT_BYTES) {
        controller.abort();
        await reader.cancel().catch(() => undefined);
        throw new FastApiClientError('response_too_large', path, false);
      }
      chunks.push(value);
    }
  }

  const body = Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)), totalBytes).toString('utf8');
  try {
    return JSON.parse(body) as T;
  } catch {
    throw new FastApiClientError('invalid_json', path, false);
  }
}

interface JsonRequestOptions {
  method?: 'GET' | 'POST';
  body?: string;
  authenticated?: boolean;
  acceptNon2xx?: boolean;
}

async function requestJsonAttempt<T>(
  path: string,
  options: JsonRequestOptions,
  timeoutMs: number
): Promise<T> {
  const controller = new AbortController();
  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (options.authenticated) {
    Object.assign(headers, getAuthHeaders(options.body || ''));
  }

  try {
    const response = await fetch(resolveRequestUrl(path), {
      method: options.method || 'GET',
      headers,
      body: options.body,
      redirect: 'error',
      signal: controller.signal,
    });

    if (!response.ok && !options.acceptNon2xx) {
      let requestId: string | undefined;
      try {
        const errBody = await readBoundedJson<{ requestId?: string; request_id?: string }>(
          response,
          path,
          controller,
        );
        const parsed = errBody?.requestId ?? errBody?.request_id;
        if (typeof parsed === 'string') requestId = parsed;
      } catch (readErr) {
        if (readErr instanceof FastApiClientError) throw readErr;
      }
      throw new FastApiClientError(
        response.status,
        path,
        isRetryableStatus(response.status),
        requestId,
      );
    }
    return await readBoundedJson<T>(response, path, controller);
  } catch (error) {
    if (error instanceof FastApiClientError) {
      throw error;
    }
    throw new FastApiClientError(timedOut ? 'timeout' : 'network', path, true);
  } finally {
    clearTimeout(timeout);
  }
}

async function requestJson<T>(path: string, options: JsonRequestOptions = {}): Promise<T> {
  const maxRetries = options.acceptNon2xx ? 0 : resolveMaxRetries(path);
  const timeoutMs = resolveTimeout(path);
  let lastError: FastApiClientError | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await requestJsonAttempt<T>(path, options, timeoutMs);
    } catch (error) {
      const safeError = error instanceof FastApiClientError
        ? error
        : new FastApiClientError('network', path, true);
      lastError = safeError;
      if (!safeError.retryable || attempt === maxRetries) {
        logger.error('FastAPI request failed: status=%s, path=%s', safeError.status, path);
        throw safeError;
      }

      const backoff = RETRY_DELAY_MS * Math.pow(2, attempt);
      logger.warn(
        'FastAPI request retry: attempt=%d, maxRetries=%d, path=%s, delayMs=%d',
        attempt + 1,
        maxRetries,
        path,
        backoff
      );
      await delay(backoff);
    }
  }

  throw lastError || new FastApiClientError('network', path, false);
}

// ---- API 调用 ----

function getAuthHeaders(body: string): Record<string, string> {
  const token = process.env.AI_SERVICE_INTERNAL_TOKEN || '';
  return generateAuthHeaders(body, token);
}

export interface RagHistoryMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface RagAnswerRequest {
  query: string
  requestId: string
  history?: RagHistoryMessage[]
}

export interface RagSource {
  title: string
  reference: string
}

export interface RagAnswerResponse {
  answer: string
  sources: RagSource[]
  requestId: string
  provider: string
  model: string
  usage?: Record<string, number> | null
  fallbackUsed: false
}

export interface AssistantSource {
  sourceType: 'local' | 'web'
  title: string
  reference: string
  url?: string
}

export interface AssistantResponseRequest {
  query: string
  requestId: string
  history?: RagHistoryMessage[]
  riskDetected: boolean
  allowWebSearch: boolean
}

export type WebSearchStatus = 'not_requested' | 'not_needed' | 'used' | 'failed'

export interface AssistantResponse {
  answer: string
  sources: AssistantSource[]
  groundingUsed: boolean
  requestId: string
  provider: string
  model: string
  usage?: Record<string, number> | null
  fallbackUsed: false
  webSearchStatus: WebSearchStatus
}

export interface ChatCompletionMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface ChatCompletionRequest {
  messages: ChatCompletionMessage[]
  model: string
  temperature: number
  maxTokens: number
}

export interface ChatCompletionResponse {
  content: string
  model: string
  usage?: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
}

export async function callAssistantResponse(
  requestBody: AssistantResponseRequest
): Promise<AssistantResponse> {
  const body = JSON.stringify(requestBody)
  return requestJson<AssistantResponse>('/api/assistant/respond', {
    method: 'POST',
    body,
    authenticated: true,
  })
}

export async function callChatCompletionRequest(
  requestBody: ChatCompletionRequest
): Promise<ChatCompletionResponse> {
  const body = JSON.stringify(requestBody)
  return requestJson<ChatCompletionResponse>('/api/ai/chat', {
    method: 'POST',
    body,
    authenticated: true,
  })
}

export async function callRagAnswer(requestBody: RagAnswerRequest): Promise<RagAnswerResponse> {
  const body = JSON.stringify(requestBody)
  return requestJson<RagAnswerResponse>('/api/rag/answer', {
    method: 'POST',
    body,
    authenticated: true,
  })
}

/**
 * 调用 FastAPI 情绪分析
 */
export async function callMoodAnalysis(
  requestBody: MoodAnalysisRequest
): Promise<MoodAnalysisResponse> {
  const body = JSON.stringify(requestBody);
  return requestJson<MoodAnalysisResponse>('/api/analyze/mood', {
    method: 'POST',
    body,
    authenticated: true,
  });
}

/**
 * 健康检查
 */
export async function checkHealth(): Promise<Record<string, unknown>> {
  return requestJson<Record<string, unknown>>('/api/health');
}

/**
 * 就绪检查
 */
export async function checkReadiness(): Promise<Record<string, unknown>> {
  return requestJson<Record<string, unknown>>('/api/health/ready', {
    acceptNon2xx: true,
  });
}
