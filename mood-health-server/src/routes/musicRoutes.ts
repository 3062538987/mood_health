import { Router } from 'express'
import {
  getMusicList,
  getMusicById,
  createMusic,
  updateMusic,
  deleteMusic,
} from '../controllers/musicController'
import { authenticate, requirePermission, requireRole } from '../middleware/auth'
import { auditOperation } from '../utils/operationLogger'

const router = Router()

// 公开路由
router.get('/', getMusicList)
router.get('/:id', getMusicById)

// 需要认证的路由（管理员功能）
router.post(
  '/',
  authenticate,
  requireRole(['super_admin', 'admin']),
  requirePermission('music.manage'),
  auditOperation({ permissionCode: 'music.manage', operationType: 'MUSIC_CREATE' }),
  createMusic
)
router.put(
  '/:id',
  authenticate,
  requireRole(['super_admin', 'admin']),
  requirePermission('music.manage'),
  auditOperation({
    permissionCode: 'music.manage',
    operationType: 'MUSIC_UPDATE',
    getTargetId: (req) => (typeof req.params.id === 'string' ? req.params.id : null),
  }),
  updateMusic
)
router.delete(
  '/:id',
  authenticate,
  requireRole(['super_admin', 'admin']),
  requirePermission('music.manage'),
  auditOperation({
    permissionCode: 'music.manage',
    operationType: 'MUSIC_DELETE',
    getTargetId: (req) => (typeof req.params.id === 'string' ? req.params.id : null),
  }),
  deleteMusic
)

export default router
