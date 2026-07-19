import { randomUUID } from 'crypto'
import { getMysqlPool } from '../config/mysql'
import { callChatCompletion } from '../utils/ai/aiClient'
import logger from '../utils/logger'

export interface CounselingMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
  createdAt?: string
}

export interface CounselingSession {
  sessionId: string
  messages: CounselingMessage[]
  createdAt: string
  lastMessageAt: string
  messageCount: number
}

export function generateSessionId(): string {
  return randomUUID()
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
  assistantMessage: string
): Promise<void> {
  await saveMessage(userId, sessionId, 'user', userMessage)
  await saveMessage(userId, sessionId, 'assistant', assistantMessage)
}

export async function loadSession(
  userId: number,
  sessionId: string,
  limit: number = 20
): Promise<CounselingMessage[]> {
  try {
    const pool = getMysqlPool()
    const [rows] = await pool.query(
      `SELECT role, content, created_at FROM counseling_sessions
       WHERE user_id = ? AND session_id = ?
       ORDER BY created_at DESC LIMIT ?`,
      [userId, sessionId, limit]
    )
    const resultRows = rows as any[]
    return (resultRows || []).reverse().map((r: any) => ({
      role: r.role,
      content: r.content,
      createdAt: r.created_at
    }))
  } catch (error) {
    logger.error('加载会话消息失败:', error)
    return []
  }
}

export async function listSessions(userId: number): Promise<CounselingSession[]> {
  try {
    const pool = getMysqlPool()
    const [rows] = await pool.query(
      `SELECT session_id, MIN(created_at) as created_at, MAX(created_at) as last_message_at,
              COUNT(*) as message_count
       FROM counseling_sessions
       WHERE user_id = ? AND role != 'system'
       GROUP BY session_id
       ORDER BY last_message_at DESC
       LIMIT 20`,
      [userId]
    )
    const resultRows = rows as any[]
    return (resultRows || []).map((r: any) => ({
      sessionId: r.session_id,
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