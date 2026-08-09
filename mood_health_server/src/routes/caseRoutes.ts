import { Router } from 'express'
import { authenticate, requirePermission } from '../middleware/auth'
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
router.get('/', requirePermission('case.read_own'), listMyCases)

// 创建个案
router.post('/', requirePermission('case.create'), validateCreateCase, validateRequest, createCase)

// 获取个案详情
router.get('/:id', requirePermission('case.read_own'), getCaseDetail)

// 分配咨询师
router.put('/:id/assign', requirePermission('case.assign'), validateAssignCase, validateRequest, assignCase)

// 添加干预记录
router.post('/:id/interventions', requirePermission('case.intervene'), validateAddIntervention, validateRequest, addIntervention)

// 转介个案
router.put('/:id/refer', requirePermission('case.refer'), validateReferCase, validateRequest, referCase)

// 结案
router.put('/:id/close', requirePermission('case.close'), validateCloseCase, validateRequest, closeCase)

export default router