import { Router } from 'express'
import { authenticate } from '../middleware/auth'
import {
  createAnalysis,
  getLatestAnalysis,
  listAnalyses,
  getAnalysisById,
  runAnalysis,
  deleteAnalysisHandler,
} from '../controllers/moodAnalysisController'

const router = Router()

router.use(authenticate)

router.post('/mood-analyses', createAnalysis)
router.get('/mood-analyses/latest', getLatestAnalysis)
router.get('/mood-analyses', listAnalyses)
router.get('/mood-analyses/:id', getAnalysisById)
router.post('/mood-analyses/:id', runAnalysis)
router.delete('/mood-analyses/:id', deleteAnalysisHandler)

export default router