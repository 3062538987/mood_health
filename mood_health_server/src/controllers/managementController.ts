import { HTTP_STATUS } from '../utils/httpStatus'
import { Response } from 'express'
import type { AuthRequest } from '../middleware/auth'
import { logOperation } from '../utils/operationLogger'
import { apiFailure, apiSuccess } from '../utils/apiResponse'
import logger from '../utils/logger'
import { createManagementService } from '../services/managementService'
import { createAssessmentService } from '../services/assessmentService'
import { isValidUserRole, checkRoleChangeAuthorization } from '../utils/roleAuthorization'

const managementService = createManagementService()
const assessmentService = createAssessmentService()

interface AdminUserItem {
  id: number
  username: string
  email: string
  role: 'user' | 'admin' | 'super_admin'
  createdAt: string
}

interface AdminMoodRecordItem {
  id: number
  userId: number
  username: string
  moodType: string[]
  intensity: number
  createdAt: string
}

interface AdminMoodListQuery {
  page: number
  pageSize: number
  userId?: number
  username?: string
  startDate?: string
  endDate?: string
  moodType?: string
}

const getClientIp = (req: AuthRequest): string => {
  const forwarded = req.headers['x-forwarded-for']
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0].trim()
  }
  return req.ip || '-'
}

const parseAdminMoodListQuery = (req: AuthRequest): AdminMoodListQuery => {
  const pageRaw = Number(req.query.page || 1)
  const pageSizeRaw = Number(req.query.pageSize || 20)

  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? Math.floor(pageRaw) : 1
  const pageSize =
    Number.isFinite(pageSizeRaw) && pageSizeRaw > 0 ? Math.min(Math.floor(pageSizeRaw), 100) : 20

  const userIdRaw = req.query.userId
  const parsedUserId = Number(userIdRaw)
  const userId =
    Number.isFinite(parsedUserId) && parsedUserId > 0 ? Math.floor(parsedUserId) : undefined
  const username = typeof req.query.username === 'string' ? req.query.username.trim() : undefined

  const startDate = typeof req.query.startDate === 'string' ? req.query.startDate : undefined
  const endDate = typeof req.query.endDate === 'string' ? req.query.endDate : undefined
  const moodType = typeof req.query.moodType === 'string' ? req.query.moodType.trim() : undefined

  return {
    page,
    pageSize,
    userId,
    username: username || undefined,
    startDate,
    endDate,
    moodType: moodType || undefined,
  }
}

export const adminUsersListHandler = async (req: AuthRequest, res: Response) => {
  try {
    const users: AdminUserItem[] = await managementService.listAdminUsers()

    await logOperation(
      req.user!.userId,
      req.user!.role,
      'user.manage',
      'USER_LIST',
      null,
      `count=${users.length}`,
      'success',
      getClientIp(req)
    )

    return res.status(HTTP_STATUS.OK).json(apiSuccess({ list: users }, '获取用户列表成功'))
  } catch (error) {
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(apiFailure(500, '获取用户列表失败'))
  }
}

export const adminUsersUpdateRoleHandler = async (req: AuthRequest, res: Response) => {
  try {
    const { userId, targetRole } = req.body

    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json(apiFailure(400, 'userId 必须是正整数'))
    }

    if (!isValidUserRole(targetRole)) {
      return res
        .status(400)
        .json(apiFailure(400, 'targetRole 非法，仅支持 user/admin/super_admin'))
    }

    // 角色变更硬约束（R2 修复：防 admin 自我提权 / 禁止自变更）
    const deny = checkRoleChangeAuthorization({
      caller: { userId: req.user!.userId, role: req.user!.role },
      targetUserId: userId,
      targetRole,
    })
    if (deny) {
      await logOperation(
        req.user!.userId,
        req.user!.role,
        'user.manage',
        'USER_ROLE_UPDATE',
        String(userId),
        `targetRole=${targetRole}; reason=${deny.message}`,
        'failed',
        getClientIp(req)
      )
      return res.status(deny.status).json(apiFailure(deny.status, deny.message))
    }

    const updated = await managementService.updateUserRole(userId, targetRole)

    if (!updated) {
      await logOperation(
        req.user!.userId,
        req.user!.role,
        'user.manage',
        'USER_ROLE_UPDATE',
        String(userId),
        `targetRole=${targetRole}; reason=target_user_not_found`,
        'failed',
        getClientIp(req)
      )

      return res.status(HTTP_STATUS.NOT_FOUND).json(apiFailure(404, '目标用户不存在'))
    }

    await logOperation(
      req.user!.userId,
      req.user!.role,
      'user.manage',
      'USER_ROLE_UPDATE',
      String(userId),
      `targetRole=${targetRole}`,
      'success',
      getClientIp(req)
    )

    return res.status(HTTP_STATUS.OK).json(apiSuccess(null, '用户角色更新成功'))
  } catch (error) {
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(apiFailure(500, '更新用户角色失败'))
  }
}

export const adminUsersDisableHandler = async (req: AuthRequest, res: Response) => {
  try {
    const userId = Number(req.params.id)

    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json(apiFailure(400, 'userId 必须是正整数'))
    }

    if (req.user?.userId === userId) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json(apiFailure(400, '不能停用当前登录用户'))
    }

    const disabled = await managementService.disableUser(userId)

    if (!disabled) {
      return res.status(HTTP_STATUS.NOT_FOUND).json(apiFailure(404, '目标用户不存在或已停用'))
    }

    await logOperation(
      req.user!.userId,
      req.user!.role,
      'user.manage',
      'USER_DISABLE',
      String(userId),
      'status=disabled',
      'success',
      getClientIp(req)
    )

    return res.status(HTTP_STATUS.OK).json(apiSuccess(null, '用户已停用'))
  } catch (error) {
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(apiFailure(500, '停用用户失败'))
  }
}

export const adminUsersDeleteHandler = async (req: AuthRequest, res: Response) => {
  try {
    const userId = Number(req.params.id)

    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json(apiFailure(400, 'userId 必须是正整数'))
    }

    if (req.user?.userId === userId) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json(apiFailure(400, '不能删除当前登录用户'))
    }

    const targetUser = await managementService.findAdminUserById(userId)
    if (!targetUser) {
      await logOperation(
        req.user!.userId,
        req.user!.role,
        'user.manage',
        'USER_DELETE',
        String(userId),
        'reason=target_user_not_found',
        'failed',
        getClientIp(req)
      )

      return res.status(HTTP_STATUS.NOT_FOUND).json(apiFailure(404, '目标用户不存在'))
    }

    if (targetUser.role === 'super_admin') {
      return res.status(HTTP_STATUS.FORBIDDEN).json(apiFailure(403, '不能删除超级管理员'))
    }

    const deleted = await managementService.deleteUserById(userId)

    if (!deleted) {
      await logOperation(
        req.user!.userId,
        req.user!.role,
        'user.manage',
        'USER_DELETE',
        String(userId),
        'reason=target_user_not_found',
        'failed',
        getClientIp(req)
      )

      return res.status(HTTP_STATUS.NOT_FOUND).json(apiFailure(404, '目标用户不存在'))
    }

    await logOperation(
      req.user!.userId,
      req.user!.role,
      'user.manage',
      'USER_DELETE',
      String(userId),
      `targetUsername=${targetUser.username}; targetRole=${targetUser.role}`,
      'success',
      getClientIp(req)
    )

    return res.status(HTTP_STATUS.OK).json(apiSuccess(null, '用户删除成功'))
  } catch (error) {
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(apiFailure(500, '删除用户失败'))
  }
}

export const adminMoodsListHandler = async (req: AuthRequest, res: Response) => {
  try {
    const { page, pageSize, userId, username, startDate, endDate, moodType } =
      parseAdminMoodListQuery(req)
    const { list, total } = await managementService.listAdminMoods({
      page,
      pageSize,
      userId,
      username,
      startDate,
      endDate,
      moodType,
    })

    return res
      .status(200)
      .json(apiSuccess({ list, total, page, pageSize }, '获取情绪统计成功'))
  } catch (error) {
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(apiFailure(500, '获取情绪统计失败'))
  }
}

// 有意预留端点 handler（前端管理页入口待补）：管理员测评会话列表
export const adminAssessmentsListHandler = async (req: AuthRequest, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1
    const pageSize = parseInt(req.query.pageSize as string) || 20
    const userId = req.query.userId ? parseInt(req.query.userId as string) : undefined
    const instrumentId = req.query.instrumentId ? parseInt(req.query.instrumentId as string) : undefined
    const riskLevel = req.query.riskLevel as string | undefined
    const startDate = req.query.startDate as string | undefined
    const endDate = req.query.endDate as string | undefined

    const { list, total } = await assessmentService.listAllSessions({
      page, pageSize, userId, instrumentId, riskLevel, startDate, endDate,
    })

    return res.status(HTTP_STATUS.OK).json(apiSuccess({ list, total, page, pageSize }, '获取测评列表成功'))
  } catch (error) {
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(apiFailure(500, '获取测评列表失败'))
  }
}

export const adminAssessmentDetailHandler = async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id as string)
    const detail = await assessmentService.getSessionDetailAdmin(id)

    if (!detail) {
      return res.status(HTTP_STATUS.NOT_FOUND).json(apiFailure(404, '测评会话不存在'))
    }

    return res.status(HTTP_STATUS.OK).json(apiSuccess(detail, '获取测评详情成功'))
  } catch (error) {
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(apiFailure(500, '获取测评详情失败'))
  }
}

// ==================== 数据分析接口 ====================

export const getKpiStatsHandler = async (req: AuthRequest, res: Response) => {
  try {
    const { startDate, endDate } = req.query as { startDate?: string; endDate?: string }
    const stats = await managementService.getKpiStats(startDate, endDate)
    return res.status(HTTP_STATUS.OK).json(apiSuccess(stats, '获取 KPI 统计成功'))
  } catch (error) {
    logger.error('[getKpiStats] Error:', error)
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(apiFailure(500, '获取 KPI 统计失败'))
  }
}

export const getMoodTrendHandler = async (req: AuthRequest, res: Response) => {
  try {
    const { startDate, endDate, granularity } = req.query as {
      startDate?: string; endDate?: string; granularity?: 'day' | 'week'
    }
    if (!startDate || !endDate) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json(apiFailure(1001, '缺少 startDate 或 endDate 参数'))
    }
    const trend = await managementService.getMoodTrend(startDate, endDate, granularity || 'day')
    return res.status(HTTP_STATUS.OK).json(apiSuccess(trend, '获取情绪趋势成功'))
  } catch (error) {
    logger.error('[getMoodTrend] Error:', error)
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(apiFailure(500, '获取情绪趋势失败'))
  }
}

export const getMoodDistributionHandler = async (req: AuthRequest, res: Response) => {
  try {
    const { startDate, endDate } = req.query as { startDate?: string; endDate?: string }
    if (!startDate || !endDate) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json(apiFailure(1001, '缺少 startDate 或 endDate 参数'))
    }
    const distribution = await managementService.getMoodDistribution(startDate, endDate)
    return res.status(HTTP_STATUS.OK).json(apiSuccess(distribution, '获取情绪分布成功'))
  } catch (error) {
    logger.error('[getMoodDistribution] Error:', error)
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(apiFailure(500, '获取情绪分布失败'))
  }
}

export const getAssessmentDistributionHandler = async (req: AuthRequest, res: Response) => {
  try {
    const { startDate, endDate, instrumentId } = req.query as {
      startDate?: string; endDate?: string; instrumentId?: string
    }
    if (!startDate || !endDate) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json(apiFailure(1001, '缺少 startDate 或 endDate 参数'))
    }
    const distribution = await managementService.getAssessmentDistribution(
      startDate, endDate, instrumentId ? parseInt(instrumentId) : undefined,
    )
    return res.status(HTTP_STATUS.OK).json(apiSuccess(distribution, '获取测评分布成功'))
  } catch (error) {
    logger.error('[getAssessmentDistribution] Error:', error)
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(apiFailure(500, '获取测评分布失败'))
  }
}

export const getModuleUsageHandler = async (req: AuthRequest, res: Response) => {
  try {
    const { startDate, endDate } = req.query as { startDate?: string; endDate?: string }
    if (!startDate || !endDate) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json(apiFailure(1001, '缺少 startDate 或 endDate 参数'))
    }
    const usage = await managementService.getModuleUsage(startDate, endDate)
    return res.status(HTTP_STATUS.OK).json(apiSuccess(usage, '获取模块使用统计成功'))
  } catch (error) {
    logger.error('[getModuleUsage] Error:', error)
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(apiFailure(500, '获取模块使用统计失败'))
  }
}

export const getAiUsageStatsHandler = async (req: AuthRequest, res: Response) => {
  try {
    const { startDate, endDate } = req.query as { startDate?: string; endDate?: string }
    const stats = await managementService.getAiUsageStats(startDate, endDate)
    return res.status(HTTP_STATUS.OK).json(apiSuccess(stats, '获取 AI 使用统计成功'))
  } catch (error) {
    logger.error('[getAiUsageStats] Error:', error)
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(apiFailure(500, '获取 AI 使用统计失败'))
  }
}
