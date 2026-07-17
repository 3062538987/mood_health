import { Router } from 'express'
import { authenticate, requirePermission } from '../middleware/auth'
import { submitFeedback, getFeedbackStats } from '../controllers/feedbackController'

const router = Router()

router.use(authenticate)
router.post('/feedback', submitFeedback)
router.get('/feedback/stats', requirePermission('admin.access'), getFeedbackStats)

export default router