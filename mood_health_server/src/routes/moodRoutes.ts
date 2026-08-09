import { Router } from 'express'
import { body } from 'express-validator'
import { authenticate, requirePermission } from '../middleware/auth'
import { validateRequest } from '../middleware/validateRequest'
import {
  recordMood,
  getMoodList,
  getWeeklyReportHandler,
  deleteMoodHandler,
  getMoodTrend,
  getMoodTypes,
  getMoodComparison,
  getMoodAlerts,
  markAlertRead,
  getMoodInsightHandler,
} from '../controllers/moodController'
import { saveAdviceHandler, getAdviceHistoryHandler } from '../controllers/adviceController'

const router = Router()

router.use(authenticate)

router.post(
  '/record',
  [
    body('emotions').optional().isArray().withMessage('情绪数据必须是数组'),
    body('emotions.*.emotionTypeId').optional().isInt().withMessage('情绪类型ID必须是整数'),
    body('emotions.*.intensity')
      .optional()
      .isInt({ min: 1, max: 10 })
      .withMessage('情绪强度必须在1-10之间'),
    body('intensity').optional().isInt({ min: 1, max: 10 }).withMessage('情绪强度必须在1-10之间'),
    body('intensity_score')
      .optional()
      .isInt({ min: 1, max: 10 })
      .withMessage('情绪强度必须在1-10之间'),
    body('level').optional().isInt({ min: 1, max: 10 }).withMessage('情绪强度必须在1-10之间'),
    body('tagIds').optional().isArray().withMessage('标签ID必须是数组'),
    body('trigger').optional().isString().withMessage('触发因素必须是字符串'),
    body('event').optional().isString().withMessage('情绪描述必须是字符串'),
  ],
  validateRequest,
  recordMood
)
router.get('/list', getMoodList)
router.get('/weekly-report', getWeeklyReportHandler)
router.get('/trend', getMoodTrend)
router.get('/comparison', getMoodComparison)
router.get('/alerts', getMoodAlerts)
router.put('/alerts/:id/read', markAlertRead)
router.get('/insight', getMoodInsightHandler)
router.post('/advice/save', saveAdviceHandler)
router.get('/advice/history', requirePermission('mood.advice.history.read'), getAdviceHistoryHandler)
router.get('/types', getMoodTypes)
router.delete('/:id', deleteMoodHandler)

export default router
