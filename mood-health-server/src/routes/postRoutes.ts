import express from 'express'
import { body } from 'express-validator'
import {
  createPostHandler,
  getPostsHandler,
  getPostByIdHandler,
  getCommentsHandler,
  likePostHandler,
  createCommentHandler,
  likeCommentHandler,
  getPendingPostsHandler,
  auditPostHandler,
} from '../controllers/postController'
import { authenticate, requirePermission, requireRole } from '../middleware/auth'
import { validateRequest } from '../middleware/validateRequest'
import { auditOperation } from '../utils/operationLogger'

const router = express.Router()

// 管理员路由（必须放在前面，避免被 /:id 路由拦截）
// 获取待审核帖子列表（需要管理员权限）
router.get(
  '/admin/pending',
  authenticate,
  requireRole(['admin']),
  requirePermission('post.audit.pending.read'),
  auditOperation({
    permissionCode: 'post.audit.pending.read',
    operationType: 'POST_AUDIT_PENDING_READ',
  }),
  getPendingPostsHandler
)

// 审核帖子（需要管理员权限）
router.post(
  '/admin/audit/:id',
  authenticate,
  requireRole(['admin']),
  requirePermission('post.audit'),
  auditOperation({
    permissionCode: 'post.audit',
    operationType: 'POST_AUDIT',
    getTargetId: (req) => (typeof req.params.id === 'string' ? req.params.id : null),
  }),
  [
    body('status').isIn([0, 1, 2]).withMessage('审核状态必须是 0、1 或 2'),
    body('audit_remark').optional().isString().withMessage('审核备注必须是字符串'),
  ],
  validateRequest,
  auditPostHandler
)

// 发布帖子（需要认证）
router.post(
  '/',
  authenticate,
  [
    body('title').notEmpty().withMessage('帖子标题不能为空'),
    body('content').notEmpty().withMessage('帖子内容不能为空'),
    body('isAnonymous').optional().isBoolean().withMessage('是否匿名必须是布尔值'),
  ],
  validateRequest,
  createPostHandler
)

// 分页获取帖子列表（公开）
router.get('/', getPostsHandler)

// 获取帖子详情（含评论）（公开）
router.get('/:id', getPostByIdHandler)

// 获取评论列表（公开）
router.get('/:id/comments', getCommentsHandler)

// 点赞帖子（需要认证）
router.post('/:id/like', authenticate, likePostHandler)

// 发表评论（需要认证）
router.post(
  '/:id/comments',
  authenticate,
  [
    body('content').notEmpty().withMessage('评论内容不能为空'),
    body('isAnonymous').optional().isBoolean().withMessage('是否匿名必须是布尔值'),
  ],
  validateRequest,
  createCommentHandler
)

// 点赞评论（需要认证）
router.post('/comments/:commentId/like', authenticate, likeCommentHandler)

export default router
