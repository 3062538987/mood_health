import { Router } from 'express'
import { body } from 'express-validator'
import {
  feedbackHandleHandler,
  incidentFixHandler,
  roleManageHandler,
  systemConfigHandler,
  userManageHandler,
} from '../controllers/managementController'
import { authenticate, requirePermission, requireRole } from '../middleware/auth'
import { validateRequest } from '../middleware/validateRequest'

const router = Router()

router.post(
  '/users/manage',
  authenticate,
  requireRole(['super_admin']),
  requirePermission('user.manage'),
  [body('targetUserId').optional().isInt(), body('action').optional().isString()],
  validateRequest,
  userManageHandler
)

router.post(
  '/roles/manage',
  authenticate,
  requireRole(['super_admin']),
  requirePermission('role.manage'),
  [body('targetUserId').optional().isInt(), body('targetRole').optional().isString()],
  validateRequest,
  roleManageHandler
)

router.post(
  '/system/config',
  authenticate,
  requireRole(['super_admin']),
  requirePermission('system.config'),
  [body('configKey').optional().isString()],
  validateRequest,
  systemConfigHandler
)

router.post(
  '/incident/fix',
  authenticate,
  requireRole(['super_admin']),
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
  requireRole(['admin']),
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
