import { Response, NextFunction } from 'express'
import { body, param } from 'express-validator'
import { AuthRequest } from '../middleware/auth'
import { apiFailure, apiSuccess } from '../utils/apiResponse'
import { createCaseService } from '../services/caseService'

const caseService = createCaseService()

export const validateAutoCreateCase = [
  body('assessment_session_id').isInt({ min: 1 }).withMessage('测评会话ID必须是正整数'),
]

export const validateCreateCase = [
  body('studentUserId').isInt({ min: 1 }).withMessage('学生用户ID必须是正整数'),
  body('riskLevel').optional().isString().withMessage('风险等级必须是字符串'),
  body('summary').optional().isString().withMessage('摘要必须是字符串'),
]

export const validateAssignCase = [
  param('id').isInt({ min: 1 }).withMessage('个案ID必须是正整数'),
  body('counselorId').isInt({ min: 1 }).withMessage('咨询师ID必须是正整数'),
]

export const validateAddIntervention = [
  param('id').isInt({ min: 1 }).withMessage('个案ID必须是正整数'),
  body('interventionType').isIn(['note', 'interview', 'referral', 'closure']).withMessage('干预类型无效'),
  body('content').isString().notEmpty().withMessage('干预内容不能为空'),
]

export const validateReferCase = [
  param('id').isInt({ min: 1 }).withMessage('个案ID必须是正整数'),
  body('reason').isString().notEmpty().withMessage('转介原因不能为空'),
  body('target').isString().notEmpty().withMessage('转介目标不能为空'),
]

export const validateCloseCase = [
  param('id').isInt({ min: 1 }).withMessage('个案ID必须是正整数'),
  body('summary').isString().notEmpty().withMessage('结案摘要不能为空'),
]

export const createCase = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { studentUserId, riskLevel, summary } = req.body as {
      studentUserId: number
      riskLevel?: string
      summary?: string
    }
    const c = await caseService.createCase({ studentUserId, riskLevel, summary })
    res.status(201).json(apiSuccess(c, '个案创建成功'))
  } catch (error) {
    next(error)
  }
}

export const assignCase = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const caseId = parseInt(req.params.id as string)
    const { counselorId } = req.body as { counselorId: number }
    const c = await caseService.assignCase({ caseId, counselorId })
    res.json(apiSuccess(c, '个案分配成功'))
  } catch (error) {
    next(error)
  }
}

export const addIntervention = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const caseId = parseInt(req.params.id as string)
    const { interventionType, content, referralTarget, referralReason, closureSummary } = req.body as {
      interventionType: string
      content: string
      referralTarget?: string
      referralReason?: string
      closureSummary?: string
    }
    const intervention = await caseService.addIntervention({
      caseId,
      counselorUserId: req.user!.userId,
      interventionType: interventionType as any,
      content,
      referralTarget,
      referralReason,
      closureSummary,
    })
    res.status(201).json(apiSuccess(intervention, '干预记录创建成功'))
  } catch (error) {
    next(error)
  }
}

export const referCase = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const caseId = parseInt(req.params.id as string)
    const { reason, target } = req.body as { reason: string; target: string }
    const c = await caseService.referCase({
      caseId,
      counselorUserId: req.user!.userId,
      reason,
      target,
    })
    res.json(apiSuccess(c, '个案已转介'))
  } catch (error) {
    next(error)
  }
}

export const closeCase = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const caseId = parseInt(req.params.id as string)
    const { summary } = req.body as { summary: string }
    const c = await caseService.closeCase({
      caseId,
      counselorUserId: req.user!.userId,
      summary,
    })
    res.json(apiSuccess(c, '个案已结案'))
  } catch (error) {
    next(error)
  }
}

export const listMyCases = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const cases = await caseService.listMyCases(req.user!.userId, req.user!.role)
    res.json(apiSuccess(cases, '获取个案列表成功'))
  } catch (error) {
    next(error)
  }
}

export const getCaseDetail = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const caseId = parseInt(req.params.id as string)
    const detail = await caseService.getCaseDetail(caseId)
    if (!detail) {
      return res.status(404).json(apiFailure(404, '个案不存在'))
    }
    res.json(apiSuccess(detail, '获取个案详情成功'))
  } catch (error) {
    next(error)
  }
}

export const autoCreateCase = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { assessment_session_id } = req.body as { assessment_session_id: number }
    const result = await caseService.autoCreateCase(assessment_session_id)
    const message = result.created ? '测评高风险，已自动创建个案' : '个案已存在或无需创建'
    res.status(201).json(apiSuccess(result, message))
  } catch (error) {
    next(error)
  }
}