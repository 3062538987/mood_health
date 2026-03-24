import { Router } from 'express'
import { body } from 'express-validator'
import {
  feedbackHandleHandler,
  incidentFixHandler,
  roleManageHandler,
  systemConfigHandler,
  userManageHandler,
} from '../controllers/managementController'
import { authenticate, requirePermission } from '../middleware/auth'
import { validateRequest } from '../middleware/validateRequest'

const router = Router()

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
