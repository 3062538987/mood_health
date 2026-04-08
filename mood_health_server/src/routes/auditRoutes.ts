import { Router } from 'express'
import { getOperationLogsHandler } from '../controllers/auditController'
import { authenticate, requireRole, requirePermission } from '../middleware/auth'

const router = Router()

// 仅 super_admin 可查询操作审计日志
router.get(
  '/operation-logs',
  authenticate,
  requireRole(['super_admin']),
  requirePermission('audit.record.view_all'),
  getOperationLogsHandler
)

router.get(
  '/all',
  authenticate,
  requireRole(['super_admin']),
  requirePermission('audit.record.view_all'),
  getOperationLogsHandler
)

export default router
