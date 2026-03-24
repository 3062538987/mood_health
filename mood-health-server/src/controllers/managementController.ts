import { Response } from 'express'
import sql from 'mssql'
import pool from '../config/database'
import type { AuthRequest } from '../middleware/auth'
import { logOperation } from '../utils/operationLogger'
import { isValidUserRole, updateUserRole } from '../models/userModel'

const getClientIp = (req: AuthRequest): string => {
  const forwarded = req.headers['x-forwarded-for']
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0].trim()
  }
  return req.ip || '-'
}

export const userManageHandler = async (req: AuthRequest, res: Response) => {
  try {
    const { targetUserId, action } = req.body

    await logOperation(
      req.user!.userId,
      req.user!.role,
      'user.manage',
      'USER_MANAGE',
      targetUserId ? String(targetUserId) : null,
      `action=${action || 'unknown'}`,
      'success',
      getClientIp(req)
    )

    res.status(200).json({ code: 0, message: '用户管理操作已记录' })
  } catch (error) {
    res.status(500).json({ code: 500, message: '用户管理操作失败' })
  }
}

export const roleManageHandler = async (req: AuthRequest, res: Response) => {
  try {
    const { targetUserId, targetRole } = req.body

    if (!Number.isInteger(targetUserId) || targetUserId <= 0) {
      return res.status(400).json({ code: 400, message: 'targetUserId 必须是正整数' })
    }

    if (!isValidUserRole(targetRole)) {
      return res
        .status(400)
        .json({ code: 400, message: 'targetRole 非法，仅支持 user/admin/super_admin' })
    }

    const updateResult = await updateUserRole(targetUserId, targetRole)
    if ((updateResult.rowsAffected?.[0] || 0) === 0) {
      await logOperation(
        req.user!.userId,
        req.user!.role,
        'role.manage',
        'ROLE_MANAGE',
        String(targetUserId),
        `targetRole=${targetRole}; reason=target_user_not_found`,
        'failed',
        getClientIp(req)
      )

      return res.status(404).json({ code: 404, message: '目标用户不存在' })
    }

    await logOperation(
      req.user!.userId,
      req.user!.role,
      'role.manage',
      'ROLE_MANAGE',
      targetUserId ? String(targetUserId) : null,
      `targetRole=${targetRole}`,
      'success',
      getClientIp(req)
    )

    res.status(200).json({ code: 0, message: '用户角色更新成功' })
  } catch (error) {
    res.status(500).json({ code: 500, message: '角色管理操作失败' })
  }
}

export const systemConfigHandler = async (req: AuthRequest, res: Response) => {
  try {
    const { configKey } = req.body

    await logOperation(
      req.user!.userId,
      req.user!.role,
      'system.config',
      'SYSTEM_CONFIG',
      configKey ? String(configKey) : null,
      `configKey=${configKey || 'unknown'}`,
      'success',
      getClientIp(req)
    )

    res.status(200).json({ code: 0, message: '系统配置操作已记录' })
  } catch (error) {
    res.status(500).json({ code: 500, message: '系统配置操作失败' })
  }
}

export const incidentFixHandler = async (req: AuthRequest, res: Response) => {
  try {
    const { issueDescription, fixContent, result = 'success' } = req.body

    await pool
      .request()
      .input('fixerId', sql.Int, req.user!.userId)
      .input('fixerRole', sql.NVarChar(20), req.user!.role)
      .input('issueDescription', sql.NVarChar(sql.MAX), issueDescription)
      .input('fixContent', sql.NVarChar(sql.MAX), fixContent)
      .input('result', sql.NVarChar(20), result).query(`
        INSERT INTO incident_fix_list (fixer_id, fixer_role, issue_description, fix_content, result)
        VALUES (@fixerId, @fixerRole, @issueDescription, @fixContent, @result)
      `)

    await logOperation(
      req.user!.userId,
      req.user!.role,
      'incident.fix',
      'INCIDENT_FIX',
      null,
      `issue=${String(issueDescription || '').slice(0, 120)}`,
      'success',
      getClientIp(req)
    )

    res.status(200).json({ code: 0, message: '修复清单已记录' })
  } catch (error) {
    await logOperation(
      req.user!.userId,
      req.user!.role,
      'incident.fix',
      'INCIDENT_FIX',
      null,
      '修复清单记录失败',
      'failed',
      getClientIp(req)
    )
    res.status(500).json({ code: 500, message: '修复清单记录失败' })
  }
}

export const feedbackHandleHandler = async (req: AuthRequest, res: Response) => {
  try {
    const { feedbackId, handleContent, closeStatus = 'closed' } = req.body

    await pool
      .request()
      .input('handlerId', sql.Int, req.user!.userId)
      .input('handlerRole', sql.NVarChar(20), req.user!.role)
      .input('feedbackId', sql.NVarChar(100), String(feedbackId || ''))
      .input('handleContent', sql.NVarChar(sql.MAX), handleContent)
      .input('closeStatus', sql.NVarChar(20), closeStatus).query(`
        INSERT INTO feedback_close_list (handler_id, handler_role, feedback_id, handle_content, close_status)
        VALUES (@handlerId, @handlerRole, @feedbackId, @handleContent, @closeStatus)
      `)

    await logOperation(
      req.user!.userId,
      req.user!.role,
      'feedback.handle',
      'FEEDBACK_HANDLE',
      feedbackId ? String(feedbackId) : null,
      `closeStatus=${closeStatus}`,
      'success',
      getClientIp(req)
    )

    res.status(200).json({ code: 0, message: '反馈闭环记录已写入' })
  } catch (error) {
    await logOperation(
      req.user!.userId,
      req.user!.role,
      'feedback.handle',
      'FEEDBACK_HANDLE',
      null,
      '反馈闭环记录失败',
      'failed',
      getClientIp(req)
    )
    res.status(500).json({ code: 500, message: '反馈闭环记录失败' })
  }
}
