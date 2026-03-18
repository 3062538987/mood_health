/**
 * AI 路由（转发模式）
 * Node 层不再执行 AI 推理，仅将请求转发给 Python FastAPI AI 服务。
 */

import express, { Request, Response } from 'express'
import axios from 'axios'

const router = express.Router()

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
