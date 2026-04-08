import { Router } from 'express'
import { body } from 'express-validator'
import { authenticate, requirePermission } from '../middleware/auth'
import { validateRequest } from '../middleware/validateRequest'
import { auditOperation } from '../utils/operationLogger'
import {
  getActivityList,
  getActivityDetail,
  getActivityDetailWithParticipants,
  joinActivityHandler,
  cancelJoinActivityHandler,
  getMyJoinedActivities,
  createActivityHandler,
  updateActivityHandler,
  deleteActivityHandler,
} from '../controllers/activityController'

const router = Router()

router.get('/list', getActivityList)
router.get('/detail/:id', getActivityDetail)
router.get('/detail-with-participants/:id', getActivityDetailWithParticipants)

router.post('/join/:id', authenticate, joinActivityHandler)
router.post('/cancel/:id', authenticate, cancelJoinActivityHandler)
router.get('/my-joined', authenticate, getMyJoinedActivities)

router.post(
  '/create',
  authenticate,
  requirePermission('activity.manage'),
  auditOperation({
    permissionCode: 'activity.manage',
    operationType: 'ACTIVITY_CREATE',
  }),
  [
    body('title').notEmpty().withMessage('活动标题不能为空'),
    body('description').notEmpty().withMessage('活动描述不能为空'),
    body('startTime').isISO8601().withMessage('开始时间格式不正确'),
    body('endTime').isISO8601().withMessage('结束时间格式不正确'),
    body('location').notEmpty().withMessage('活动地点不能为空'),
    body('maxParticipants').isInt({ min: 1 }).withMessage('最大参与人数必须是正整数'),
  ],
  validateRequest,
  createActivityHandler
)

router.put(
  '/update/:id',
  authenticate,
  requirePermission('activity.manage'),
  auditOperation({
    permissionCode: 'activity.manage',
    operationType: 'ACTIVITY_UPDATE',
    getTargetId: (req) => (typeof req.params.id === 'string' ? req.params.id : null),
  }),
  [
    body('title').optional().notEmpty().withMessage('活动标题不能为空'),
    body('description').optional().notEmpty().withMessage('活动描述不能为空'),
    body('startTime').optional().isISO8601().withMessage('开始时间格式不正确'),
    body('endTime').optional().isISO8601().withMessage('结束时间格式不正确'),
    body('location').optional().notEmpty().withMessage('活动地点不能为空'),
    body('maxParticipants').optional().isInt({ min: 1 }).withMessage('最大参与人数必须是正整数'),
  ],
  validateRequest,
  updateActivityHandler
)

router.delete(
  '/delete/:id',
  authenticate,
  requirePermission('activity.manage'),
  auditOperation({
    permissionCode: 'activity.manage',
    operationType: 'ACTIVITY_DELETE',
    getTargetId: (req) => (typeof req.params.id === 'string' ? req.params.id : null),
  }),
  deleteActivityHandler
)

export default router
