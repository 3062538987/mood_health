import { Router } from 'express'
import { body, param } from 'express-validator'
import { authenticate } from '../middleware/auth'
import { validateRequest } from '../middleware/validateRequest'
import { getMessages, getSessions, postMessage } from '../controllers/knowledgeAssistantController'

const router = Router()
router.use(authenticate)
router.post(
  '/messages',
  body('message').isString().trim().isLength({ min: 1, max: 1000 }),
  body('sessionId').optional().isUUID(),
  validateRequest,
  postMessage
)
router.get('/sessions', getSessions)
router.get(
  '/sessions/:sessionId/messages',
  param('sessionId').isUUID(),
  validateRequest,
  getMessages
)

export default router
