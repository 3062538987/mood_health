import { Request, Response } from 'express'
import { AuthRequest } from '../middleware/auth'
import { createPostRepository } from '../repositories/postRepository'
import logger from '../utils/logger'
import { filterContent, shouldAutoReject, shouldMarkForReview } from '../utils/contentFilter'

const postRepo = createPostRepository()

/**
 * 创建帖子
 */
export const createPostHandler = async (req: AuthRequest, res: Response) => {
  try {
    const { title, content, isAnonymous } = req.body
    const userId = req.user!.userId

    if (!content || content.trim() === '') {
      return res.status(400).json({ code: 400, message: '内容不能为空' })
    }

    if (!title || title.trim() === '') {
      return res.status(400).json({ code: 400, message: '标题不能为空' })
    }

    const filterResult = filterContent(content)
    if (shouldAutoReject(content)) {
      return res.status(400).json({
        code: 400,
        message: '内容包含敏感词，无法发布',
        detectedWords: filterResult.detectedWords,
      })
    }

    const post = await postRepo.createPost({
      title,
      content,
      userId,
      isAnonymous: isAnonymous || false,
    })
    res.status(201).json({
      code: 0,
      data: post,
      message: shouldMarkForReview(content) ? '内容已提交，等待审核' : '发布成功',
    })
  } catch (error) {
    logger.error('创建帖子失败', { error: error instanceof Error ? error.message : 'unknown_error' })
    res.status(500).json({ code: 500, message: '服务器内部错误' })
  }
}

/**
 * 获取帖子列表
 */
export const getPostsHandler = async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1
    const pageSize = parseInt(req.query.pageSize as string) || 10

    const posts = await postRepo.findPosts(page, pageSize)
    res.status(200).json({ code: 0, data: posts })
  } catch (error) {
    logger.error('获取帖子列表失败', { error, query: req.query })
    res.status(500).json({ code: 500, message: '获取帖子列表失败，请稍后重试' })
  }
}

/**
 * 获取帖子详情
 */
export const getPostByIdHandler = async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string)

    if (isNaN(id)) {
      return res.status(400).json({ code: 400, message: '无效的帖子ID' })
    }

    const post = await postRepo.findPostById(id)
    if (!post) {
      return res.status(404).json({ code: 404, message: '帖子不存在' })
    }

    const comments = await postRepo.findCommentsByPostId(id)
    res.status(200).json({ code: 0, data: { ...post, comments } })
  } catch (error) {
    logger.error('获取帖子详情失败', { error: error instanceof Error ? error.message : 'unknown_error' })
    res.status(500).json({ code: 500, message: '服务器内部错误' })
  }
}

export const getCommentsHandler = async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string)

    if (isNaN(id)) {
      return res.status(400).json({ code: 400, message: '无效的帖子ID' })
    }

    const comments = await postRepo.findCommentsByPostId(id)
    res.status(200).json({ code: 0, data: comments })
  } catch (error) {
    logger.error('获取评论列表失败', { error, postId: req.params.id })
    res.status(500).json({ code: 500, message: '获取评论失败，请稍后重试' })
  }
}

/**
 * 点赞帖子
 */
export const likePostHandler = async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id as string)
    const userId = req.user!.userId

    if (isNaN(id)) {
      return res.status(400).json({ code: 400, message: '无效的帖子ID' })
    }

    const post = await postRepo.likePost(id, userId)
    if (!post) {
      return res.status(404).json({ code: 404, message: '帖子不存在' })
    }

    res.status(200).json({ code: 0, data: post })
  } catch (error) {
    logger.error('点赞失败', { error: error instanceof Error ? error.message : 'unknown_error' })
    res.status(500).json({ code: 500, message: '服务器内部错误' })
  }
}

/**
 * 发表评论
 */
export const createCommentHandler = async (req: AuthRequest, res: Response) => {
  try {
    const postId = parseInt(req.params.id as string)
    const { content, isAnonymous } = req.body
    const userId = req.user!.userId

    if (isNaN(postId)) {
      return res.status(400).json({ code: 400, message: '无效的帖子ID' })
    }

    if (!content || content.trim() === '') {
      return res.status(400).json({ code: 400, message: '评论内容不能为空' })
    }

    const post = await postRepo.findPostById(postId)
    if (!post) {
      return res.status(404).json({ code: 404, message: '帖子不存在' })
    }

    const comment = await postRepo.createComment({
      postId,
      userId,
      content,
      isAnonymous: isAnonymous || false,
    })
    res.status(201).json({ code: 0, data: comment })
  } catch (error) {
    logger.error('发表评论失败', { error: error instanceof Error ? error.message : 'unknown_error' })
    res.status(500).json({ code: 500, message: '服务器内部错误' })
  }
}

/**
 * 点赞评论
 */
export const likeCommentHandler = async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.commentId as string)
    const userId = req.user!.userId

    if (isNaN(id)) {
      return res.status(400).json({ code: 400, message: '无效的评论ID' })
    }

    const comment = await postRepo.likeComment(id, userId)
    if (!comment) {
      return res.status(404).json({ code: 404, message: '评论不存在' })
    }

    res.status(200).json({ code: 0, data: comment })
  } catch (error) {
    logger.error('点赞评论失败', { error: error instanceof Error ? error.message : 'unknown_error' })
    res.status(500).json({ code: 500, message: '服务器内部错误' })
  }
}

/**
 * 获取待审核帖子列表（管理员）
 */
export const getPendingPostsHandler = async (req: AuthRequest, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1
    const pageSize = parseInt(req.query.pageSize as string) || 10
    const status = parseInt(req.query.status as string)

    const posts = await postRepo.findPendingPosts(page, pageSize, Number.isNaN(status) ? 0 : status)
    res.status(200).json({ code: 0, data: posts })
  } catch (error) {
    logger.error('获取待审核帖子列表失败', { error: error instanceof Error ? error.message : 'unknown_error' })
    res.status(500).json({ code: 500, message: '服务器内部错误' })
  }
}

/**
 * 获取帖子审核统计（管理员）
 */
export const getPostAuditStatsHandler = async (req: AuthRequest, res: Response) => {
  try {
    const stats = await postRepo.getAuditStats()
    res.status(200).json({ code: 0, data: stats })
  } catch (error) {
    logger.error('获取帖子审核统计失败', { error: error instanceof Error ? error.message : 'unknown_error' })
    res.status(500).json({ code: 500, message: '服务器内部错误' })
  }
}

/**
 * 审核帖子（管理员）
 */
export const auditPostHandler = async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id as string)
    const { status, audit_remark } = req.body

    if (isNaN(id)) {
      return res.status(400).json({ code: 400, message: '无效的帖子ID' })
    }

    if (!status || ![0, 1, 2].includes(status)) {
      return res.status(400).json({ code: 400, message: '无效的审核状态' })
    }

    const post = await postRepo.auditPost(id, { status, auditRemark: audit_remark })
    if (!post) {
      return res.status(404).json({ code: 404, message: '帖子不存在' })
    }

    res.status(200).json({ code: 0, data: post })
  } catch (error) {
    logger.error('审核帖子失败', { error: error instanceof Error ? error.message : 'unknown_error' })
    res.status(500).json({ code: 500, message: '服务器内部错误' })
  }
}