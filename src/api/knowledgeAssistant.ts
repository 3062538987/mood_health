import request from '@/utils/request'

export interface KnowledgeSource {
  title: string
  reference: string
}

export interface KnowledgeAnswer {
  sessionId: string
  answer: string
  sources: KnowledgeSource[]
  requestId: string
  provider: string
  model: string
  fallbackUsed: false
}

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

export const sendKnowledgeMessage = (data: { message: string; sessionId?: string }) =>
  request<KnowledgeAnswer>({
    url: '/api/knowledge-assistant/messages',
    method: 'post',
    data,
    timeout: 60_000,
  })

export const getKnowledgeSessions = () =>
  request<KnowledgeSession[]>({
    url: '/api/knowledge-assistant/sessions',
    method: 'get',
  })

export const loadKnowledgeMessages = (sessionId: string) =>
  request<KnowledgeMessage[]>({
    url: `/api/knowledge-assistant/sessions/${sessionId}/messages`,
    method: 'get',
  })
