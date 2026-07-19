import { Router } from 'express'
import { authenticate } from '../middleware/auth'
import {
  sessionCounselingHandler,
  getSessionsHandler,
  getSessionMessagesHandler,
  createSessionHandler,
} from '../controllers/counselingController'

const router = Router()

router.use(authenticate)

router.post('/send', sessionCounselingHandler)
router.get('/sessions', getSessionsHandler)
router.get('/sessions/:id', getSessionMessagesHandler)
router.post('/sessions', createSessionHandler)

export default router