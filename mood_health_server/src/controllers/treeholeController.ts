/**
 * 树洞温柔回复控制器
 * 通过 callChatCompletion 调用 DeepSeek API 生成回复
 */

import { Response } from 'express'
import { AuthRequest } from '../middleware/auth'
import { apiSuccess, apiFailure } from '../utils/apiResponse'
import { callChatCompletion } from '../utils/ai/aiClient'
import { filterContent } from '../utils/contentFilter'
import { createPostRepository } from '../repositories/postRepository'
import logger from '../utils/logger'

const postRepo = createPostRepository()

const TREEHOLE_SYSTEM_PROMPT = `你是一个温暖、善解人意的树洞倾听者。用户会在这里倾诉心事，请用温柔的语气回复。

回复规则：
1. 语气温柔、共情、理解，像朋友一样倾听
2. 回复长度控制在2-3句
3. 不要给出诊断或医疗建议
4. 如果用户表达痛苦，给予温暖的支持
5. 如果用户提到自伤、自杀等危险内容，请表达关心并建议寻求专业帮助
6. 保持积极、温暖的语气`

/**
 * 核心函数：生成 AI 温柔回复（不依赖 Express req/res）
 * 供 postController 异步调用使用
 */
export const generateGentleReplyCore = async (content: string): Promise<string> => {
  const messages: Array<{ role: 'system' | 'user'; content: string }> = [
    { role: 'system', content: TREEHOLE_SYSTEM_PROMPT },
    { role: 'user', content: `用户倾诉：${content}\n\n请用温暖、共情的语气回复。` },
  ]

  const reply = await callChatCompletion(messages, {
    temperature: 0.9,
    maxTokens: 300,
  })

  return reply
}

/**
 * 异步生成并保存 AI 回复（供 postController 在发帖后调用）
 */
export const generateAndSaveAiReply = async (postId: number, content: string): Promise<void> => {
  try {
    const reply = await generateGentleReplyCore(content)
    await postRepo.saveAiReply(postId, reply)
    logger.info('AI 回复已生成并保存', { postId })
  } catch (error: any) {
    logger.error('AI 回复生成失败', { postId, error: error?.message })
  }
}

/**
 * POST /api/ai/treehole/gentle-reply
 * 手动请求 AI 温柔回复（不保存）
 */
export const generateGentleReply = async (req: AuthRequest, res: Response) => {
  try {
    const { content } = req.body

    if (!content || !content.trim()) {
      return res.status(400).json(apiFailure(400, '内容不能为空'))
    }

    if (content.length > 1000) {
      return res.status(400).json(apiFailure(400, '内容长度不能超过1000字'))
    }

    // 内容安全检测
    const filterResult = filterContent(content)
    if (!filterResult.isSafe && filterResult.severity === 'high') {
      return res.status(400).json(apiFailure(400, '内容包含不当信息，请修改后重试'))
    }

    const reply = await generateGentleReplyCore(content)

    res.json(apiSuccess({
      reply,
      is_fallback: false,
    }, '回复成功'))
  } catch (error: any) {
    logger.error('树洞回复生成失败', { error: error?.message })
    res.status(500).json(apiFailure(500, error?.message || 'AI 服务暂时不可用'))
  }
}

/**
 * GET /api/posts/:id/ai-reply
 * 获取帖子的 AI 回复
 */
export const getAiReplyHandler = async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id as string)

    if (isNaN(id)) {
      return res.status(400).json(apiFailure(400, '无效的帖子ID'))
    }

    const reply = await postRepo.getAiReply(id)
    if (!reply) {
      return res.json(apiSuccess(null, '暂无 AI 回复'))
    }

    res.json(apiSuccess(reply, '获取 AI 回复成功'))
  } catch (error: any) {
    logger.error('获取 AI 回复失败', { error: error?.message })
    res.status(500).json(apiFailure(500, '服务器内部错误'))
  }
}

/**
 * POST /api/posts/:id/generate-ai-reply
 * 手动生成帖子的 AI 回复
 */
export const generateAiReplyHandler = async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id as string)

    if (isNaN(id)) {
      return res.status(400).json(apiFailure(400, '无效的帖子ID'))
    }

    // 检查是否已有 AI 回复
    const existing = await postRepo.getAiReply(id)
    if (existing) {
      return res.json(apiSuccess(existing, '已有 AI 回复'))
    }

    const post = await postRepo.findPostById(id)
    if (!post) {
      return res.status(404).json(apiFailure(404, '帖子不存在'))
    }

    const reply = await generateGentleReplyCore(post.content)
    const saved = await postRepo.saveAiReply(id, reply)

    res.json(apiSuccess(saved, 'AI 回复生成成功'))
  } catch (error: any) {
    logger.error('生成 AI 回复失败', { error: error?.message })
    res.status(500).json(apiFailure(500, error?.message || 'AI 服务暂时不可用'))
  }
}