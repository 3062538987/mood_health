/**
 * AI 路由（转发模式）
 * Node 层不再执行 AI 推理，仅将请求转发给 Python FastAPI AI 服务。
 */

import express, { Request, Response } from 'express'
import axios from 'axios'
import rateLimit from 'express-rate-limit'
import { authenticate } from '../middleware/auth'

const router = express.Router()

const localReplyPool = [
  '你的感受很重要，先让自己慢下来，照顾好当下的你。',
  '愿意表达已经很勇敢了，请对自己保持一点温柔。',
  '不必一次解决所有问题，先完成眼前最小的一步。',
  '情绪有波动是正常的，你并不需要为此责备自己。',
  '无论今天经历了什么，明天仍然有重新开始的机会。',
]

const getLocalGentleReply = () => {
  const index = Math.floor(Math.random() * localReplyPool.length)
  return localReplyPool[index]
}

const isAiEnabled = () => {
  const raw = String(process.env.AI_ENABLED || 'false')
    .toLowerCase()
    .trim()
  return raw === '1' || raw === 'true' || raw === 'yes' || raw === 'on'
}

const aiProxyLimiter = rateLimit({
  windowMs: Number(process.env.AI_PROXY_RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000),
  max: Number(process.env.AI_PROXY_RATE_LIMIT_MAX || 30),
  message: 'AI 请求过于频繁，请稍后再试',
})

router.use(aiProxyLimiter)
router.use(authenticate)

router.post('/treehole/gentle-reply', (req: Request, res: Response) => {
  // 树洞场景固定走本地温柔文案，避免依赖外部 AI 服务可用性
  return res.status(200).json({
    code: 0,
    data: {
      reply: getLocalGentleReply(),
      is_fallback: true,
    },
  })
})

const getAiServiceBaseUrl = () => {
  const rawBaseUrl =
    process.env.AI_SERVICE_BASE_URL || process.env.AI_API_BASE_URL || 'http://127.0.0.1:8000'
  return rawBaseUrl.replace(/\/+$/, '')
}

const buildTargetUrl = (path: string) => `${getAiServiceBaseUrl()}/api${path}`

const filterForwardHeaders = (headers: Request['headers']) => {
  const result: Record<string, string> = {}

  Object.entries(headers).forEach(([key, value]) => {
    if (!value) {
      return
    }

    const lowerKey = key.toLowerCase()
    if (['host', 'content-length', 'connection'].includes(lowerKey)) {
      return
    }

    result[key] = Array.isArray(value) ? value.join(', ') : String(value)
  })

  return result
}

router.use(async (req: Request, res: Response) => {
  if (!isAiEnabled()) {
    res.status(200).json({
      code: 0,
      data: {
        message: 'AI 功能已关闭',
      },
      aiEnabled: false,
      timestamp: new Date().toISOString(),
    })
    return
  }

  const targetUrl = buildTargetUrl(req.path)

  try {
    const response = await axios.request({
      method: req.method,
      url: targetUrl,
      params: req.query,
      data: req.body,
      headers: filterForwardHeaders(req.headers),
      timeout: Number(process.env.AI_PROXY_TIMEOUT_MS || 45000),
      validateStatus: () => true,
    })

    res.status(response.status).json(response.data)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'AI 转发失败'
    res.status(502).json({
      code: 502,
      message: 'AI 服务暂时不可用',
      detail: message,
      target: targetUrl,
      timestamp: new Date().toISOString(),
    })
  }
})

export default router
