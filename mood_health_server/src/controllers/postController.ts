import { Request, Response } from 'express'
import { AuthRequest } from '../middleware/auth'
import { createPostRepository } from '../repositories/postRepository'
import { createAuditService } from '../services/auditService'
import logger from '../utils/logger'
import { filterContent, shouldAutoReject, shouldMarkForReview } from '../utils/contentFilter'
import contentAuditService from '../utils/ai/contentAuditService'
import { apiFailure, API_ERROR_CODES } from '../utils/apiResponse'

const postRepo = createPostRepository()
const auditService = createAuditService()

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

    // 基础敏感词过滤
    const filterResult = filterContent(content)
    if (shouldAutoReject(content)) {
      return res.status(400).json({
        code: 400,
        message: '内容包含敏感词，无法发布',
        detectedWords: filterResult.detectedWords,
        riskLevel: 'high',
        helpResources: [
          '如果您正在经历困难，请拨打心理援助热线：400-161-9995',
          '全国24小时心理危机干预热线：010-82951332',
        ],
      })
    }

    // AI深度审核分级
    let riskLevel: string = 'low'
    try {
      const auditResult = await contentAuditService.auditContent({ content, type: 'post' })
      if (!auditResult.isSafe) {
        if (auditResult.severity === 'high') {
          return res.status(400).json({
            code: 400,
            message: 'AI 检测到高风险内容，无法发布',
            detectedIssues: auditResult.detectedIssues,
            riskLevel: 'high',
            helpResources: [
              '如果您正在经历困难，请拨打心理援助热线：400-161-9995',
              '全国24小时心理危机干预热线：010-82951332',
            ],
          })
        }
        riskLevel = auditResult.severity === 'medium' ? 'medium' : 'low'
      }
    } catch {
      // AI 审核失败时降级为基础过滤
      riskLevel = 'low'
    }

    const needsReview = riskLevel === 'medium' || shouldMarkForReview(content)

    const post = await postRepo.createPost({
      title,
      content,
      userId,
      isAnonymous: isAnonymous || false,
      riskLevel: riskLevel as 'low' | 'medium' | 'high',
      needsReview: needsReview ? 1 : 0,
    })

    res.status(201).json({
      code: 0,
      data: post,
      message: needsReview ? '内容已提交，等待审核' : '发布成功',
    })
  } catch (error) {
    console.error('创建帖子失败:', error)
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
      return res.status(404).json(apiFailure(API_ERROR_CODES.NOT_FOUND, '帖子不存在'))
    }

    const comments = await postRepo.findCommentsByPostId(id)
    res.status(200).json({ code: 0, data: { ...post, comments } })
  } catch (error) {
    console.error('获取帖子详情失败:', error)
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
      return res.status(404).json(apiFailure(API_ERROR_CODES.NOT_FOUND, '帖子不存在'))
    }

    res.status(200).json({ code: 0, data: post })
  } catch (error) {
    console.error('点赞失败:', error)
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
      return res.status(404).json(apiFailure(API_ERROR_CODES.NOT_FOUND, '帖子不存在'))
    }

    const comment = await postRepo.createComment({
      postId,
      userId,
      content,
      isAnonymous: isAnonymous || false,
    })
    res.status(201).json({ code: 0, data: comment })
  } catch (error) {
    console.error('发表评论失败:', error)
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
      return res.status(404).json(apiFailure(API_ERROR_CODES.NOT_FOUND, '评论不存在'))
    }

    res.status(200).json({ code: 0, data: comment })
  } catch (error) {
    console.error('点赞评论失败:', error)
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
    console.error('获取待审核帖子列表失败:', error)
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
    console.error('获取帖子审核统计失败:', error)
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
    const operatorId = req.user!.userId

    if (isNaN(id)) {
      return res.status(400).json({ code: 400, message: '无效的帖子ID' })
    }

    if (!status || ![0, 1, 2].includes(status)) {
      return res.status(400).json({ code: 400, message: '无效的审核状态' })
    }

    const existingPost = await postRepo.findPostById(id)
    if (!existingPost) {
      return res.status(404).json(apiFailure(API_ERROR_CODES.NOT_FOUND, '帖子不存在'))
    }

    const post = await postRepo.auditPost(id, { status, auditRemark: audit_remark })
    if (!post) {
      return res.status(404).json(apiFailure(API_ERROR_CODES.NOT_FOUND, '帖子不存在'))
    }

    // 记录审核操作日志
    const action = status === 1 ? 'post.approve' : 'post.reject'
    try {
      await auditService.record({
        actorUserId: operatorId,
        actorRoleCode: 'admin',
        permissionCode: 'admin.access',
        action,
        targetType: 'post',
        targetId: String(id),
        result: 'success',
        summary: audit_remark || `审核: ${status === 1 ? '通过' : '拒绝'}`,
        ipAddress: null,
        requestId: null,
      })
    } catch {
      // 日志写入失败不影响审核操作
    }

    res.status(200).json({ code: 0, data: post })
  } catch (error) {
    console.error('审核帖子失败:', error)
    res.status(500).json({ code: 500, message: '服务器内部错误' })
  }
}

/**
 * 获取帖子审核日志（管理员）
 */
export const getPostAuditLogsHandler = async (req: AuthRequest, res: Response) => {
  try {
    const postId = parseInt(req.params.id as string)

    if (isNaN(postId)) {
      return res.status(400).json({ code: 400, message: '无效的帖子ID' })
    }

    // 查询审核日志，按 action 过滤 post 相关操作
    const logs = await auditService.list({
      page: 1,
      pageSize: 50,
    })

    // 过滤出该帖子的审核日志
    const auditList = logs as any
    const postLogs = Array.isArray(auditList.data)
      ? auditList.data.filter((item: any) => {
          return item.targetId === String(postId) || item.operationType?.startsWith('post.')
        })
      : []

    res.status(200).json({ code: 0, data: postLogs })
  } catch (error) {
    console.error('获取审核日志失败:', error)
    res.status(500).json({ code: 500, message: '服务器内部错误' })
  }
}

/**
 * 删除帖子（仅作者可删除）
 */
export const deletePostHandler = async (req: AuthRequest, res: Response) => {
  try {
    const postId = parseInt(req.params.postId)
    const userId = req.user!.userId

    if (isNaN(postId)) {
      return res.status(400).json(apiFailure(400, '帖子ID无效'))
    }

    const post = await postRepo.findPostById(postId)
    if (!post) {
      return res.status(404).json(apiFailure(API_ERROR_CODES.NOT_FOUND, '帖子不存在'))
    }
    if (post.userId !== userId) {
      return res.status(403).json(apiFailure(403, '无权删除此帖子'))
    }

    await postRepo.deleteById(postId)
    res.status(200).json({ code: 0, data: null, message: '帖子已删除' })
  } catch (error) {
    console.error('删除帖子失败:', error)
    res.status(500).json(apiFailure(1500, '服务器内部错误'))
  }
}