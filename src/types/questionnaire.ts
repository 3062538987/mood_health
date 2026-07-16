/**
 * 问卷接口
 * @interface Questionnaire
 * @property {number} id - 问卷ID
 * @property {string} title - 问卷标题
 * @property {string} description - 问卷描述
 * @property {Question[]} [questions] - 问题列表（可选）
 * @property {string} createdAt - 创建时间
 */
export interface Questionnaire {
  /** 问卷ID */
  id: number
  /** 问卷标题 */
  title: string
  /** 问卷描述 */
  description: string
  /** 问题列表（可选） */
  questions?: Question[]
  /** 创建时间 */
  createdAt: string
}

/**
 * 问题接口
 * @interface Question
 * @property {number} id - 问题ID
 * @property {number} questionnaire_id - 问卷ID
 * @property {string} question_text - 问题文本
 * @property {string[]} options - 选项列表
 */
export interface Question {
  /** 问题ID */
  id: number
  /** 问卷ID */
  questionnaire_id: number
  /** 问题文本 */
  question_text: string
  /** 选项列表 */
  options: string[]
}

/**
 * 答案接口
 * @interface Answer
 * @property {number} question_id - 问题ID
 * @property {string} answer - 答案
 */
export interface Answer {
  /** 问题ID */
  question_id: number
  /** 答案 */
  answer: string
}

/**
 * 提交问卷数据接口
 * @interface SubmitData
 * @property {number} questionnaire_id - 问卷ID
 * @property {Answer[]} answers - 答案列表
 */
export interface SubmitData {
  /** 问卷ID */
  questionnaire_id: number
  /** 答案列表 */
  answers: Answer[]
}

/**
 * 问卷历史记录接口
 * @interface QuestionnaireHistory
 * @property {number} id - 历史记录ID
 * @property {number} questionnaireId - 问卷ID
 * @property {string} title - 问卷标题
 * @property {string} submittedAt - 提交时间
 */
export interface QuestionnaireHistory {
  /** 历史记录ID */
  id: number
  /** 问卷ID */
  questionnaireId: number
  /** 问卷标题 */
  title: string
  /** 提交时间 */
  submittedAt: string
}
