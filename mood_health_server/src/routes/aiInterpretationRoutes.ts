import { Router } from 'express'
import { authenticate } from '../middleware/auth'
import { validateRequest } from '../middleware/validateRequest'
import { validateInterpretation, interpretAssessmentHandler, validateMoodReport, generateMoodReportHandler } from '../controllers/aiInterpretationController'
import { counselingHandler } from '../controllers/counselingController'
import { generateGentleReply } from '../controllers/treeholeController'
import { analyzeWithContext } from '../controllers/aiContextController'

const router = Router()

router.use(authenticate)

router.post('/interpret', validateInterpretation, validateRequest, interpretAssessmentHandler)
router.post('/report', validateMoodReport, validateRequest, generateMoodReportHandler)
router.post('/counseling', counselingHandler)
router.post('/treehole/gentle-reply', generateGentleReply)
router.post('/context/analyze', analyzeWithContext)

export default router