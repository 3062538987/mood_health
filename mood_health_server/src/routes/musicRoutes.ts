import { Router } from 'express'
import { getMusicList, getMusicById, updateMusic } from '../controllers/musicController'
import { authenticate, requirePermission } from '../middleware/auth'
import { auditOperation } from '../utils/operationLogger'

const router = Router()

// 公开路由
router.get('/', getMusicList)
router.get('/:id', getMusicById)

// 需要认证的路由（管理员功能）
// 音乐新增/删除统一走管理后台审批，此处仅暴露公开浏览 + 编辑（PUT）端点
router.put(
  '/:id',
  authenticate,
  requirePermission('music.manage'),
  auditOperation({
    permissionCode: 'music.manage',
    operationType: 'MUSIC_UPDATE',
    getTargetId: (req) => (typeof req.params.id === 'string' ? req.params.id : null),
  }),
  updateMusic
)

export default router
