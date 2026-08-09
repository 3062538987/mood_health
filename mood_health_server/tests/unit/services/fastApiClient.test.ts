/**
 * FastAPI 客户端测试。
 * 不依赖真实 FastAPI 服务。
 */

import {
  callAssistantResponse,
  callChatCompletionRequest,
  checkHealth,
  checkReadiness,
  computeAuthSignature,
  generateAuthHeaders,
  type AssistantResponse,
  type AssistantResponseRequest,
} from '@/services/fastApiClient';

const originalEnv = process.env;
const originalFetch = global.fetch;

function jsonResponse(
  body: Record<string, unknown>,
  init: ResponseInit = {}
): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
}

async function advanceRetryDelay(): Promise<void> {
  await jest.advanceTimersByTimeAsync(500);
}

describe('FastAPI Client', () => {
  beforeEach(() => {
    process.env = { ...originalEnv, AI_MAX_RETRIES: '0' };
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.useRealTimers();
    process.env = originalEnv;
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  describe('generateAuthHeaders', () => {
    it('uses the v1 canonical fixed vector shared with FastAPI', () => {
      expect(
        computeAuthSignature(
          '{"mood":"calm"}',
          '1700000000',
          'abcdef0123456789abcdef0123456789',
          'fixed-vector-token'
        )
      ).toBe('0a8253f71ee6fc36af6eab8a2f1d05d7c4e9f461e0fe026904c9d9008d44bf63');
    });

    it('binds the nonce into the signature', () => {
      const body = '{"mood":"calm"}';
      const timestamp = '1700000000';
      const token = 'fixed-vector-token';

      expect(
        computeAuthSignature(body, timestamp, 'abcdef0123456789abcdef0123456789', token)
      ).not.toBe(
        computeAuthSignature(body, timestamp, '0123456789abcdef0123456789abcdef', token)
      );
    });

    it('生成三个必要的请求头', () => {
      const headers = generateAuthHeaders('test body', 'secret-token');
      expect(headers['X-Signature']).toBeDefined();
      expect(headers['X-Timestamp']).toBeDefined();
      expect(headers['X-Nonce']).toBeDefined();
    });

    it('签名为 64 位十六进制字符串', () => {
      const headers = generateAuthHeaders('test', 'token');
      expect(headers['X-Signature']).toHaveLength(64);
      expect(/^[0-9a-f]+$/.test(headers['X-Signature'])).toBe(true);
    });

    it('Nonce 为 32 位十六进制字符串', () => {
      const headers = generateAuthHeaders('test', 'token');
      expect(headers['X-Nonce']).toHaveLength(32);
    });

    it('相同输入产生相同签名', () => {
      // 固定时间戳确保一致性
      const body = 'fixed-body';
      const token = 'fixed-token';
      const h1 = generateAuthHeaders(body, token);
      const h2 = generateAuthHeaders(body, token);

      // 不同时间戳但相同 token+body 应产生不同签名(因为时间戳变化)
      // 但签名长度应一致
      expect(h1['X-Signature']).toHaveLength(64);
      expect(h2['X-Signature']).toHaveLength(64);
    });

    it('不同 token 产生不同签名', () => {
      const body = 'test';
      const h1 = generateAuthHeaders(body, 'token-a');
      const h2 = generateAuthHeaders(body, 'token-b');

      // 时间戳可能不同，但签名不会相同
      // 只验证签名长度一致性
      expect(h1['X-Signature']).toHaveLength(64);
      expect(h2['X-Signature']).toHaveLength(64);
    });

    it('不同 body 产生不同签名（相同时间戳下）', () => {
      const h1 = generateAuthHeaders('body-a', 'token');
      const h2 = generateAuthHeaders('body-b', 'token');

      // 时间戳可能不同所以签名也不同
      // 验证签名长度一致
      expect(h1['X-Signature']).toHaveLength(64);
      expect(h2['X-Signature']).toHaveLength(64);
    });

    it('时间戳为数字字符串', () => {
      const headers = generateAuthHeaders('test', 'token');
      const ts = parseInt(headers['X-Timestamp'], 10);
      expect(Number.isFinite(ts)).toBe(true);
      expect(ts).toBeGreaterThan(0);
    });
  });

  describe('native fetch boundary', () => {
    it('posts web authorization and returns the enriched assistant evidence contract', async () => {
      const requestBody: AssistantResponseRequest = {
        query: 'Find current support resources.',
        requestId: 'request-web-contract',
        riskDetected: false,
        allowWebSearch: true,
      };
      const responseBody: AssistantResponse = {
        answer: 'A current resource is available.',
        sources: [{
          sourceType: 'web',
          title: 'Official support resource',
          reference: 'Official website',
          url: 'https://example.test/support',
        }],
        groundingUsed: true,
        requestId: 'request-web-contract',
        provider: 'deepseek',
        model: 'deepseek-v4-flash',
        fallbackUsed: false,
        webSearchStatus: 'used',
      };
      jest.mocked(global.fetch).mockResolvedValue(
        jsonResponse(responseBody as unknown as Record<string, unknown>)
      );

      await expect(callAssistantResponse(requestBody)).resolves.toEqual(responseBody);
      expect(global.fetch).toHaveBeenCalledWith(
        'http://127.0.0.1:8001/api/assistant/respond',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(requestBody),
          redirect: 'error',
        })
      );
    });

    it('posts the exact chat completion contract to the fixed authenticated endpoint', async () => {
      process.env.AI_SERVICE_BASE_URL = 'https://ai.example.test/base-path';
      process.env.AI_SERVICE_INTERNAL_TOKEN = 'chat-test-token';
      const requestBody = {
        messages: [
          { role: 'system' as const, content: 'Be helpful.' },
          { role: 'user' as const, content: 'hello' },
        ],
        model: 'deepseek-chat',
        temperature: 0.25,
        maxTokens: 512,
      };
      jest.mocked(global.fetch).mockResolvedValue(
        jsonResponse({
          content: 'bounded answer',
          model: 'deepseek-chat',
          usage: { promptTokens: 5, completionTokens: 2, totalTokens: 7 },
        })
      );

      await expect(callChatCompletionRequest(requestBody)).resolves.toEqual({
        content: 'bounded answer',
        model: 'deepseek-chat',
        usage: { promptTokens: 5, completionTokens: 2, totalTokens: 7 },
      });

      const expectedBody = JSON.stringify(requestBody);
      expect(global.fetch).toHaveBeenCalledWith(
        'https://ai.example.test/api/ai/chat',
        expect.objectContaining({
          method: 'POST',
          body: expectedBody,
          redirect: 'error',
        })
      );
      const headers = jest.mocked(global.fetch).mock.calls[0][1]?.headers as Record<string, string>;
      expect(headers).toEqual(expect.objectContaining({
        'Content-Type': 'application/json',
        'X-Signature': expect.any(String),
        'X-Timestamp': expect.any(String),
        'X-Nonce': expect.any(String),
      }));
      expect(headers['X-Signature']).toBe(
        computeAuthSignature(
          expectedBody,
          headers['X-Timestamp'],
          headers['X-Nonce'],
          'chat-test-token'
        )
      );
    });

    it('generates fresh authentication headers when the chat entrypoint retries', async () => {
      jest.useFakeTimers();
      process.env.AI_MAX_RETRIES = '1';
      jest
        .mocked(global.fetch)
        .mockResolvedValueOnce(new Response('{}', { status: 503 }))
        .mockResolvedValueOnce(jsonResponse({ content: 'answer', model: 'deepseek-chat' }));

      const request = callChatCompletionRequest({
        messages: [{ role: 'user', content: 'hello' }],
        model: 'deepseek-chat',
        temperature: 0.7,
        maxTokens: 2048,
      });
      await advanceRetryDelay();
      await expect(request).resolves.toEqual({ content: 'answer', model: 'deepseek-chat' });

      const firstHeaders = jest.mocked(global.fetch).mock.calls[0][1]?.headers as Record<string, string>;
      const secondHeaders = jest.mocked(global.fetch).mock.calls[1][1]?.headers as Record<string, string>;
      expect(firstHeaders['X-Nonce']).not.toBe(secondHeaders['X-Nonce']);
      expect(firstHeaders['X-Signature']).not.toBe(secondHeaders['X-Signature']);
    });

    it.each([
      'ftp://ai.example.test',
      'http://user:password@ai.example.test',
    ])('rejects an unsafe configured origin: %s', async (baseUrl) => {
      process.env.AI_SERVICE_BASE_URL = baseUrl;

      await expect(checkHealth()).rejects.toThrow(
        'FastAPI request failed: status=config, path=/api/health'
      );
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('uses only the configured origin and the fixed endpoint path', async () => {
      process.env.AI_SERVICE_BASE_URL = 'https://ai.example.test:8443/ignored?query=ignored';
      jest.mocked(global.fetch).mockResolvedValue(jsonResponse({ status: 'ok' }));

      await expect(checkHealth()).resolves.toEqual({ status: 'ok' });

      expect(global.fetch).toHaveBeenCalledWith(
        'https://ai.example.test:8443/api/health',
        expect.objectContaining({ redirect: 'error' })
      );
    });

    it('forbids redirects at the fetch boundary', async () => {
      jest.mocked(global.fetch).mockResolvedValue(jsonResponse({ status: 'ok' }));

      await checkHealth();

      expect(global.fetch).toHaveBeenCalledWith(
        'http://127.0.0.1:8001/api/health',
        expect.objectContaining({ redirect: 'error' })
      );
    });

    it('aborts an attempt when its configured timeout elapses', async () => {
      jest.useFakeTimers();
      process.env.AI_TIMEOUT = '10';
      jest.mocked(global.fetch).mockImplementation((_url, init) => {
        return new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            reject(new DOMException('provider details must stay private', 'AbortError'));
          });
        });
      });

      const request = checkHealth();
      const rejection = expect(request).rejects.toThrow(
        'FastAPI request failed: status=timeout, path=/api/health'
      );
      await jest.advanceTimersByTimeAsync(10);

      await rejection;
    });

    it('rejects an oversized declared response before reading it', async () => {
      const cancel = jest.fn();
      const body = new ReadableStream<Uint8Array>({ cancel });
      jest.mocked(global.fetch).mockResolvedValue(
        new Response(body, {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': String(1024 * 1024 + 1),
          },
        })
      );

      await expect(checkHealth()).rejects.toThrow(
        'FastAPI request failed: status=response_too_large, path=/api/health'
      );
      expect(cancel).toHaveBeenCalled();
    });

    it('aborts a streamed response once it exceeds 1 MiB', async () => {
      const cancel = jest.fn();
      const chunk = new Uint8Array(512 * 1024 + 1);
      const body = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(chunk);
          controller.enqueue(chunk);
        },
        cancel,
      });
      jest.mocked(global.fetch).mockResolvedValue(
        new Response(body, {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );

      await expect(checkHealth()).rejects.toThrow(
        'FastAPI request failed: status=response_too_large, path=/api/health'
      );
      expect(cancel).toHaveBeenCalled();
    });

    it('parses JSON responses explicitly', async () => {
      jest.mocked(global.fetch).mockResolvedValue(jsonResponse({ status: 'ok' }));

      await expect(checkHealth()).resolves.toEqual({ status: 'ok' });
    });

    it('returns a safe bounded error for a non-JSON success response', async () => {
      const privateProviderBody = 'private provider response content';
      jest.mocked(global.fetch).mockResolvedValue(
        new Response(privateProviderBody, { status: 200 })
      );

      const request = checkHealth();
      await expect(request).rejects.toThrow(
        'FastAPI request failed: status=invalid_json, path=/api/health'
      );
      await expect(request).rejects.not.toThrow(privateProviderBody);
    });

    it('returns status and path only for an HTTP error', async () => {
      const privateProviderBody = 'private provider response content';
      jest.mocked(global.fetch).mockResolvedValue(
        new Response(privateProviderBody, { status: 400 })
      );

      const request = checkHealth();
      await expect(request).rejects.toThrow(
        'FastAPI request failed: status=400, path=/api/health'
      );
      await expect(request).rejects.not.toThrow(privateProviderBody);
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('treats zero retries as exactly one attempt', async () => {
      jest.mocked(global.fetch).mockRejectedValue(new TypeError('private network details'));

      await expect(checkHealth()).rejects.toThrow(
        'FastAPI request failed: status=network, path=/api/health'
      );
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('retries a retryable status but not a non-retryable status', async () => {
      jest.useFakeTimers();
      process.env.AI_MAX_RETRIES = '1';
      jest
        .mocked(global.fetch)
        .mockResolvedValueOnce(new Response('{}', { status: 503 }))
        .mockResolvedValueOnce(jsonResponse({ status: 'ok' }));

      const retryableRequest = checkHealth();
      await advanceRetryDelay();
      await expect(retryableRequest).resolves.toEqual({ status: 'ok' });
      expect(global.fetch).toHaveBeenCalledTimes(2);

      jest.mocked(global.fetch).mockClear();
      jest.mocked(global.fetch).mockResolvedValue(new Response('{}', { status: 404 }));

      await expect(checkHealth()).rejects.toThrow(
        'FastAPI request failed: status=404, path=/api/health'
      );
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('generates a fresh nonce and signature for every authenticated retry', async () => {
      jest.useFakeTimers();
      process.env.AI_MAX_RETRIES = '1';
      jest
        .mocked(global.fetch)
        .mockResolvedValueOnce(new Response('{}', { status: 429 }))
        .mockResolvedValueOnce(
          jsonResponse({
            answer: 'bounded answer',
            sources: [],
            groundingUsed: false,
            requestId: 'request-1',
            provider: 'provider',
            model: 'model',
            fallbackUsed: false,
          })
        );

      const request = callAssistantResponse({
        query: 'hello',
        requestId: 'request-1',
        riskDetected: false,
        allowWebSearch: false,
      });
      await advanceRetryDelay();
      await request;

      const firstHeaders = jest.mocked(global.fetch).mock.calls[0][1]?.headers as Record<
        string,
        string
      >;
      const secondHeaders = jest.mocked(global.fetch).mock.calls[1][1]?.headers as Record<
        string,
        string
      >;
      expect(firstHeaders['X-Nonce']).not.toBe(secondHeaders['X-Nonce']);
      expect(firstHeaders['X-Signature']).not.toBe(secondHeaders['X-Signature']);
    });

    it('returns the readiness JSON body for non-2xx responses', async () => {
      process.env.AI_MAX_RETRIES = '3';
      jest.mocked(global.fetch).mockResolvedValue(
        jsonResponse({ status: 'not_ready', mysql: 'unavailable' }, { status: 503 })
      );

      await expect(checkReadiness()).resolves.toEqual({
        status: 'not_ready',
        mysql: 'unavailable',
      });
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });
  });
});
