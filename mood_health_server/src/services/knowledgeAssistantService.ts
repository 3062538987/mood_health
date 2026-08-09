import { randomUUID } from 'crypto'
import { callRagAnswer } from './fastApiClient'
import {
  listSessions,
  loadMessages,
  saveMessagePair,
  sessionBelongsToUser,
} from '../repositories/knowledgeAssistantRepository'

export class KnowledgeAssistantError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number
  ) {
    super(message)
  }
}

export const answerKnowledgeQuestion = async (
  userId: number,
  message: string,
  requestedSessionId?: string
) => {
  const question = message.trim()
  if (!question || question.length > 1000) {
    throw new KnowledgeAssistantError('问题长度必须为 1 到 1000 个字符', 400)
  }

  const sessionId = requestedSessionId ?? randomUUID()
  if (requestedSessionId && !(await sessionBelongsToUser(userId, requestedSessionId))) {
    throw new KnowledgeAssistantError('会话不存在', 404)
  }

  const history = (await loadMessages(userId, sessionId, 10)).map(({ role, content }) => ({
    role,
    content,
  }))
  const result = await callRagAnswer({ query: question, requestId: randomUUID(), history })
  await saveMessagePair(userId, sessionId, question, result)

  return { sessionId, ...result }
}

export const getKnowledgeSessions = (userId: number) => listSessions(userId)

export const getKnowledgeMessages = async (userId: number, sessionId: string) => {
  if (!(await sessionBelongsToUser(userId, sessionId))) {
    throw new KnowledgeAssistantError('会话不存在', 404)
  }
  return loadMessages(userId, sessionId)
}
