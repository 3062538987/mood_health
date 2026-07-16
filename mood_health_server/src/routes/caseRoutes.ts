import { Router } from 'express'
import { authenticate } from '../middleware/auth'
import { validateRequest } from '../middleware/validateRequest'
import {
  createCase,
  assignCase,
  addIntervention,
  referCase,
  closeCase,
  listMyCases,
  getCaseDetail,
  validateCreateCase,
  validateAssignCase,
  validateAddIntervention,
  validateReferCase,
  validateCloseCase,
} from '../controllers/caseController'

const router = Router()

router.use(authenticate)

// 获取当前用户的个案列表
router.get('/', listMyCases)

// 创建个案
router.post('/', validateCreateCase, validateRequest, createCase)

// 获取个案详情
router.get('/:id', getCaseDetail)

// 分配咨询师
router.put('/:id/assign', validateAssignCase, validateRequest, assignCase)

// 添加干预记录
router.post('/:id/interventions', validateAddIntervention, validateRequest, addIntervention)

// 转介个案
router.put('/:id/refer', validateReferCase, validateRequest, referCase)

// 结案
router.put('/:id/close', validateCloseCase, validateRequest, closeCase)

export default router