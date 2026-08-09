import { randomUUID } from 'crypto'
import type { RowDataPacket } from 'mysql2'
import { getMysqlPool } from '../config/mysql'
import { callChatCompletion } from '../utils/ai/aiClient'
import logger from '../utils/logger'
import type { AssistantSource, WebSearchStatus } from './fastApiClient'

export interface CounselingMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
  createdAt?: string
  sources?: AssistantSource[]
  webSearchStatus?: WebSearchStatus
  groundingUsed?: boolean
  fallbackUsed?: boolean
  provider?: string | null
  model?: string | null
}

export interface AssistantMessageMetadata {
  sources: AssistantSource[]
  requestId: string
  provider: string | null
  model: string | null
  groundingUsed: boolean
  fallbackUsed: boolean
  webSearchStatus: WebSearchStatus
}

export interface CounselingSession {
  sessionId: string
  title: string
  messages: CounselingMessage[]
  createdAt: string
  lastMessageAt: string
  messageCount: number
}

export function generateSessionId(): string {
  return randomUUID()
}

export function buildDefaultSessionTitle(content: string): string {
  const normalized = content.replace(/\s+/g, ' ').trim()
  return normalized.slice(0, 30) || '新对话'
}

const WEB_SEARCH_STATUSES = new Set<WebSearchStatus>([
  'not_requested',
  'not_needed',
  'used',
  'failed',
])

function parseWebSearchStatus(value: unknown): WebSearchStatus {
  return typeof value === 'string' && WEB_SEARCH_STATUSES.has(value as WebSearchStatus)
    ? value as WebSearchStatus
    : 'not_requested'
}

function parseSafeHttpsUrl(value: unknown): string | undefined {
  if (typeof value !== 'string' || value.length === 0 || value.length > 2048) {
    return undefined
  }
  if (value.trim() !== value || /[\u0000-\u001f\u007f]/.test(value)) {
    return undefined
  }

  try {
    const url = new URL(value)
    if (
      url.protocol !== 'https:' ||
      url.username !== '' ||
      url.password !== '' ||
      url.hostname === ''
    ) {
      return undefined
    }
    return value
  } catch {
    return undefined
  }
}

function parseSources(value: unknown): AssistantSource[] {
  let decoded: unknown = value
  if (typeof value === 'string') {
    try {
      decoded = JSON.parse(value)
    } catch {
      return []
    }
  }
  if (!Array.isArray(decoded)) {
    return []
  }

  return decoded.flatMap((item): AssistantSource[] => {
    if (item === null || typeof item !== 'object' || Array.isArray(item)) {
      return []
    }
    const source = item as Record<string, unknown>
    if (
      typeof source.title !== 'string' || source.title.trim() === '' ||
      typeof source.reference !== 'string' || source.reference.trim() === ''
    ) {
      return []
    }

    const sourceType = source.sourceType === undefined ? 'local' : source.sourceType
    if (sourceType === 'local') {
      return [{
        sourceType,
        title: source.title,
        reference: source.reference,
      }]
    }
    if (sourceType !== 'web') {
      return []
    }

    const url = parseSafeHttpsUrl(source.url)
    return [{
      sourceType,
      title: source.title,
      reference: source.reference,
      ...(url === undefined ? {} : { url }),
    }]
  })
}

export async function saveMessage(
  userId: number,
  sessionId: string,
  role: 'user' | 'assistant' | 'system',
  content: string
): Promise<void> {
  try {
    const pool = getMysqlPool()
    await pool.query(
      'INSERT INTO counseling_sessions (user_id, session_id, role, content) VALUES (?, ?, ?, ?)',
      [userId, sessionId, role, content]
    )
  } catch (error) {
    logger.error('保存对话消息失败:', error)
  }
}

export async function saveMessagePair(
  userId: number,
  sessionId: string,
  userMessage: string,
  assistantMessage: string,
  metadata: AssistantMessageMetadata
): Promise<void> {
  const connection = await getMysqlPool().getConnection()
  try {
    await connection.beginTransaction()
    await connection.query(
      'INSERT INTO counseling_sessions (user_id, session_id, role, content) VALUES (?, ?, ?, ?)',
      [userId, sessionId, 'user', userMessage]
    )
    await connection.query(
      `INSERT INTO counseling_sessions
        (user_id, session_id, role, content, sources_json, request_id, provider, model,
         grounding_used, fallback_used, web_search_status)
       VALUES (?, ?, 'assistant', ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        sessionId,
        assistantMessage,
        JSON.stringify(metadata.sources),
        metadata.requestId,
        metadata.provider,
        metadata.model,
        metadata.groundingUsed,
        metadata.fallbackUsed,
        metadata.webSearchStatus,
      ]
    )
    await connection.commit()
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }
}

export async function loadSession(
  userId: number,
  sessionId: string,
  limit: number = 20
): Promise<CounselingMessage[]> {
  try {
    const pool = getMysqlPool()
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT role, content, sources_json, web_search_status, grounding_used, fallback_used,
              provider, model, created_at
       FROM counseling_sessions
       WHERE user_id = ? AND session_id = ?
       ORDER BY created_at DESC LIMIT ?`,
      [userId, sessionId, limit]
    )
    const resultRows = rows
    return resultRows.reverse().map((r: RowDataPacket) => {
      return {
        role: r.role,
        content: r.content,
        createdAt: r.created_at,
        sources: parseSources(r.sources_json),
        webSearchStatus: parseWebSearchStatus(r.web_search_status),
        groundingUsed: Boolean(r.grounding_used),
        fallbackUsed: Boolean(r.fallback_used),
        provider: typeof r.provider === 'string' ? r.provider : null,
        model: typeof r.model === 'string' ? r.model : null,
      }
    })
  } catch (error) {
    logger.error('加载会话消息失败:', error)
    return []
  }
}

export async function listSessions(userId: number): Promise<CounselingSession[]> {
  try {
    const pool = getMysqlPool()
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT grouped.session_id,
              grouped.created_at,
              grouped.last_message_at,
              grouped.message_count,
              metadata.title AS custom_title,
              first_user.content AS first_user_message
       FROM (
         SELECT user_id, session_id,
                MIN(created_at) AS created_at,
                MAX(created_at) AS last_message_at,
                COUNT(*) AS message_count
         FROM counseling_sessions
         WHERE user_id = ? AND role != 'system'
         GROUP BY user_id, session_id
       ) AS grouped
       LEFT JOIN counseling_session_metadata AS metadata
         ON metadata.user_id = grouped.user_id
        AND metadata.session_id = grouped.session_id
       LEFT JOIN counseling_sessions AS first_user
         ON first_user.id = (
           SELECT MIN(candidate.id)
           FROM counseling_sessions AS candidate
           WHERE candidate.user_id = grouped.user_id
             AND candidate.session_id = grouped.session_id
             AND candidate.role = 'user'
         )
       ORDER BY grouped.last_message_at DESC
       LIMIT 20`,
      [userId]
    )
    const resultRows = rows
    return resultRows.map((r: RowDataPacket) => ({
      sessionId: r.session_id,
      title: r.custom_title || buildDefaultSessionTitle(r.first_user_message || ''),
      messages: [],
      createdAt: r.created_at ? new Date(r.created_at).toISOString() : '',
      lastMessageAt: r.last_message_at ? new Date(r.last_message_at).toISOString() : '',
      messageCount: r.message_count,
    }))
  } catch (error) {
    logger.error('获取会话列表失败:', error)
    return []
  }
}

export async function renameSession(
  userId: number,
  sessionId: string,
  title: string
): Promise<boolean> {
  const pool = getMysqlPool()
    const [ownedRows] = await pool.query<RowDataPacket[]>(
      `SELECT 1 AS \`exists\` FROM counseling_sessions
     WHERE user_id = ? AND session_id = ?
     LIMIT 1`,
    [userId, sessionId]
  )

  if (ownedRows.length === 0) {
    return false
  }

  await pool.query(
    `INSERT INTO counseling_session_metadata (user_id, session_id, title)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE title = VALUES(title), updated_at = CURRENT_TIMESTAMP`,
    [userId, sessionId, title]
  )

  return true
}

export async function generateSummary(messages: CounselingMessage[]): Promise<string> {
  if (messages.length <= 10) return ''

  const olderMessages = messages.slice(0, messages.length - 10)
  const conversationText = olderMessages
    .map(m => `${m.role === 'user' ? '用户' : 'AI'}: ${m.content}`)
    .join('\n')

  try {
    const summary = await callChatCompletion([
      { role: 'system', content: '请用一句话总结以下对话的主要内容（50字以内），只输出摘要，不要其他内容。' },
      { role: 'user', content: conversationText }
    ], { temperature: 0.3, maxTokens: 100 })
    return summary.trim()
  } catch {
    return ''
  }
}

export async function buildContextMessages(
  userId: number,
  sessionId: string,
  currentMessage: string
): Promise<Array<{ role: 'system' | 'user' | 'assistant'; content: string }>> {
  const history = await loadSession(userId, sessionId)
  const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = []

  messages.push({
    role: 'system',
    content: `你是一个专业的心理咨询陪伴助手，请注意以下安全规则：

1. 禁止进行任何形式的诊断：
   - 不要说"你有抑郁症"、"你有焦虑症"等诊断性语句
   - 不要使用医学术语进行病情判断
   - 只提供情绪支持和心理疏导

2. 禁止提供医疗建议：
   - 不要推荐具体药物或治疗方法
   - 不要指导用药剂量或频率
   - 不要替代专业医疗人员的建议

3. 保持专业边界：
   - 始终保持中立和专业的态度
   - 不做价值判断，尊重用户的感受
   - 提供情感支持和积极引导

4. 风险情况处理：
   - 如发现用户有自杀、自残或其他危险倾向，表达关心并建议寻求专业帮助
   - 不深入讨论危险行为的细节
   - 引导用户关注积极的方面

5. 回复风格：
   - 语气温和、耐心、理解
   - 回复长度控制在2-4句
   - 避免使用复杂术语
   - 提供具体的情感支持和鼓励
   - 用"你"而不是"您"，保持亲切感`
  })

  if (history.length > 20) {
    const summary = await generateSummary(history)
    if (summary) {
      messages.push({
        role: 'system',
        content: `[对话历史摘要] ${summary}`
      })
    }
    const recentMessages = history.slice(-10)
    messages.push(...recentMessages.map(m => ({
      role: (m.role === 'assistant' ? 'assistant' : 'user') as 'assistant' | 'user',
      content: m.content
    })))
  } else {
    messages.push(...history.map(m => ({
      role: (m.role === 'assistant' ? 'assistant' : 'user') as 'assistant' | 'user',
      content: m.content
    })))
  }

  messages.push({ role: 'user', content: currentMessage })

  return messages
}
