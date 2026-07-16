import { Router } from 'express'
import { getOperationLogsHandler } from '../controllers/auditController'
import { authenticate, requirePermission } from '../middleware/auth'

const router = Router()

// 仅 super_admin 可查询操作审计日志
router.get(
  '/operation-logs',
  authenticate,
  requirePermission('audit.record.view_all'),
  getOperationLogsHandler
)

router.get(
  '/all',
  authenticate,
  requirePermission('audit.record.view_all'),
  getOperationLogsHandler
)

export default router
