import { HTTP_STATUS } from '../utils/httpStatus'
import { Request, Response } from 'express'
import { AuthRequest } from '../middleware/auth'
import { createPostRepository } from '../repositories/postRepository'
import { createAuditService } from '../services/auditService'
import logger from '../utils/logger'
import { filterContent, shouldAutoReject, shouldMarkForReview } from '../utils/contentFilter'
import contentAuditService from '../utils/ai/contentAuditService'
import { apiFailure, API_ERROR_CODES } from '../utils/apiResponse'
import { generateAndSaveAiReply } from './treeholeController'
import { formatCrisisSupport } from '../constants/crisisSupport'
import { recordTreeholeRiskSignal } from '../repositories/automaticRiskCaseRepository'

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
      return res.status(HTTP_STATUS.BAD_REQUEST).json({ code: 400, message: '内容不能为空' })
    }

    if (!title || title.trim() === '') {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({ code: 400, message: '标题不能为空' })
    }

    if (title.length > 200) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({ code: 400, message: '标题不能超过200字' })
    }

    // 基础敏感词过滤
    const filterResult = filterContent(content)
    if (shouldAutoReject(content)) {
      try {
        await recordTreeholeRiskSignal(userId)
      } catch (signalError) {
        logger.error('树洞高风险信号记录失败', {
          userId,
          error: signalError instanceof Error ? signalError.message : String(signalError),
        })
      }
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        code: 400,
        message: '内容包含敏感词，无法发布',
        detectedWords: filterResult.detectedWords,
        riskLevel: 'high',
        helpResources: [
          `请联系身边可信任的人或学校支持，也可联系${formatCrisisSupport()}。`,
          '如有立即危险，请拨打当地紧急服务 110/120；AI 和心理援助热线不能替代紧急救援。',
        ],
      })
    }

    // AI深度审核分级
    let riskLevel: string = 'low'
    try {
      const auditResult = await contentAuditService.auditContent({ content, type: 'post' })
      if (!auditResult.isSafe) {
        if (auditResult.severity === 'high') {
          try {
            await recordTreeholeRiskSignal(userId)
          } catch (signalError) {
            logger.error('树洞 AI 高风险信号记录失败', {
              userId,
              error: signalError instanceof Error ? signalError.message : String(signalError),
            })
          }
          return res.status(HTTP_STATUS.BAD_REQUEST).json({
            code: 400,
            message: 'AI 检测到高风险内容，无法发布',
            detectedIssues: auditResult.detectedIssues,
            riskLevel: 'high',
            helpResources: [
              `请联系身边可信任的人或学校支持，也可联系${formatCrisisSupport()}。`,
              '如有立即危险，请拨打当地紧急服务 110/120；AI 和心理援助热线不能替代紧急救援。',
            ],
          })
        }
        riskLevel = auditResult.severity === 'medium' ? 'medium' : 'low'
      }
    } catch (auditError) {
      // AI 审核失败时安全降级：标记为需人工审核，而非直接放行
      logger.warn('AI 内容审核失败，安全降级为待人工审核', {
        error: (auditError as Error).message,
        contentLength: content.length,
        userId,
      })
      riskLevel = 'medium'
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

    res.status(HTTP_STATUS.CREATED).json({
      code: 0,
      data: post,
      message: needsReview ? '内容已提交，等待审核' : '发布成功',
    })

    // 异步生成 AI 回复（不阻塞响应）
    if (!needsReview) {
      setTimeout(() => {
        generateAndSaveAiReply(post.id, content).catch((err) => {
          logger.error('异步 AI 回复生成失败', { postId: post.id, error: err?.message })
        })
      }, 100)
    }
  } catch (error) {
    logger.error('创建帖子失败', { error: (error as Error).message })
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ code: 500, message: '服务器内部错误' })
  }
}

/**
 * 获取帖子列表
 */
export const getPostsHandler = async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1)
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize as string) || 10))

    const posts = await postRepo.findPosts(page, pageSize)
    res.status(HTTP_STATUS.OK).json({ code: 0, data: posts })
  } catch (error) {
    logger.error('获取帖子列表失败', { error, query: req.query })
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ code: 500, message: '获取帖子列表失败，请稍后重试' })
  }
}

/**
 * 获取帖子详情
 */
export const getPostByIdHandler = async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string)

    if (isNaN(id)) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({ code: 400, message: '无效的帖子ID' })
    }

    const post = await postRepo.findPostById(id)
    if (!post) {
      return res.status(HTTP_STATUS.NOT_FOUND).json(apiFailure(API_ERROR_CODES.NOT_FOUND, '帖子不存在'))
    }

    const comments = await postRepo.findCommentsByPostId(id)
    const aiReply = await postRepo.getAiReply(id)
    res.status(HTTP_STATUS.OK).json({ code: 0, data: { ...post, comments, aiReply } })
  } catch (error) {
    logger.error('获取帖子详情失败', { error: (error as Error).message })
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ code: 500, message: '服务器内部错误' })
  }
}

export const getCommentsHandler = async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id as string)

    if (isNaN(id)) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({ code: 400, message: '无效的帖子ID' })
    }

    const comments = await postRepo.findCommentsByPostId(id)
    res.status(HTTP_STATUS.OK).json({ code: 0, data: comments })
  } catch (error) {
    logger.error('获取评论列表失败', { error, postId: req.params.id })
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ code: 500, message: '获取评论失败，请稍后重试' })
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
      return res.status(HTTP_STATUS.BAD_REQUEST).json({ code: 400, message: '无效的帖子ID' })
    }

    const post = await postRepo.likePost(id, userId)
    if (!post) {
      return res.status(HTTP_STATUS.NOT_FOUND).json(apiFailure(API_ERROR_CODES.NOT_FOUND, '帖子不存在'))
    }

    res.status(HTTP_STATUS.OK).json({ code: 0, data: post })
  } catch (error) {
    logger.error('点赞失败', { error: (error as Error).message })
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ code: 500, message: '服务器内部错误' })
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
      return res.status(HTTP_STATUS.BAD_REQUEST).json({ code: 400, message: '无效的帖子ID' })
    }

    if (!content || content.trim() === '') {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({ code: 400, message: '评论内容不能为空' })
    }

    if (content.length > 5000) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({ code: 400, message: '评论内容不能超过5000字' })
    }

    const post = await postRepo.findPostById(postId)
    if (!post) {
      return res.status(HTTP_STATUS.NOT_FOUND).json(apiFailure(API_ERROR_CODES.NOT_FOUND, '帖子不存在'))
    }

    const comment = await postRepo.createComment({
      postId,
      userId,
      content,
      isAnonymous: isAnonymous || false,
    })
    res.status(HTTP_STATUS.CREATED).json({ code: 0, data: comment })
  } catch (error) {
    logger.error('发表评论失败', { error: (error as Error).message })
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ code: 500, message: '服务器内部错误' })
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
      return res.status(HTTP_STATUS.BAD_REQUEST).json({ code: 400, message: '无效的评论ID' })
    }

    const comment = await postRepo.likeComment(id, userId)
    if (!comment) {
      return res.status(HTTP_STATUS.NOT_FOUND).json(apiFailure(API_ERROR_CODES.NOT_FOUND, '评论不存在'))
    }

    res.status(HTTP_STATUS.OK).json({ code: 0, data: comment })
  } catch (error) {
    logger.error('点赞评论失败', { error: (error as Error).message })
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ code: 500, message: '服务器内部错误' })
  }
}

/**
 * 获取待审核帖子列表（管理员）
 */
export const getPendingPostsHandler = async (req: AuthRequest, res: Response) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1)
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize as string) || 10))
    const status = parseInt(req.query.status as string)

    const posts = await postRepo.findPendingPosts(page, pageSize, Number.isNaN(status) ? 0 : status)
    res.status(HTTP_STATUS.OK).json({ code: 0, data: posts })
  } catch (error) {
    logger.error('获取待审核帖子列表失败', { error: (error as Error).message })
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ code: 500, message: '服务器内部错误' })
  }
}

/**
 * 获取帖子审核统计（管理员）
 */
export const getPostAuditStatsHandler = async (req: AuthRequest, res: Response) => {
  try {
    const stats = await postRepo.getAuditStats()
    res.status(HTTP_STATUS.OK).json({ code: 0, data: stats })
  } catch (error) {
    logger.error('获取帖子审核统计失败', { error: (error as Error).message })
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ code: 500, message: '服务器内部错误' })
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
      return res.status(HTTP_STATUS.BAD_REQUEST).json({ code: 400, message: '无效的帖子ID' })
    }

    if (!status || ![0, 1, 2].includes(status)) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({ code: 400, message: '无效的审核状态' })
    }

    const existingPost = await postRepo.findPostById(id)
    if (!existingPost) {
      return res.status(HTTP_STATUS.NOT_FOUND).json(apiFailure(API_ERROR_CODES.NOT_FOUND, '帖子不存在'))
    }

    const post = await postRepo.auditPost(id, { status, auditRemark: audit_remark })
    if (!post) {
      return res.status(HTTP_STATUS.NOT_FOUND).json(apiFailure(API_ERROR_CODES.NOT_FOUND, '帖子不存在'))
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

    res.status(HTTP_STATUS.OK).json({ code: 0, data: post })
  } catch (error) {
    logger.error('审核帖子失败', { error: (error as Error).message })
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ code: 500, message: '服务器内部错误' })
  }
}

/**
 * 删除帖子（仅作者可删除）
 */
export const deletePostHandler = async (req: AuthRequest, res: Response) => {
  try {
    const postId = parseInt(String(req.params.postId))
    const userId = req.user!.userId

    if (isNaN(postId)) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json(apiFailure(400, '帖子ID无效'))
    }

    const post = await postRepo.findPostById(postId)
    if (!post) {
      return res.status(HTTP_STATUS.NOT_FOUND).json(apiFailure(API_ERROR_CODES.NOT_FOUND, '帖子不存在'))
    }
    if (post.userId !== userId) {
      return res.status(HTTP_STATUS.FORBIDDEN).json(apiFailure(403, '无权删除此帖子'))
    }

    await postRepo.deleteById(postId)
    res.status(HTTP_STATUS.OK).json({ code: 0, data: null, message: '帖子已删除' })
  } catch (error) {
    logger.error('删除帖子失败', { error: (error as Error).message })
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(apiFailure(1500, '服务器内部错误'))
  }
}
