import { ResultSetHeader, RowDataPacket } from 'mysql2'
import { getMysqlPool } from '../config/mysql'
import { MysqlExecutor } from './userRepository'

export type PromptCategory = 'assessment_interpretation' | 'mood_report' | 'counseling' | 'recommendation'

export interface PromptTemplateRow extends RowDataPacket {
  id: number
  name: string
  category: PromptCategory
  system_prompt: string
  user_prompt_template: string
  variables: string | Record<string, string> | null
  model: string
  temperature: number
  max_tokens: number
  is_active: number
  sort_order: number
  created_at: string
  updated_at: string
}

export interface PromptTemplate {
  id: number
  name: string
  category: PromptCategory
  systemPrompt: string
  userPromptTemplate: string
  variables: Record<string, string> | null
  model: string
  temperature: number
  maxTokens: number
  isActive: boolean
  sortOrder: number
  createdAt: string
  updatedAt: string
}

export interface CreatePromptInput {
  name: string
  category: PromptCategory
  systemPrompt: string
  userPromptTemplate: string
  variables?: Record<string, string>
  model?: string
  temperature?: number
  maxTokens?: number
  sortOrder?: number
}

export interface UpdatePromptInput {
  name?: string
  category?: PromptCategory
  systemPrompt?: string
  userPromptTemplate?: string
  variables?: Record<string, string>
  model?: string
  temperature?: number
  maxTokens?: number
  isActive?: boolean
  sortOrder?: number
}

const parseVariables = (variables: PromptTemplateRow['variables']) => {
  if (!variables) {
    return null
  }

  if (typeof variables === 'object') {
    return variables
  }

  return JSON.parse(variables) as Record<string, string>
}

const mapRow = (row: PromptTemplateRow): PromptTemplate => ({
  id: row.id,
  name: row.name,
  category: row.category,
  systemPrompt: row.system_prompt,
  userPromptTemplate: row.user_prompt_template,
  variables: parseVariables(row.variables),
  model: row.model,
  temperature: row.temperature,
  maxTokens: row.max_tokens,
  isActive: row.is_active === 1,
  sortOrder: row.sort_order,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
})

export const createPromptRepository = (db: MysqlExecutor = getMysqlPool()) => {
  const findAll = async (): Promise<PromptTemplate[]> => {
    const [rows] = await db.query<PromptTemplateRow[]>(
      'SELECT * FROM prompt_templates ORDER BY sort_order ASC, id ASC'
    )
    return rows.map(mapRow)
  }

  const findById = async (id: number): Promise<PromptTemplate | null> => {
    const [rows] = await db.query<PromptTemplateRow[]>(
      'SELECT * FROM prompt_templates WHERE id = ? LIMIT 1',
      [id]
    )
    return rows.length > 0 ? mapRow(rows[0]) : null
  }

  const findByCategory = async (category: PromptCategory): Promise<PromptTemplate[]> => {
    const [rows] = await db.query<PromptTemplateRow[]>(
      'SELECT * FROM prompt_templates WHERE category = ? ORDER BY sort_order ASC',
      [category]
    )
    return rows.map(mapRow)
  }

  const findActiveByCategory = async (category: PromptCategory): Promise<PromptTemplate[]> => {
    const [rows] = await db.query<PromptTemplateRow[]>(
      'SELECT * FROM prompt_templates WHERE category = ? AND is_active = 1 ORDER BY sort_order ASC',
      [category]
    )
    return rows.map(mapRow)
  }

  const create = async (input: CreatePromptInput): Promise<PromptTemplate> => {
    const [result] = await db.query<ResultSetHeader>(
      `INSERT INTO prompt_templates (name, category, system_prompt, user_prompt_template, variables, model, temperature, max_tokens, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        input.name,
        input.category,
        input.systemPrompt,
        input.userPromptTemplate,
        input.variables ? JSON.stringify(input.variables) : null,
        input.model || 'deepseek-chat',
        input.temperature ?? 0.7,
        input.maxTokens ?? 2048,
        input.sortOrder ?? 0,
      ]
    )
    const template = await findById(result.insertId)
    if (!template) throw new Error('创建 Prompt 模板后查询失败')
    return template
  }

  const update = async (id: number, input: UpdatePromptInput): Promise<PromptTemplate | null> => {
    const sets: string[] = []
    const params: unknown[] = []

    if (input.name !== undefined) { sets.push('name = ?'); params.push(input.name) }
    if (input.category !== undefined) { sets.push('category = ?'); params.push(input.category) }
    if (input.systemPrompt !== undefined) { sets.push('system_prompt = ?'); params.push(input.systemPrompt) }
    if (input.userPromptTemplate !== undefined) { sets.push('user_prompt_template = ?'); params.push(input.userPromptTemplate) }
    if (input.variables !== undefined) { sets.push('variables = ?'); params.push(JSON.stringify(input.variables)) }
    if (input.model !== undefined) { sets.push('model = ?'); params.push(input.model) }
    if (input.temperature !== undefined) { sets.push('temperature = ?'); params.push(input.temperature) }
    if (input.maxTokens !== undefined) { sets.push('max_tokens = ?'); params.push(input.maxTokens) }
    if (input.isActive !== undefined) { sets.push('is_active = ?'); params.push(input.isActive ? 1 : 0) }
    if (input.sortOrder !== undefined) { sets.push('sort_order = ?'); params.push(input.sortOrder) }

    if (sets.length === 0) return findById(id)

    params.push(id)
    const [result] = await db.query<ResultSetHeader>(
      `UPDATE prompt_templates SET ${sets.join(', ')} WHERE id = ?`,
      params
    )
    if (result.affectedRows === 0) return null
    return findById(id)
  }

  const remove = async (id: number): Promise<boolean> => {
    const [result] = await db.query<ResultSetHeader>(
      'DELETE FROM prompt_templates WHERE id = ?',
      [id]
    )
    return result.affectedRows > 0
  }

  return { findAll, findById, findByCategory, findActiveByCategory, create, update, remove }
}

export type PromptRepository = ReturnType<typeof createPromptRepository>
