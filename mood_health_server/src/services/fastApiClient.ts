/**
 * FastAPI 客户端 — 生成 HMAC 认证请求头。
 * 完整实现见 A4-17。
 */

import { randomBytes, createHmac } from 'crypto';

/**
 * 生成认证请求头
 */
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