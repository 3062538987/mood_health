import { ResultSetHeader, RowDataPacket } from 'mysql2'
import { getMysqlPool } from '../config/mysql'

export interface CaseDatabase {
  getConnection(): Promise<CaseConnection>
  query<T>(sql: string, params?: unknown[]): Promise<[T, unknown]>
}

export interface CaseConnection {
  beginTransaction(): Promise<void>
  commit(): Promise<void>
  rollback(): Promise<void>
  release(): void
  query<T>(sql: string, params?: unknown[]): Promise<[T, unknown]>
}

export type CaseStatus = 'open' | 'assigned' | 'in_progress' | 'referred' | 'closed'
export type InterventionType = 'note' | 'interview' | 'referral' | 'closure'

export interface CaseDto {
  id: number
  studentUserId: number
  assignedCounselorId: number | null
  sourceSessionId: number | null
  origin?: string | null
  status: CaseStatus
  riskLevel: string | null
  summary: string | null
  triggerReasons?: string[]
  createdAt: string
  updatedAt: string
}

export interface CaseInterventionDto {
  id: number
  caseId: number
  counselorUserId: number
  interventionType: InterventionType
  content: string
  referralTarget: string | null
  referralReason: string | null
  closureSummary: string | null
  createdAt: string
}

export interface CreateCaseInput {
  studentUserId: number
  sourceSessionId?: number | null
  riskLevel?: string | null
  summary?: string | null
}

export interface CreateInterventionInput {
  caseId: number
  counselorUserId: number
  interventionType: InterventionType
  content: string
  referralTarget?: string | null
  referralReason?: string | null
  closureSummary?: string | null
}

type CaseRow = RowDataPacket & {
  id: number
  student_user_id: number
  assigned_counselor_id: number | null
  source_session_id: number | null
  origin?: string | null
  status: string
  risk_level: string | null
  summary: string | null
  trigger_reasons_json?: string | string[] | null
  created_at: Date | string
  updated_at: Date | string
}

type CaseInterventionRow = RowDataPacket & {
  id: number
  case_id: number
  counselor_user_id: number
  intervention_type: string
  content: string
  referral_target: string | null
  referral_reason: string | null
  closure_summary: string | null
  created_at: Date | string
}

const toIsoString = (value: Date | string): string =>
  value instanceof Date ? value.toISOString() : String(value)

const mapCase = (row: CaseRow): CaseDto => ({
  id: row.id,
  studentUserId: row.student_user_id,
  assignedCounselorId: row.assigned_counselor_id,
  sourceSessionId: row.source_session_id,
  origin: row.origin ?? null,
  status: row.status as CaseStatus,
  riskLevel: row.risk_level,
  summary: row.summary,
  triggerReasons: (() => {
    if (Array.isArray(row.trigger_reasons_json)) return row.trigger_reasons_json.map(String)
    if (typeof row.trigger_reasons_json !== 'string') return []
    try {
      const value = JSON.parse(row.trigger_reasons_json)
      return Array.isArray(value) ? value.map(String) : []
    } catch {
      return []
    }
  })(),
  createdAt: toIsoString(row.created_at),
  updatedAt: toIsoString(row.updated_at),
})

const mapIntervention = (row: CaseInterventionRow): CaseInterventionDto => ({
  id: row.id,
  caseId: row.case_id,
  counselorUserId: row.counselor_user_id,
  interventionType: row.intervention_type as InterventionType,
  content: row.content,
  referralTarget: row.referral_target,
  referralReason: row.referral_reason,
  closureSummary: row.closure_summary,
  createdAt: toIsoString(row.created_at),
})

export const createCaseRepository = (db: CaseDatabase = getMysqlPool()) => {
  const createCase = async (input: CreateCaseInput): Promise<CaseDto> => {
    const now = new Date().toISOString().slice(0, 23).replace('T', ' ')
    const [result] = await db.query<ResultSetHeader>(
      `INSERT INTO cases (student_user_id, source_session_id, risk_level, summary, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'open', ?, ?)`,
      [input.studentUserId, input.sourceSessionId ?? null, input.riskLevel ?? null, input.summary ?? null, now, now]
    )
    return {
      id: result.insertId,
      studentUserId: input.studentUserId,
      assignedCounselorId: null,
      sourceSessionId: input.sourceSessionId ?? null,
      origin: null,
      status: 'open',
      riskLevel: input.riskLevel ?? null,
      summary: input.summary ?? null,
      triggerReasons: [],
      createdAt: now,
      updatedAt: now,
    }
  }

  const findById = async (id: number): Promise<CaseDto | null> => {
    const [rows] = await db.query<CaseRow[]>(
      'SELECT * FROM cases WHERE id = ? LIMIT 1',
      [id]
    )
    return rows[0] ? mapCase(rows[0]) : null
  }

  const findAll = async (): Promise<CaseDto[]> => {
    const [rows] = await db.query<CaseRow[]>('SELECT * FROM cases ORDER BY created_at DESC')
    return rows.map(mapCase)
  }

  const findByStudentId = async (studentUserId: number, status?: CaseStatus): Promise<CaseDto[]> => {
    const params: unknown[] = [studentUserId]
    let sql = 'SELECT * FROM cases WHERE student_user_id = ?'
    if (status) {
      sql += ' AND status = ?'
      params.push(status)
    }
    sql += ' ORDER BY created_at DESC'
    const [rows] = await db.query<CaseRow[]>(sql, params)
    return rows.map(mapCase)
  }

  const findByCounselorId = async (counselorId: number, status?: CaseStatus): Promise<CaseDto[]> => {
    const params: unknown[] = [counselorId]
    let sql = 'SELECT * FROM cases WHERE assigned_counselor_id = ?'
    if (status) {
      sql += ' AND status = ?'
      params.push(status)
    }
    sql += ' ORDER BY created_at DESC'
    const [rows] = await db.query<CaseRow[]>(sql, params)
    return rows.map(mapCase)
  }

  const findByStatus = async (status: CaseStatus): Promise<CaseDto[]> => {
    const [rows] = await db.query<CaseRow[]>(
      'SELECT * FROM cases WHERE status = ? ORDER BY created_at DESC',
      [status]
    )
    return rows.map(mapCase)
  }

  const assignCounselor = async (caseId: number, counselorId: number): Promise<boolean> => {
    const now = new Date().toISOString().slice(0, 23).replace('T', ' ')
    const [result] = await db.query<ResultSetHeader>(
      `UPDATE cases
       SET assigned_counselor_id = ?, status = 'assigned', updated_at = ?
       WHERE id = ? AND status = 'open'`,
      [counselorId, now, caseId]
    )
    return result.affectedRows > 0
  }

  const updateStatus = async (caseId: number, status: CaseStatus): Promise<boolean> => {
    const now = new Date().toISOString().slice(0, 23).replace('T', ' ')
    const [result] = await db.query<ResultSetHeader>(
      'UPDATE cases SET status = ?, updated_at = ? WHERE id = ?',
      [status, now, caseId]
    )
    return result.affectedRows > 0
  }

  const createIntervention = async (input: CreateInterventionInput): Promise<CaseInterventionDto> => {
    const now = new Date().toISOString().slice(0, 23).replace('T', ' ')
    const [result] = await db.query<ResultSetHeader>(
      `INSERT INTO case_interventions (case_id, counselor_user_id, intervention_type, content, referral_target, referral_reason, closure_summary, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        input.caseId,
        input.counselorUserId,
        input.interventionType,
        input.content,
        input.referralTarget ?? null,
        input.referralReason ?? null,
        input.closureSummary ?? null,
        now,
      ]
    )
    return {
      id: result.insertId,
      caseId: input.caseId,
      counselorUserId: input.counselorUserId,
      interventionType: input.interventionType,
      content: input.content,
      referralTarget: input.referralTarget ?? null,
      referralReason: input.referralReason ?? null,
      closureSummary: input.closureSummary ?? null,
      createdAt: now,
    }
  }

  const listInterventionsByCaseId = async (caseId: number): Promise<CaseInterventionDto[]> => {
    const [rows] = await db.query<CaseInterventionRow[]>(
      'SELECT * FROM case_interventions WHERE case_id = ? ORDER BY created_at ASC',
      [caseId]
    )
    return rows.map(mapIntervention)
  }

  return {
    createCase,
    findById,
    findAll,
    findByStudentId,
    findByCounselorId,
    findByStatus,
    assignCounselor,
    updateStatus,
    createIntervention,
    listInterventionsByCaseId,
  }
}

export type CaseRepository = ReturnType<typeof createCaseRepository>
