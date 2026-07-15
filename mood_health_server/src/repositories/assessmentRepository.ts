import { RowDataPacket } from 'mysql2'
import { getMysqlPool } from '../config/mysql'

export interface AssessmentDatabase {
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

  return {
    listQuestionnaires,
    getQuestionnaireById,
    listQuestionsByQuestionnaireId,
  }
}

export type AssessmentRepository = ReturnType<typeof createAssessmentRepository>
