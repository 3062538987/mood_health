import { Router } from 'express'
import { authenticate, requireAdmin } from '../middleware/auth'
import { submitFeedback, getFeedbackStats } from '../controllers/feedbackController'

const router = Router()

router.use(authenticate)
router.post('/feedback', submitFeedback)
router.get('/feedback/stats', requireAdmin, getFeedbackStats)

export default router