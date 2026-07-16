import { Router } from 'express'
import { authenticate, requirePermission } from '../middleware/auth'
import { listPromptsHandler, getPromptHandler, createPromptHandler, updatePromptHandler, deletePromptHandler } from '../controllers/promptController'

const router = Router()

router.use(authenticate)

router.get('/', requirePermission('prompt.manage'), listPromptsHandler)
router.get('/:id', requirePermission('prompt.manage'), getPromptHandler)
router.post('/', requirePermission('prompt.manage'), createPromptHandler)
router.put('/:id', requirePermission('prompt.manage'), updatePromptHandler)
router.delete('/:id', requirePermission('prompt.manage'), deletePromptHandler)

export default router