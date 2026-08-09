import { Router } from 'express'
import { authenticate } from '../middleware/auth'
import { submitFeedback } from '../controllers/feedbackController'

const router = Router()

router.use(authenticate)
router.post('/feedback', submitFeedback)

export default router