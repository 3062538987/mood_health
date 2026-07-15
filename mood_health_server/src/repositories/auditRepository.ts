import { ResultSetHeader } from 'mysql2'
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

  return {
    record,
  }
}

export type AuditRepository = ReturnType<typeof createAuditRepository>
