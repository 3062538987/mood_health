import { Router } from 'express'
import { authenticate } from '../middleware/auth'
import { getContentRecommendations } from '../controllers/recommendController'

const router = Router()

router.use(authenticate)
router.get('/content', getContentRecommendations)

export default router