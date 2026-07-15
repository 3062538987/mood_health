import { ResultSetHeader, RowDataPacket } from 'mysql2'
import { getMysqlPool } from '../config/mysql'
import { MysqlExecutor } from './userRepository'

export type AuditResult = 'success' | 'failed'

export interface AuditRecordInput {
  actorUserId: number | null
  actorRoleCode: string
  permissionCode: string
  action: string
  targetType: string | null
  targetId: string | null
  result: AuditResult
  summary: string | null
  ipAddress: string | null
  requestId: string | null
}

export interface AuditListOptions {
  role?: string
  permission?: string
  startTime?: string
  endTime?: string
  page: number
  pageSize: number
}

export interface AuditListItem {
  id: number
  operatorId: number | null
  operatorRole: string
  permissionCode: string
  operationType: string
  targetId: string | null
  operationTime: string
  operationResult: string
}

type AuditListRow = RowDataPacket & {
  id: number
  actor_user_id: number | null
  actor_role_code: string
  permission_code: string
  action: string
  target_id: string | null
  result: string
  created_at: Date | string
}

type CountRow = RowDataPacket & {
  total: number
}

const SUMMARY_LIMIT = 1000

const sanitizeSummary = (summary: string | null): string | null => {
  if (!summary) return summary

  return summary
    .replace(/password\s*=\s*\S+/gi, '[redacted]')
    .replace(/token\s*=\s*\S+/gi, '[redacted]')
    .slice(0, SUMMARY_LIMIT)
}

export const createAuditRepository = (db: MysqlExecutor = getMysqlPool()) => {
  const record = async (input: AuditRecordInput): Promise<void> => {
    await db.query<ResultSetHeader>(
      `
      INSERT INTO audit_logs (
        actor_user_id,
        actor_role_code,
        permission_code,
        action,
        target_type,
        target_id,
        result,
        summary,
        ip_address,
        request_id,
        created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, UTC_TIMESTAMP(3))
      `,
      [
        input.actorUserId,
        input.actorRoleCode,
        input.permissionCode,
        input.action,
        input.targetType,
        input.targetId,
        input.result,
        sanitizeSummary(input.summary),
        input.ipAddress,
        input.requestId,
      ]
    )
  }

  const list = async (options: AuditListOptions) => {
    const conditions: string[] = []
    const params: unknown[] = []

    if (options.role) {
      conditions.push('actor_role_code = ?')
      params.push(options.role)
    }
    if (options.permission) {
      conditions.push('permission_code = ?')
      params.push(options.permission)
    }
    if (options.startTime) {
      conditions.push('created_at >= ?')
      params.push(options.startTime)
    }
    if (options.endTime) {
      conditions.push('created_at <= ?')
      params.push(options.endTime)
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
    const offset = (options.page - 1) * options.pageSize
    const [countRows] = await db.query<CountRow[]>(
      `SELECT COUNT(1) AS total FROM audit_logs ${whereClause}`,
      params
    )
    const [rows] = await db.query<AuditListRow[]>(
      `
      SELECT
        id,
        actor_user_id,
        actor_role_code,
        permission_code,
        action,
        target_id,
        result,
        created_at
      FROM audit_logs
      ${whereClause}
      ORDER BY created_at DESC, id DESC
      LIMIT ? OFFSET ?
      `,
      [...params, options.pageSize, offset]
    )

    return {
      list: rows.map(
        (row): AuditListItem => ({
          id: Number(row.id),
          operatorId: row.actor_user_id == null ? null : Number(row.actor_user_id),
          operatorRole: String(row.actor_role_code),
          permissionCode: String(row.permission_code),
          operationType: String(row.action),
          targetId: row.target_id == null ? null : String(row.target_id),
          operationTime:
            row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
          operationResult: String(row.result),
        })
      ),
      total: Number(countRows[0]?.total || 0),
      page: options.page,
      pageSize: options.pageSize,
    }
  }

  return {
    record,
    list,
  }
}

export type AuditRepository = ReturnType<typeof createAuditRepository>
