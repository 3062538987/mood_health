import { Response } from 'express'
import type { AuthRequest } from '../middleware/auth'
import { createAuditService } from '../services/auditService'
import { apiFailure, apiSuccess } from '../utils/apiResponse'

const auditService = createAuditService()

const optionalQueryString = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim() ? value.trim() : undefined

/** super_admin 查询操作审计日志。 */
export const getOperationLogsHandler = async (req: AuthRequest, res: Response) => {
  try {
    const page = Math.max(parseInt(String(req.query.page || '1'), 10) || 1, 1)
    const pageSize = Math.min(
      Math.max(parseInt(String(req.query.pageSize || '20'), 10) || 20, 1),
      100
    )
    const result = await auditService.list({
      role: optionalQueryString(req.query.role),
      permission: optionalQueryString(req.query.permission),
      startTime: optionalQueryString(req.query.startTime),
      endTime: optionalQueryString(req.query.endTime),
      page,
      pageSize,
    })

    return res.status(200).json(
      apiSuccess(
        {
          list: result.list,
          pagination: {
            page: result.page,
            pageSize: result.pageSize,
            total: result.total,
          },
        },
        '获取审计日志成功'
      )
    )
  } catch (error) {
    console.error('查询操作日志失败:', error)
    return res.status(500).json(apiFailure(500, '查询操作日志失败'))
  }
}
