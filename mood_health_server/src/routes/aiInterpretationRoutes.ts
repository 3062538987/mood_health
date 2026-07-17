import { Router } from 'express'
import { authenticate } from '../middleware/auth'
import { validateRequest } from '../middleware/validateRequest'
import { validateInterpretation, interpretAssessmentHandler, validateMoodReport, generateMoodReportHandler } from '../controllers/aiInterpretationController'

const router = Router()

router.use(authenticate)

router.post('/interpret', validateInterpretation, validateRequest, interpretAssessmentHandler)
router.post('/report', validateMoodReport, validateRequest, generateMoodReportHandler)

export default router