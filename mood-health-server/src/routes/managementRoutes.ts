import { NextFunction, Request, Response, Router } from 'express'
import { body } from 'express-validator'
import {
  adminMoodsListHandler,
  adminUsersListHandler,
  adminUsersDeleteHandler,
  adminUsersUpdateRoleHandler,
  feedbackHandleHandler,
  incidentFixHandler,
  roleManageHandler,
  systemConfigHandler,
  userManageHandler,
} from '../controllers/managementController'
import {
  createCourse,
  deleteCourse,
  getCourses,
  updateCourse,
} from '../controllers/courseController'
import { authenticate, requirePermission } from '../middleware/auth'
import { validateRequest } from '../middleware/validateRequest'

const router = Router()

const normalizeCreateCoursePayload = (req: Request, _res: Response, next: NextFunction) => {
  const source = (req.body || {}) as Record<string, unknown>
  const videoUrl = typeof source.videoUrl === 'string' ? source.videoUrl.trim() : ''
  const fallbackContent = typeof source.content === 'string' ? source.content : ''

  req.body = {
    title: source.title,
    description: source.description,
    content: videoUrl || fallbackContent,
    coverUrl:
      typeof source.coverImage === 'string'
        ? source.coverImage
        : typeof source.coverUrl === 'string'
          ? source.coverUrl
          : '',
    category: source.category,
    type:
      source.type === 'video' || source.type === 'article'
        ? source.type
        : videoUrl
          ? 'video'
          : 'article',
  }

  next()
}

const normalizeUpdateCoursePayload = (req: Request, _res: Response, next: NextFunction) => {
  const source = (req.body || {}) as Record<string, unknown>
  const nextBody: Record<string, unknown> = {}

  if (source.title !== undefined) nextBody.title = source.title
  if (source.description !== undefined) nextBody.description = source.description
  if (source.category !== undefined) nextBody.category = source.category

  if (source.coverImage !== undefined || source.coverUrl !== undefined) {
    nextBody.coverUrl = source.coverImage ?? source.coverUrl
  }

  if (source.videoUrl !== undefined || source.content !== undefined) {
    nextBody.content = source.videoUrl ?? source.content
  }

  if (source.type === 'video' || source.type === 'article') {
    nextBody.type = source.type
  } else if (source.videoUrl !== undefined) {
    nextBody.type = 'video'
  }

  req.body = nextBody
  next()
}

router.get('/admin/users', authenticate, requirePermission('user.manage'), adminUsersListHandler)

router.get(
  '/admin/moods',
  authenticate,
  requirePermission('mood.record.read'),
  adminMoodsListHandler
)

router.put(
  '/admin/users',
  authenticate,
  requirePermission('user.manage'),
  [
    body('userId').isInt({ min: 1 }).withMessage('userId 必须是正整数'),
    body('targetRole')
      .isIn(['user', 'admin', 'super_admin'])
      .withMessage('targetRole 仅支持 user/admin/super_admin'),
  ],
  validateRequest,
  adminUsersUpdateRoleHandler
)

router.delete('/admin/users/:id', authenticate, requirePermission('user.manage'), adminUsersDeleteHandler)

router.get('/admin/courses', authenticate, requirePermission('course.manage'), getCourses)

router.post(
  '/admin/courses',
  authenticate,
  requirePermission('course.manage'),
  [
    body('title').notEmpty().withMessage('title 不能为空'),
    body('description').notEmpty().withMessage('description 不能为空'),
    body('category').notEmpty().withMessage('category 不能为空'),
    body('content').optional().isString(),
    body('videoUrl').optional().isString(),
    body('coverImage').optional().isString(),
    body('coverUrl').optional().isString(),
  ],
  validateRequest,
  normalizeCreateCoursePayload,
  createCourse
)

router.put(
  '/admin/courses/:id',
  authenticate,
  requirePermission('course.manage'),
  [
    body('title').optional().isString(),
    body('description').optional().isString(),
    body('category').optional().isString(),
    body('content').optional().isString(),
    body('videoUrl').optional().isString(),
    body('coverImage').optional().isString(),
    body('coverUrl').optional().isString(),
    body('type').optional().isIn(['video', 'article']),
  ],
  validateRequest,
  normalizeUpdateCoursePayload,
  updateCourse
)

router.delete('/admin/courses/:id', authenticate, requirePermission('course.manage'), deleteCourse)

router.post(
  '/users/manage',
  authenticate,
  requirePermission('user.manage'),
  [body('targetUserId').optional().isInt(), body('action').optional().isString()],
  validateRequest,
  userManageHandler
)

router.post(
  '/roles/manage',
  authenticate,
  requirePermission('role.manage'),
  [
    body('targetUserId').isInt({ min: 1 }).withMessage('targetUserId 必须是正整数'),
    body('targetRole')
      .isIn(['user', 'admin', 'super_admin'])
      .withMessage('targetRole 仅支持 user/admin/super_admin'),
  ],
  validateRequest,
  roleManageHandler
)

router.post(
  '/system/config',
  authenticate,
  requirePermission('system.config'),
  [body('configKey').optional().isString()],
  validateRequest,
  systemConfigHandler
)

router.post(
  '/incident/fix',
  authenticate,
  requirePermission('incident.fix'),
  [
    body('issueDescription').notEmpty().withMessage('问题描述不能为空'),
    body('fixContent').notEmpty().withMessage('修复内容不能为空'),
    body('result').optional().isIn(['success', 'failed']),
  ],
  validateRequest,
  incidentFixHandler
)

router.post(
  '/feedback/handle',
  authenticate,
  requirePermission('feedback.handle'),
  [
    body('feedbackId').notEmpty().withMessage('反馈ID不能为空'),
    body('handleContent').notEmpty().withMessage('处理内容不能为空'),
    body('closeStatus').optional().isIn(['closed', 'pending']),
  ],
  validateRequest,
  feedbackHandleHandler
)

export default router
