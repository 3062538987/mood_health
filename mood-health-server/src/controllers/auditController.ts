import { Response } from 'express'
import sql from 'mssql'
import pool from '../config/database'
import type { AuthRequest } from '../middleware/auth'

/**
 * super_admin 查询操作审计日志
 * 支持按角色/权限/时间范围筛选
 */
export const getOperationLogsHandler = async (req: AuthRequest, res: Response) => {
  try {
    const { role, permission, startTime, endTime, page = '1', pageSize = '20' } = req.query

    const pageNumber = Math.max(parseInt(page as string, 10) || 1, 1)
    const pageSizeNumber = Math.min(Math.max(parseInt(pageSize as string, 10) || 20, 1), 100)

    const request = pool.request()
    const conditions: string[] = ['1=1']

    if (role) {
      conditions.push('operator_role = @role')
      request.input('role', sql.NVarChar(20), String(role))
    }

    if (permission) {
      conditions.push('permission_code = @permission')
      request.input('permission', sql.NVarChar(100), String(permission))
    }

    if (startTime) {
      conditions.push('operation_time >= @startTime')
      request.input('startTime', sql.DateTime2, new Date(String(startTime)))
    }

    if (endTime) {
      conditions.push('operation_time <= @endTime')
      request.input('endTime', sql.DateTime2, new Date(String(endTime)))
    }

    request.input('offset', sql.Int, (pageNumber - 1) * pageSizeNumber)
    request.input('limit', sql.Int, pageSizeNumber)

    const whereClause = conditions.join(' AND ')

    const result = await request.query(`
      SELECT
        id,
        operator_id,
        operator_role,
        permission_code,
        operation_type,
        target_id,
        content,
        operation_time,
        ip_address,
        operation_result
      FROM operation_logs
      WHERE ${whereClause}
      ORDER BY operation_time DESC
      OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY;

      SELECT COUNT(1) AS total
      FROM operation_logs
      WHERE ${whereClause};
    `)

    const recordsets = result.recordsets as Array<Array<{ [key: string]: any }>>
    const logs = recordsets[0] || []
    const total = recordsets[1]?.[0]?.total || 0

    res.status(200).json({
      code: 0,
      data: {
        list: logs,
        pagination: {
          page: pageNumber,
          pageSize: pageSizeNumber,
          total,
        },
      },
    })
  } catch (error) {
    console.error('查询操作日志失败:', error)
    res.status(500).json({ code: 500, message: '查询操作日志失败' })
  }
}
