import { Router } from 'express'
import { body } from 'express-validator'
import { authenticate } from '../middleware/auth'
import { validateRequest } from '../middleware/validateRequest'
import {
  getQuestionnaireList,
  getQuestionnaireDetail,
  getQuestionnaireQuestions,
  submitAssessment,
  getAssessmentDetail,
  getUserAssessmentHistoryController,
} from '../controllers/questionnaireController'

const router = Router()

// 所有量表路由都需要认证
router.use(authenticate)

// 获取量表列表
router.get('/', getQuestionnaireList)

// 获取用户测评历史记录
router.get('/history', getUserAssessmentHistoryController)

// 提交测评答案
router.post(
  '/assessments',
  [
    body('questionnaire_id').isInt({ min: 1 }).withMessage('量表ID必须是正整数'),
    body('answers').isArray({ min: 1 }).withMessage('答案数组不能为空'),
    body('answers.*.itemId').isInt({ min: 1 }).withMessage('题目ID必须是正整数'),
    body('answers.*.score').isInt({ min: 0, max: 4 }).withMessage('答案分数必须是0-4之间的整数'),
  ],
  validateRequest,
  submitAssessment
)

// 获取测评结果详情
router.get('/assessments/:id', getAssessmentDetail)

// 获取量表问题列表
router.get('/:id/questions', getQuestionnaireQuestions)

// 获取量表详情
router.get('/:id', getQuestionnaireDetail)

export default router