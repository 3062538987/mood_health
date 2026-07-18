import { Router } from 'express'
import { authenticate, requireAdmin } from '../middleware/auth'
import { submitFeedback, getFeedbackStats, getFeedbackList } from '../controllers/feedbackController'

const router = Router()

router.use(authenticate)
router.post('/feedback', submitFeedback)
router.get('/feedback/stats', requireAdmin, getFeedbackStats)
router.get('/feedback/list', requireAdmin, getFeedbackList)

export default router