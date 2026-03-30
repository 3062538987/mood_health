import pool, { isSqliteClient } from '../config/database'
import sql from 'mssql'
import { sqliteAll, sqliteGet, sqliteRun } from '../config/sqlite'

/**
 * 量表接口
 * @interface Questionnaire
 * @property {number} id - 量表ID
 * @property {string} title - 量表标题
 * @property {string} description - 量表描述
 * @property {string} type - 量表类型
 * @property {Date} created_at - 创建时间
 */
export interface Questionnaire {
  id: number
  title: string
  description: string
  type: string
  created_at: Date | string
}

/**
 * 问题接口
 * @interface Question
 * @property {number} id - 问题ID
 * @property {number} questionnaire_id - 所属量表ID
 * @property {string} question_text - 问题文本
 * @property {string} question_type - 问题类型
 * @property {string} options - 选项JSON
 * @property {number} sort_order - 排序顺序
 * @property {boolean} is_reverse - 是否反向计分
 */
export interface Question {
  id: number
  questionnaire_id: number
  question_text: string
  question_type: string
  options: string
  sort_order: number
  is_reverse: boolean
}

/**
 * 用户测评记录接口
 * @interface UserAssessment
 * @property {number} id - 记录ID
 * @property {number} user_id - 用户ID
 * @property {number} questionnaire_id - 量表ID
 * @property {number} score - 得分
 * @property {string} result_text - 结果文本
 * @property {Date} created_at - 创建时间
 */
export interface UserAssessment {
  id: number
  user_id: number
  questionnaire_id: number
  score: number
  result_text: string
  created_at: Date | string
}

const normalizeQuestion = (question: any): Question => ({
  ...question,
  is_reverse: Boolean(question.is_reverse),
})

/**
 * 获取量表列表
 * @returns {Promise<Questionnaire[]>} - 量表列表
 */
export const getQuestionnaires = async (): Promise<Questionnaire[]> => {
  if (isSqliteClient) {
    const result = sqliteAll(
      `
        SELECT * FROM questionnaires
        ORDER BY id ASC
      `
    )
    return result as unknown as Questionnaire[]
  }

  const result = await pool.request().query(`
    SELECT * FROM questionnaires
    ORDER BY id ASC
  `)
  return result.recordset
}

/**
 * 根据ID获取量表
 * @param {number} id - 量表ID
 * @returns {Promise<Questionnaire | null>} - 量表对象或null
 */
export const getQuestionnaireById = async (id: number): Promise<Questionnaire | null> => {
  if (isSqliteClient) {
    const result = sqliteGet(
      `
        SELECT * FROM questionnaires
        WHERE id = ?
        LIMIT 1
      `,
      [id]
    )
    return (result as Questionnaire | undefined) || null
  }

  const result = await pool.request().input('id', sql.Int, id).query(`
      SELECT * FROM questionnaires
      WHERE id = @id
    `)
  return result.recordset.length ? result.recordset[0] : null
}

/**
 * 获取量表的问题列表
 * @param {number} questionnaireId - 量表ID
 * @returns {Promise<Question[]>} - 问题列表
 */
export const getQuestionsByQuestionnaireId = async (
  questionnaireId: number
): Promise<Question[]> => {
  if (isSqliteClient) {
    const result = sqliteAll(
      `
        SELECT * FROM questions
        WHERE questionnaire_id = ?
        ORDER BY sort_order ASC
      `,
      [questionnaireId]
    )
    return (result as any[]).map(normalizeQuestion)
  }

  const result = await pool.request().input('questionnaireId', sql.Int, questionnaireId).query(`
      SELECT * FROM questions
      WHERE questionnaire_id = @questionnaireId
      ORDER BY sort_order ASC
    `)
  return result.recordset.map(normalizeQuestion)
}

/**
 * 创建用户测评记录
 * @param {number} userId - 用户ID
 * @param {number} questionnaireId - 量表ID
 * @param {number} score - 得分
 * @param {string} resultText - 结果文本
 * @returns {Promise<sql.IProcedureResult<any>>} - 数据库操作结果
 */
export const createUserAssessment = async (
  userId: number,
  questionnaireId: number,
  score: number,
  resultText: string
) => {
  if (isSqliteClient) {
    return sqliteRun(
      `
        INSERT INTO user_assessments (user_id, questionnaire_id, score, result_text)
        VALUES (?, ?, ?, ?)
      `,
      [userId, questionnaireId, score, resultText]
    )
  }

  const result = await pool
    .request()
    .input('userId', sql.Int, userId)
    .input('questionnaireId', sql.Int, questionnaireId)
    .input('score', sql.Int, score)
    .input('resultText', sql.NVarChar, resultText).query(`
      INSERT INTO user_assessments (user_id, questionnaire_id, score, result_text)
      VALUES (@userId, @questionnaireId, @score, @resultText)
    `)
  return result
}

/**
 * 获取用户的测评记录
 * @param {number} userId - 用户ID
 * @param {number} questionnaireId - 量表ID
 * @returns {Promise<UserAssessment[]>} - 测评记录列表
 */
export const getUserAssessments = async (
  userId: number,
  questionnaireId?: number
): Promise<UserAssessment[]> => {
  if (isSqliteClient) {
    let sqliteQuery = `
      SELECT * FROM user_assessments
      WHERE user_id = ?
    `
    const params: Array<number> = [userId]

    if (questionnaireId) {
      sqliteQuery += ` AND questionnaire_id = ?`
      params.push(questionnaireId)
    }

    sqliteQuery += ` ORDER BY created_at DESC`

    const result = sqliteAll(sqliteQuery, params)
    return result as unknown as UserAssessment[]
  }

  let query = `
    SELECT * FROM user_assessments
    WHERE user_id = @userId
  `

  if (questionnaireId) {
    query += ' AND questionnaire_id = @questionnaireId'
  }

  query += ' ORDER BY created_at DESC'

  const result = await pool
    .request()
    .input('userId', sql.Int, userId)
    .input('questionnaireId', sql.Int, questionnaireId)
    .query(query)

  return result.recordset
}

/**
 * 获取用户所有问卷历史记录（包含问卷信息）
 * @param {number} userId - 用户 ID
 * @returns {Promise<any[]>} - 历史记录列表
 */
export const getUserAssessmentHistory = async (userId: number): Promise<any[]> => {
  if (isSqliteClient) {
    const result = sqliteAll(
      `
        SELECT 
          ua.id,
          ua.user_id,
          ua.questionnaire_id,
          ua.score,
          ua.result_text,
          ua.created_at,
          q.title,
          q.type
        FROM user_assessments ua
        INNER JOIN questionnaires q ON ua.questionnaire_id = q.id
        WHERE ua.user_id = ?
        ORDER BY ua.created_at DESC
      `,
      [userId]
    )

    return result
  }

  const query = `
    SELECT 
      ua.id,
      ua.user_id,
      ua.questionnaire_id,
      ua.score,
      ua.result_text,
      ua.created_at,
      q.title,
      q.type
    FROM user_assessments ua
    INNER JOIN questionnaires q ON ua.questionnaire_id = q.id
    WHERE ua.user_id = @userId
    ORDER BY ua.created_at DESC
  `

  const result = await pool.request().input('userId', sql.Int, userId).query(query)

  return result.recordset
}
