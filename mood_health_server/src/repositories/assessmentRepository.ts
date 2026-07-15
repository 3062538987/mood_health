import { ResultSetHeader, RowDataPacket } from 'mysql2'
import { getMysqlPool } from '../config/mysql'

export interface AssessmentDatabase {
  getConnection(): Promise<AssessmentConnection>
  query<T>(sql: string, params?: unknown[]): Promise<[T, unknown]>
}

export interface AssessmentConnection {
  beginTransaction(): Promise<void>
  commit(): Promise<void>
  rollback(): Promise<void>
  release(): void
  query<T>(sql: string, params?: unknown[]): Promise<[T, unknown]>
}

export interface QuestionnaireDto {
  id: number
  title: string
  description: string
  type: string
  created_at: Date | string
}

export interface QuestionDto {
  id: number
  questionnaire_id: number
  question_text: string
  question_type: string
  options: string
  sort_order: number
  is_reverse: boolean
}

export interface UserAssessmentHistoryDto {
  id: number
  user_id: number
  questionnaire_id: number
  score: number
  result_text: string
  created_at: Date | string
  title: string
  type: string
}

export interface SubmittedAssessmentAnswerInput {
  itemId: number
  value: number
  score: number
}

export interface CreateSubmittedAssessmentSessionInput {
  userId: number
  questionnaireId: number
  score: number
  riskLevel: string
  resultText: string
  answers: SubmittedAssessmentAnswerInput[]
  submittedAt: Date
}

type QuestionnaireRow = RowDataPacket & {
  id: number
  title: string
  description: string | null
  type: string
  created_at: Date | string
}

type QuestionRow = RowDataPacket & {
  id: number
  questionnaire_id: number
  question_text: string
  question_type: string
  options: string
  sort_order: number
  is_reverse: number | boolean
}

type UserAssessmentHistoryRow = RowDataPacket & {
  id: number
  user_id: number
  questionnaire_id: number
  score: number | string
  result_text: string | null
  created_at: Date | string
  title: string
  type: string
}

const mapQuestionnaire = (row: QuestionnaireRow): QuestionnaireDto => ({
  id: row.id,
  title: row.title,
  description: row.description ?? '',
  type: row.type,
  created_at: row.created_at,
})

const mapQuestion = (row: QuestionRow): QuestionDto => ({
  id: row.id,
  questionnaire_id: row.questionnaire_id,
  question_text: row.question_text,
  question_type: row.question_type,
  options: row.options,
  sort_order: row.sort_order,
  is_reverse: Boolean(row.is_reverse),
})

const mapUserAssessmentHistory = (row: UserAssessmentHistoryRow): UserAssessmentHistoryDto => ({
  id: row.id,
  user_id: row.user_id,
  questionnaire_id: row.questionnaire_id,
  score: Number(row.score),
  result_text: row.result_text ?? '',
  created_at: row.created_at,
  title: row.title,
  type: row.type,
})

export const createAssessmentRepository = (db: AssessmentDatabase = getMysqlPool()) => {
  const questionnaireSelect = `
    SELECT
      av.id AS id,
      ai.name AS title,
      ai.description AS description,
      ai.code AS type,
      av.created_at AS created_at
    FROM assessment_versions av
    INNER JOIN assessment_instruments ai ON ai.id = av.instrument_id
    WHERE ai.status = 'active'
      AND av.status = 'active'
  `

  const listQuestionnaires = async (): Promise<QuestionnaireDto[]> => {
    const [rows] = await db.query<QuestionnaireRow[]>(
      `${questionnaireSelect}
       ORDER BY ai.id ASC, av.id ASC`
    )
    return rows.map(mapQuestionnaire)
  }

  const getQuestionnaireById = async (id: number): Promise<QuestionnaireDto | null> => {
    const [rows] = await db.query<QuestionnaireRow[]>(
      `${questionnaireSelect}
       AND av.id = ?
       LIMIT 1`,
      [id]
    )
    return rows[0] ? mapQuestionnaire(rows[0]) : null
  }

  const listQuestionsByQuestionnaireId = async (questionnaireId: number): Promise<QuestionDto[]> => {
    const [rows] = await db.query<QuestionRow[]>(
      `
        SELECT
          ai.id AS id,
          ai.assessment_version_id AS questionnaire_id,
          ai.item_text AS question_text,
          ai.item_type AS question_type,
          CAST(ai.options_json AS CHAR) AS options,
          ai.item_order AS sort_order,
          ai.reverse_scored AS is_reverse
        FROM assessment_items ai
        INNER JOIN assessment_versions av ON av.id = ai.assessment_version_id
        INNER JOIN assessment_instruments instrument ON instrument.id = av.instrument_id
        WHERE ai.assessment_version_id = ?
          AND av.status = 'active'
          AND instrument.status = 'active'
        ORDER BY ai.item_order ASC, ai.id ASC
      `,
      [questionnaireId]
    )
    return rows.map(mapQuestion)
  }

  const createSubmittedSession = async (input: CreateSubmittedAssessmentSessionInput): Promise<number> => {
    const connection = await db.getConnection()

    try {
      await connection.beginTransaction()
      const [sessionResult] = await connection.query<ResultSetHeader>(
        `
          INSERT INTO assessment_sessions (
            user_id,
            assessment_version_id,
            raw_score,
            screening_level,
            result_summary_json,
            status,
            started_at,
            submitted_at,
            created_at,
            updated_at
          )
          VALUES (?, ?, ?, ?, ?, 'submitted', ?, ?, ?, ?)
        `,
        [
          input.userId,
          input.questionnaireId,
          input.score,
          input.riskLevel,
          JSON.stringify({ result_text: input.resultText }),
          input.submittedAt,
          input.submittedAt,
          input.submittedAt,
          input.submittedAt,
        ]
      )
      const sessionId = sessionResult.insertId

      for (const answer of input.answers) {
        await connection.query<ResultSetHeader>(
          `
            INSERT INTO assessment_answers (
              session_id,
              item_id,
              answer_value_json,
              score,
              created_at
            )
            VALUES (?, ?, ?, ?, ?)
          `,
          [sessionId, answer.itemId, JSON.stringify(answer.value), answer.score, input.submittedAt]
        )
      }

      await connection.commit()
      return sessionId
    } catch (error) {
      await connection.rollback()
      throw error
    } finally {
      connection.release()
    }
  }

  const listUserAssessmentHistory = async (userId: number): Promise<UserAssessmentHistoryDto[]> => {
    const [rows] = await db.query<UserAssessmentHistoryRow[]>(
      `
        SELECT
          s.id AS id,
          s.user_id AS user_id,
          s.assessment_version_id AS questionnaire_id,
          s.raw_score AS score,
          JSON_UNQUOTE(JSON_EXTRACT(s.result_summary_json, '$.result_text')) AS result_text,
          s.created_at AS created_at,
          i.name AS title,
          i.code AS type
        FROM assessment_sessions s
        INNER JOIN assessment_versions v ON v.id = s.assessment_version_id
        INNER JOIN assessment_instruments i ON i.id = v.instrument_id
        WHERE s.user_id = ?
          AND s.status = 'submitted'
        ORDER BY s.created_at DESC, s.id DESC
      `,
      [userId]
    )
    return rows.map(mapUserAssessmentHistory)
  }

  return {
    listQuestionnaires,
    getQuestionnaireById,
    listQuestionsByQuestionnaireId,
    createSubmittedSession,
    listUserAssessmentHistory,
  }
}

export type AssessmentRepository = ReturnType<typeof createAssessmentRepository>
