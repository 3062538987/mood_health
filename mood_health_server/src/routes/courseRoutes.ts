import express from 'express'
import {
  getCourses,
  getCourseById,
  createCourse,
  updateCourse,
  deleteCourse,
} from '../controllers/courseController'
import { authenticate, requirePermission } from '../middleware/auth'
import { auditOperation } from '../utils/operationLogger'

const router = express.Router()

// 公开路由
router.get('/', getCourses)
router.get('/:id', getCourseById)

// 需要认证的路由（管理员）
router.post(
  '/',
  authenticate,
  requirePermission('course.manage'),
  auditOperation({ permissionCode: 'course.manage', operationType: 'COURSE_CREATE' }),
  createCourse
)
router.put(
  '/:id',
  authenticate,
  requirePermission('course.manage'),
  auditOperation({
    permissionCode: 'course.manage',
    operationType: 'COURSE_UPDATE',
    getTargetId: (req) => (typeof req.params.id === 'string' ? req.params.id : null),
  }),
  updateCourse
)
router.delete(
  '/:id',
  authenticate,
  requirePermission('course.manage'),
  auditOperation({
    permissionCode: 'course.manage',
    operationType: 'COURSE_DELETE',
    getTargetId: (req) => (typeof req.params.id === 'string' ? req.params.id : null),
  }),
  deleteCourse
)

export default router
