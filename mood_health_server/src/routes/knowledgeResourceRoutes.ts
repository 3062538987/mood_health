import { Router } from 'express'
import { authenticate } from '../middleware/auth'
import {
  getKnowledgeResource,
  listKnowledgeFolders,
  listKnowledgeResources,
  setKnowledgeResourceFavorite,
} from '../controllers/knowledgeResourceController'

const router = Router()

router.use(authenticate)
router.get('/folders', listKnowledgeFolders)
router.get('/', listKnowledgeResources)
router.get('/:id', getKnowledgeResource)
router.post('/:id/favorite', setKnowledgeResourceFavorite)

export default router
