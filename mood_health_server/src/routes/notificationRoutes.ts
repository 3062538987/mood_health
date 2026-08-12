import { Router } from 'express'
import { authenticate } from '../middleware/auth'
import {
  createTestUserNotification,
  getNotificationPreferences,
  listUserNotifications,
  markUserNotificationRead,
  processDueNotifications,
  saveNotificationPreferences,
} from '../controllers/notificationController'

const router = Router()

router.use(authenticate)
router.get('/preferences', getNotificationPreferences)
router.put('/preferences', saveNotificationPreferences)
router.get('/', listUserNotifications)
router.post('/process-due', processDueNotifications)
router.post('/test', createTestUserNotification)
router.patch('/:id/read', markUserNotificationRead)

export default router
