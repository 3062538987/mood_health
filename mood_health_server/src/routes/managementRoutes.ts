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
  getAiUsageStatsHandler,
} from '../controllers/managementController'
import { authenticate, requireAdmin, requirePermission } from '../middleware/auth'
import { validateRequest } from '../middleware/validateRequest'
import { auditOperation } from '../utils/operationLogger'
import {
  getCourses,
  createCourse,
  updateCourse,
  deleteCourse,
} from '../controllers/courseController'

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
router.get('/admin/kpi', authenticate, requireAdmin, getKpiStatsHandler)
router.get('/admin/analytics/mood-trend', authenticate, requireAdmin, getMoodTrendHandler)
router.get('/admin/analytics/mood-distribution', authenticate, requireAdmin, getMoodDistributionHandler)
router.get('/admin/analytics/assessment-distribution', authenticate, requireAdmin, getAssessmentDistributionHandler)
router.get('/admin/analytics/module-usage', authenticate, requireAdmin, getModuleUsageHandler)
router.get('/admin/analytics/ai-usage', authenticate, requireAdmin, getAiUsageStatsHandler)

// 课程管理（复用 course 控制器；权限与 /api/courses 的写操作一致）
router.get('/admin/courses', authenticate, requirePermission('course.manage'), getCourses)
router.post(
  '/admin/courses',
  authenticate,
  requirePermission('course.manage'),
  auditOperation({ permissionCode: 'course.manage', operationType: 'COURSE_CREATE' }),
  createCourse,
)
router.put(
  '/admin/courses/:id',
  authenticate,
  requirePermission('course.manage'),
  auditOperation({
    permissionCode: 'course.manage',
    operationType: 'COURSE_UPDATE',
    getTargetId: (req) => (typeof req.params.id === 'string' ? req.params.id : null),
  }),
  updateCourse,
)
router.delete(
  '/admin/courses/:id',
  authenticate,
  requirePermission('course.manage'),
  auditOperation({
    permissionCode: 'course.manage',
    operationType: 'COURSE_DELETE',
    getTargetId: (req) => (typeof req.params.id === 'string' ? req.params.id : null),
  }),
  deleteCourse,
)

export default router
