import { Router } from 'express'
import { authenticate } from '../middleware/auth'
import { validateRequest } from '../middleware/validateRequest'
import { validateInterpretation, interpretAssessmentHandler } from '../controllers/aiInterpretationController'

const router = Router()

router.use(authenticate)

router.post('/interpret', validateInterpretation, validateRequest, interpretAssessmentHandler)

export default router