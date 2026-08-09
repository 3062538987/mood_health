import { Router } from 'express'
import { body, param } from 'express-validator'
import { authenticate } from '../middleware/auth'
import { validateRequest } from '../middleware/validateRequest'
import {
  sessionCounselingHandler,
  getSessionsHandler,
  getSessionMessagesHandler,
  renameSessionHandler,
} from '../controllers/counselingController'

const router = Router()

router.use(authenticate)

router.post(
  '/send',
  body('message').isString().trim().isLength({ min: 1, max: 1000 }),
  body('sessionId').optional().isUUID(),
  body('allowWebSearch').optional().custom((value) => typeof value === 'boolean'),
  validateRequest,
  sessionCounselingHandler
)
router.get('/sessions', getSessionsHandler)
router.get(
  '/sessions/:sessionId',
  param('sessionId').isUUID(),
  validateRequest,
  getSessionMessagesHandler
)
router.patch(
  '/sessions/:sessionId',
  param('sessionId').isUUID(),
  body('title').isString().trim().isLength({ min: 1, max: 30 }),
  validateRequest,
  renameSessionHandler
)

export default router
