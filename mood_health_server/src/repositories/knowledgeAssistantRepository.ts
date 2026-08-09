import { getMysqlPool } from '../config/mysql'
import type { RagAnswerResponse, RagSource } from '../services/fastApiClient'

export interface KnowledgeSource extends RagSource {}
export type RagAnswer = RagAnswerResponse
export interface KnowledgeMessage {
  role: 'user' | 'assistant'
  content: string
  sources: KnowledgeSource[]
  createdAt: string
}
export interface KnowledgeSession {
  sessionId: string
  title: string
  lastMessageAt: string
  messageCount: number
}

interface KnowledgeConnection {
  beginTransaction(): Promise<void>
  query(sql: string, params?: unknown[]): Promise<[unknown, unknown]>
  commit(): Promise<void>
  rollback(): Promise<void>
  release(): void
}

interface KnowledgeDatabase {
  query(sql: string, params?: unknown[]): Promise<[unknown, unknown]>
  getConnection(): Promise<KnowledgeConnection>
}

interface MessageRow {
  role: 'user' | 'assistant'
  content: string
  sources_json: string | RagSource[] | null
  created_at: Date | string
}

interface SessionRow {
  session_id: string
  title: string
  last_message_at: Date | string
  message_count: number | string
}

const parseSources = (value: MessageRow['sources_json']): RagSource[] => {
  if (!value) return []
  if (Array.isArray(value)) return value
  try {
    const parsed: unknown = JSON.parse(value)
    return Array.isArray(parsed) ? (parsed as RagSource[]) : []
  } catch {
    return []
  }
}

export const createKnowledgeAssistantRepository = (
  db: KnowledgeDatabase = getMysqlPool() as unknown as KnowledgeDatabase
) => ({
  async saveMessagePair(
    userId: number,
    sessionId: string,
    question: string,
    response: RagAnswerResponse
  ): Promise<void> {
    const connection = await db.getConnection()
    try {
      await connection.beginTransaction()
      const sql = `INSERT INTO knowledge_assistant_messages
        (user_id, session_id, role, content, sources_json, request_id, provider, model)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      await connection.query(sql, [
        userId,
        sessionId,
        'user',
        question,
        null,
        response.requestId,
        null,
        null,
      ])
      await connection.query(sql, [
        userId,
        sessionId,
        'assistant',
        response.answer,
        JSON.stringify(response.sources),
        response.requestId,
        response.provider,
        response.model,
      ])
      await connection.commit()
    } catch (error) {
      await connection.rollback()
      throw error
    } finally {
      connection.release()
    }
  },

  async loadMessages(userId: number, sessionId: string, limit = 100): Promise<KnowledgeMessage[]> {
    const safeLimit = Math.max(1, Math.min(100, Math.trunc(limit)))
    const [rows] = await db.query(
      `SELECT role, content, sources_json, created_at
       FROM knowledge_assistant_messages
       WHERE user_id = ? AND session_id = ?
       ORDER BY created_at DESC, id DESC
       LIMIT ${safeLimit}`,
      [userId, sessionId]
    )
    return (rows as MessageRow[]).reverse().map((row) => ({
      role: row.role,
      content: row.content,
      sources: parseSources(row.sources_json),
      createdAt: new Date(row.created_at).toISOString(),
    }))
  },

  async listSessions(userId: number): Promise<KnowledgeSession[]> {
    const [rows] = await db.query(
      `SELECT session_id,
              COALESCE(MAX(CASE WHEN role = 'user' THEN LEFT(content, 40) END), '新对话') AS title,
              MAX(created_at) AS last_message_at,
              COUNT(*) AS message_count
       FROM knowledge_assistant_messages
       WHERE user_id = ?
       GROUP BY session_id
       ORDER BY last_message_at DESC`,
      [userId]
    )
    return (rows as SessionRow[]).map((row) => ({
      sessionId: row.session_id,
      title: row.title,
      lastMessageAt: new Date(row.last_message_at).toISOString(),
      messageCount: Number(row.message_count),
    }))
  },

  async sessionBelongsToUser(userId: number, sessionId: string): Promise<boolean> {
    const [rows] = await db.query(
      `SELECT 1 AS owned FROM knowledge_assistant_messages
       WHERE user_id = ? AND session_id = ? LIMIT 1`,
      [userId, sessionId]
    )
    return (rows as unknown[]).length > 0
  },
})

export const saveMessagePair = (
  userId: number,
  sessionId: string,
  question: string,
  response: RagAnswerResponse
) => createKnowledgeAssistantRepository().saveMessagePair(userId, sessionId, question, response)

export const loadMessages = (userId: number, sessionId: string, limit?: number) =>
  createKnowledgeAssistantRepository().loadMessages(userId, sessionId, limit)

export const listSessions = (userId: number) =>
  createKnowledgeAssistantRepository().listSessions(userId)

export const sessionBelongsToUser = (userId: number, sessionId: string) =>
  createKnowledgeAssistantRepository().sessionBelongsToUser(userId, sessionId)
