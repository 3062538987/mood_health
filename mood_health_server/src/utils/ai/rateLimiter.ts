/**
 * AI 入口限流（R7 修复，防御性纵深）。
 *
 * 在 Node 侧对触发 AI 能力的接口（咨询对话 / 情绪分析 / AI 知识助手）做
 * 按客户端 IP 的固定窗口限流，避免单个客户端对 AI 微服务发起突发或滥用请求。
 * AI 服务侧已有独立限流（analyze/chat/assistant/rag），此处为后端侧的额外保护。
 *
 * 使用 express-rate-limit 默认 keyGenerator（按客户端 IP，已正确处理 IPv6 与代理），
 * 如需按用户维度限流，后续可结合 req.user 自定义 keyGenerator 并配套 ipKeyGenerator。
 */

import rateLimit from 'express-rate-limit'

const AI_RATE_LIMIT_WINDOW_MS = Number(process.env.AI_RATE_LIMIT_WINDOW_MS || 60 * 1000)
const AI_RATE_LIMIT_MAX = Number(process.env.AI_RATE_LIMIT_MAX || 30)

export function createAiRateLimiter() {
  return rateLimit({
    windowMs: Number.isFinite(AI_RATE_LIMIT_WINDOW_MS) && AI_RATE_LIMIT_WINDOW_MS > 0
      ? AI_RATE_LIMIT_WINDOW_MS
      : 60 * 1000,
    max: Number.isInteger(AI_RATE_LIMIT_MAX) && AI_RATE_LIMIT_MAX > 0 ? AI_RATE_LIMIT_MAX : 30,
    standardHeaders: true,
    legacyHeaders: false,
    message: 'AI 请求过于频繁，请稍后再试',
  })
}
