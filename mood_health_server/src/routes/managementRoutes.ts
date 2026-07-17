import { Router } from 'express'
import { body } from 'express-validator'
import {
  adminMoodsListHandler,
  adminUsersListHandler,
  adminUsersDeleteHandler,
  adminUsersDisableHandler,
  adminUsersUpdateRoleHandler,
  roleManageHandler,
  systemConfigHandler,
  userManageHandler,
  adminAssessmentsListHandler,
  adminAssessmentDetailHandler,
  getKpiStatsHandler,
  getMoodTrendHandler,
  getMoodDistributionHandler,
  getAssessmentDistributionHandler,
  getModuleUsageHandler,
} from '../controllers/managementController'
import { authenticate, requirePermission } from '../middleware/auth'
import { validateRequest } from '../middleware/validateRequest'

const router = Router()

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

router.put('/admin/users/:id/disable', authenticate, requirePermission('user.manage'), adminUsersDisableHandler)

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

router.get('/admin/assessments', authenticate, requirePermission('user.manage'), adminAssessmentsListHandler)
router.get('/admin/assessments/:id', authenticate, requirePermission('user.manage'), adminAssessmentDetailHandler)

// 数据分析接口
router.get('/admin/kpi', authenticate, requirePermission('admin.access'), getKpiStatsHandler)
router.get('/admin/analytics/mood-trend', authenticate, requirePermission('admin.access'), getMoodTrendHandler)
router.get('/admin/analytics/mood-distribution', authenticate, requirePermission('admin.access'), getMoodDistributionHandler)
router.get('/admin/analytics/assessment-distribution', authenticate, requirePermission('admin.access'), getAssessmentDistributionHandler)
router.get('/admin/analytics/module-usage', authenticate, requirePermission('admin.access'), getModuleUsageHandler)

export default router
