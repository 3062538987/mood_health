import { Response } from 'express'
import sql from 'mssql'
import pool from '../config/database'
import { isSqliteClient } from '../config/database'
import { sqliteAll, sqliteRun } from '../config/sqlite'
import type { AuthRequest } from '../middleware/auth'
import { logOperation } from '../utils/operationLogger'
import { decryptField } from '../utils/encryption'
import { deleteUserById, findUserById, isValidUserRole, updateUserRole } from '../models/userModel'

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
  note: string
  trigger: string
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

export const adminUsersListHandler = async (req: AuthRequest, res: Response) => {
  try {
    let users: AdminUserItem[] = []

    if (isSqliteClient) {
      const rows = sqliteAll(
        `
        SELECT id, username, email, role, created_at
        FROM users
        ORDER BY id DESC
        `
      ) as Array<{
        id: number
        username: string
        email: string
        role: string
        created_at: string
      }>

      users = rows.map((row) => ({
        id: Number(row.id),
        username: String(row.username),
        email: String(row.email),
        role: isValidUserRole(row.role) ? row.role : 'user',
        createdAt: String(row.created_at || ''),
      }))
    } else {
      const result = await pool.request().query(`
        SELECT id, username, email, role, created_at
        FROM users
        ORDER BY id DESC
      `)

      users = (result.recordset || []).map((row: any) => ({
        id: Number(row.id),
        username: String(row.username),
        email: String(row.email),
        role: isValidUserRole(row.role) ? row.role : 'user',
        createdAt: row.created_at ? new Date(row.created_at).toISOString() : '',
      }))
    }

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

    return res.status(200).json({ code: 0, data: { list: users } })
  } catch (error) {
    return res.status(500).json({ code: 500, message: '获取用户列表失败' })
  }
}

export const adminUsersUpdateRoleHandler = async (req: AuthRequest, res: Response) => {
  try {
    const { userId, targetRole } = req.body

    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(400).json({ code: 400, message: 'userId 必须是正整数' })
    }

    if (!isValidUserRole(targetRole)) {
      return res
        .status(400)
        .json({ code: 400, message: 'targetRole 非法，仅支持 user/admin/super_admin' })
    }

    const updateResult = await updateUserRole(userId, targetRole)

    if ((updateResult.rowsAffected?.[0] || 0) === 0) {
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

      return res.status(404).json({ code: 404, message: '目标用户不存在' })
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

    return res.status(200).json({ code: 0, message: '用户角色更新成功' })
  } catch (error) {
    return res.status(500).json({ code: 500, message: '更新用户角色失败' })
  }
}

export const adminUsersDeleteHandler = async (req: AuthRequest, res: Response) => {
  try {
    const userId = Number(req.params.id)

    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(400).json({ code: 400, message: 'userId 必须是正整数' })
    }

    if (req.user?.userId === userId) {
      return res.status(400).json({ code: 400, message: '不能删除当前登录用户' })
    }

    const targetUser = await findUserById(userId)
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

      return res.status(404).json({ code: 404, message: '目标用户不存在' })
    }

    if (targetUser.role === 'super_admin') {
      return res.status(403).json({ code: 403, message: '不能删除超级管理员' })
    }

    const deleteResult = await deleteUserById(userId)

    if ((deleteResult.rowsAffected?.[0] || 0) === 0) {
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

      return res.status(404).json({ code: 404, message: '目标用户不存在' })
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

    return res.status(200).json({ code: 0, message: '用户删除成功' })
  } catch (error) {
    return res.status(500).json({ code: 500, message: '删除用户失败' })
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

    if (isSqliteClient) {
      sqliteRun(
        `
          INSERT INTO incident_fix_list (fixer_id, fixer_role, issue_description, fix_content, result)
          VALUES (?, ?, ?, ?, ?)
        `,
        [req.user!.userId, req.user!.role, issueDescription, fixContent, result]
      )
    } else {
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
    }

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

    if (isSqliteClient) {
      sqliteRun(
        `
          INSERT INTO feedback_close_list (handler_id, handler_role, feedback_id, handle_content, close_status)
          VALUES (?, ?, ?, ?, ?)
        `,
        [req.user!.userId, req.user!.role, String(feedbackId || ''), handleContent, closeStatus]
      )
    } else {
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
    }

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

export const adminMoodsListHandler = async (req: AuthRequest, res: Response) => {
  try {
    const { page, pageSize, userId, username, startDate, endDate, moodType } =
      parseAdminMoodListQuery(req)
    const offset = (page - 1) * pageSize

    let list: AdminMoodRecordItem[] = []
    let total = 0

    if (isSqliteClient) {
      const conditions: string[] = []
      const params: Array<string | number> = []

      if (userId) {
        conditions.push('m.user_id = ?')
        params.push(userId)
      }
      if (username) {
        conditions.push('u.username LIKE ?')
        params.push(`%${username}%`)
      }
      if (startDate) {
        conditions.push('date(m.record_date) >= date(?)')
        params.push(startDate)
      }
      if (endDate) {
        conditions.push('date(m.record_date) <= date(?)')
        params.push(endDate)
      }
      if (moodType) {
        conditions.push('(m.mood_type LIKE ? OR et.name LIKE ?)')
        params.push(`%${moodType}%`, `%${moodType}%`)
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

      const countRows = sqliteAll(
        `
          SELECT COUNT(DISTINCT m.id) as total
          FROM moods m
          JOIN users u ON u.id = m.user_id
          LEFT JOIN mood_emotions me ON me.mood_id = m.id
          LEFT JOIN emotion_types et ON et.id = me.emotion_type_id
          ${whereClause}
        `,
        params
      ) as Array<{ total: number }>

      total = Number(countRows[0]?.total || 0)

      const rows = sqliteAll(
        `
          SELECT
            m.id,
            m.user_id as userId,
            u.username,
            m.mood_type as moodTypeRaw,
            m.intensity,
            COALESCE(m.note_encrypted, '') as note,
            COALESCE(m.trigger, '') as trigger,
            m.created_at as createdAt,
            GROUP_CONCAT(DISTINCT et.name) as relationMoodTypes
          FROM moods m
          JOIN users u ON u.id = m.user_id
          LEFT JOIN mood_emotions me ON me.mood_id = m.id
          LEFT JOIN emotion_types et ON et.id = me.emotion_type_id
          ${whereClause}
          GROUP BY m.id, m.user_id, u.username, m.mood_type, m.intensity, m.note_encrypted, m.trigger, m.created_at
          ORDER BY m.created_at DESC
          LIMIT ? OFFSET ?
        `,
        [...params, pageSize, offset]
      ) as Array<{
        id: number
        userId: number
        username: string
        moodTypeRaw: string
        relationMoodTypes?: string
        intensity: number
        note: string
        trigger: string
        createdAt: string
      }>

      list = rows.map((row) => {
        const relationMoodTypes = row.relationMoodTypes
          ? String(row.relationMoodTypes)
              .split(',')
              .map((item) => item.trim())
              .filter(Boolean)
          : []
        const fallbackMoodTypes = row.moodTypeRaw
          ? String(row.moodTypeRaw)
              .split(',')
              .map((item) => item.trim())
              .filter(Boolean)
          : []

        return {
          id: Number(row.id),
          userId: Number(row.userId),
          username: String(row.username || ''),
          moodType: relationMoodTypes.length > 0 ? relationMoodTypes : fallbackMoodTypes,
          intensity: Number(row.intensity || 0),
          note: decryptField(String(row.note || '')) || '',
          trigger: String(row.trigger || ''),
          createdAt: String(row.createdAt || ''),
        }
      })
    } else {
      const countRequest = pool.request()
      const listRequest = pool.request()
      const conditions: string[] = []

      if (userId) {
        conditions.push('m.user_id = @userId')
        countRequest.input('userId', sql.Int, userId)
        listRequest.input('userId', sql.Int, userId)
      }
      if (username) {
        conditions.push('u.username LIKE @username')
        countRequest.input('username', sql.NVarChar(100), `%${username}%`)
        listRequest.input('username', sql.NVarChar(100), `%${username}%`)
      }
      if (startDate) {
        conditions.push('CONVERT(date, m.record_date) >= @startDate')
        countRequest.input('startDate', sql.Date, startDate)
        listRequest.input('startDate', sql.Date, startDate)
      }
      if (endDate) {
        conditions.push('CONVERT(date, m.record_date) <= @endDate')
        countRequest.input('endDate', sql.Date, endDate)
        listRequest.input('endDate', sql.Date, endDate)
      }
      if (moodType) {
        conditions.push('(m.mood_type LIKE @moodType OR et.name LIKE @moodType)')
        countRequest.input('moodType', sql.NVarChar(100), `%${moodType}%`)
        listRequest.input('moodType', sql.NVarChar(100), `%${moodType}%`)
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

      const countResult = await countRequest.query(`
        SELECT COUNT(DISTINCT m.id) as total
        FROM moods m
        JOIN users u ON u.id = m.user_id
        LEFT JOIN mood_emotions me ON me.mood_id = m.id
        LEFT JOIN emotion_types et ON et.id = me.emotion_type_id
        ${whereClause}
      `)
      total = Number(countResult.recordset[0]?.total || 0)

      listRequest.input('offset', sql.Int, offset)
      listRequest.input('pageSize', sql.Int, pageSize)
      const listResult = await listRequest.query(`
        SELECT
          m.id,
          m.user_id as userId,
          u.username,
          m.mood_type as moodTypeRaw,
          m.intensity,
          m.note_encrypted as note,
          m.trigger as trigger,
          m.created_at as createdAt,
          STRING_AGG(et.name, ',') as relationMoodTypes
        FROM moods m
        JOIN users u ON u.id = m.user_id
        LEFT JOIN mood_emotions me ON me.mood_id = m.id
        LEFT JOIN emotion_types et ON et.id = me.emotion_type_id
        ${whereClause}
        GROUP BY m.id, m.user_id, u.username, m.mood_type, m.intensity, m.note_encrypted, m.trigger, m.created_at
        ORDER BY m.created_at DESC
        OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY
      `)

      list = (listResult.recordset || []).map((row: any) => {
        const relationMoodTypes = row.relationMoodTypes
          ? String(row.relationMoodTypes)
              .split(',')
              .map((item: string) => item.trim())
              .filter(Boolean)
          : []
        const fallbackMoodTypes = row.moodTypeRaw
          ? String(row.moodTypeRaw)
              .split(',')
              .map((item: string) => item.trim())
              .filter(Boolean)
          : []

        return {
          id: Number(row.id),
          userId: Number(row.userId),
          username: String(row.username || ''),
          moodType: relationMoodTypes.length > 0 ? relationMoodTypes : fallbackMoodTypes,
          intensity: Number(row.intensity || 0),
          note: decryptField(String(row.note || '')) || '',
          trigger: String(row.trigger || ''),
          createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : '',
        }
      })
    }

    return res.status(200).json({
      code: 0,
      data: {
        list,
        total,
        page,
        pageSize,
      },
    })
  } catch (error) {
    return res.status(500).json({ code: 500, message: '获取情绪记录失败' })
  }
}
