import { Router } from 'express'
import { authenticate, requireRole } from '../middleware/auth'
import { parseKnowledgeUpload } from '../middleware/knowledgeUpload'
import {
  downloadKnowledgeResource,
  getKnowledgeResource,
  listKnowledgeFolders,
  listKnowledgeResources,
  setKnowledgeResourceFavorite,
  uploadKnowledgeResource,
} from '../controllers/knowledgeResourceController'

const router = Router()

router.use(authenticate)
router.get('/folders', listKnowledgeFolders)
router.get('/', listKnowledgeResources)
router.post(
  '/upload',
  requireRole(['counselor', 'admin', 'super_admin']),
  parseKnowledgeUpload,
  uploadKnowledgeResource
)
router.get('/:id/download', downloadKnowledgeResource)
router.get('/:id', getKnowledgeResource)
router.post('/:id/favorite', setKnowledgeResourceFavorite)

export default router
