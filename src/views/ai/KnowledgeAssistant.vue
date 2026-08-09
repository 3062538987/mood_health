<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import {
  getKnowledgeSessions,
  loadKnowledgeMessages,
  sendKnowledgeMessage,
  type KnowledgeMessage,
  type KnowledgeSession,
} from '@/api/knowledgeAssistant'

interface DisplayMessage extends KnowledgeMessage {
  failed?: boolean
}

const sessions = ref<KnowledgeSession[]>([])
const messages = ref<DisplayMessage[]>([])
const activeSessionId = ref<string>()
const question = ref('')
const pending = ref(false)
const loadingHistory = ref(false)
const historyError = ref('')
const sendError = ref('')
const failedQuestion = ref('')

const canSend = computed(() => question.value.trim().length > 0 && !pending.value)

const readableError = (error: unknown, fallback: string) =>
  error instanceof Error && error.message ? error.message : fallback

const refreshSessions = async () => {
  try {
    sessions.value = await getKnowledgeSessions()
    historyError.value = ''
    if (!activeSessionId.value && sessions.value.length > 0) {
      await selectSession(sessions.value[0].sessionId)
    }
  } catch (error) {
    historyError.value = readableError(error, '历史会话加载失败，请重试')
  }
}

const startNewSession = () => {
  activeSessionId.value = undefined
  messages.value = []
  question.value = ''
  sendError.value = ''
  failedQuestion.value = ''
}

const selectSession = async (sessionId: string) => {
  if (pending.value || sessionId === activeSessionId.value) return
  loadingHistory.value = true
  historyError.value = ''
  sendError.value = ''
  try {
    messages.value = await loadKnowledgeMessages(sessionId)
    activeSessionId.value = sessionId
  } catch (error) {
    historyError.value = readableError(error, '会话内容加载失败，请重试')
  } finally {
    loadingHistory.value = false
  }
}

const submitQuestion = async (retry = false) => {
  const content = retry ? failedQuestion.value : question.value.trim()
  if (!content || pending.value) return

  pending.value = true
  sendError.value = ''
  if (!retry) {
    messages.value.push({
      role: 'user',
      content,
      sources: [],
      createdAt: new Date().toISOString(),
    })
  } else {
    const failedMessage = [...messages.value].reverse().find((message) => message.failed)
    if (failedMessage) failedMessage.failed = false
  }

  try {
    const answer = await sendKnowledgeMessage({
      message: content,
      ...(activeSessionId.value ? { sessionId: activeSessionId.value } : {}),
    })
    activeSessionId.value = answer.sessionId
    messages.value.push({
      role: 'assistant',
      content: answer.answer,
      sources: answer.sources,
      createdAt: new Date().toISOString(),
    })
    question.value = ''
    failedQuestion.value = ''
    await refreshSessions()
  } catch (error) {
    failedQuestion.value = content
    question.value = content
    const failedMessage = [...messages.value].reverse().find((message) => message.role === 'user')
    if (failedMessage) failedMessage.failed = true
    sendError.value = readableError(error, '知识助手暂时不可用，请稍后重试')
  } finally {
    pending.value = false
  }
}

const handleKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault()
    void submitQuestion()
  }
}

onMounted(refreshSessions)
</script>

<template>
  <main class="knowledge-assistant" aria-labelledby="knowledge-title">
    <aside class="session-panel" aria-label="知识助手历史会话">
      <div class="brand-block">
        <span class="brand-icon" aria-hidden="true">知</span>
        <div>
          <p class="eyebrow">MOOD HEALTH</p>
          <h1 id="knowledge-title">知识助手</h1>
        </div>
      </div>

      <button class="new-session" type="button" @click="startNewSession">
        <span aria-hidden="true">＋</span> 新对话
      </button>

      <p class="session-label">最近对话</p>
      <div v-if="historyError" class="history-error" role="alert">
        <span>{{ historyError }}</span>
        <button type="button" @click="refreshSessions">重试</button>
      </div>
      <nav v-else class="session-list" aria-label="会话列表">
        <button
          v-for="session in sessions"
          :key="session.sessionId"
          type="button"
          class="session-item"
          :class="{ active: activeSessionId === session.sessionId }"
          :data-session-id="session.sessionId"
          @click="selectSession(session.sessionId)"
        >
          <span>{{ session.title }}</span>
          <small>{{ session.messageCount }} 条消息</small>
        </button>
        <p v-if="sessions.length === 0" class="empty-sessions">还没有历史对话</p>
      </nav>

      <p class="privacy-note">回答仅用于心理健康知识科普，不能替代专业诊断。</p>
    </aside>

    <section class="conversation" aria-label="知识问答区">
      <header class="conversation-header">
        <div>
          <p class="eyebrow">有出处的心理健康知识</p>
          <h2>{{ activeSessionId ? '继续当前对话' : '今天想了解什么？' }}</h2>
        </div>
        <span class="status-pill"><i aria-hidden="true"></i> 知识库已连接</span>
      </header>

      <div class="message-scroll" aria-live="polite" :aria-busy="pending || loadingHistory">
        <div v-if="loadingHistory" class="center-state">正在加载会话…</div>
        <div v-else-if="messages.length === 0" class="welcome-card">
          <span class="welcome-mark" aria-hidden="true">✦</span>
          <h3>从一个具体问题开始</h3>
          <p>我会结合心理健康知识库回答，并把参考来源一并列出。</p>
          <div class="suggestions">
            <button type="button" @click="question = '怎样改善睡眠质量？'">怎样改善睡眠质量？</button>
            <button type="button" @click="question = '焦虑时可以怎样放松？'">焦虑时可以怎样放松？</button>
            <button type="button" @click="question = '如何建立稳定的作息？'">如何建立稳定的作息？</button>
          </div>
        </div>

        <article
          v-for="(message, index) in messages"
          :key="`${message.createdAt}-${index}`"
          class="message"
          :class="message.role"
        >
          <div class="avatar" aria-hidden="true">{{ message.role === 'user' ? '我' : '知' }}</div>
          <div
            class="message-body"
            :class="{ failed: message.failed }"
            :data-test="message.role === 'assistant' ? 'assistant-answer' : undefined"
          >
            <p>{{ message.content }}</p>
            <div v-if="message.sources.length" class="sources" aria-label="参考来源">
              <p>参考来源</p>
              <ul>
                <li
                  v-for="source in message.sources"
                  :key="`${source.title}-${source.reference}`"
                  data-test="source"
                >
                  <strong>{{ source.title }}</strong><span>{{ source.reference }}</span>
                </li>
              </ul>
            </div>
            <small v-if="message.failed">发送未成功，原问题已保留</small>
          </div>
        </article>

        <div v-if="pending" class="message assistant pending-message">
          <div class="avatar" aria-hidden="true">知</div>
          <div class="message-body"><span class="thinking">正在检索可信资料</span></div>
        </div>
      </div>

      <div class="composer-wrap">
        <div v-if="sendError" class="send-error" role="alert">
          <span>{{ sendError }}</span>
          <button data-test="retry" type="button" :disabled="pending" @click="submitQuestion(true)">
            重新发送
          </button>
        </div>
        <div class="composer">
          <textarea
            v-model="question"
            aria-label="输入心理健康知识问题"
            maxlength="1000"
            placeholder="输入你的问题，按 Enter 发送，Shift + Enter 换行"
            :disabled="pending"
            @keydown="handleKeydown"
          ></textarea>
          <div class="composer-footer">
            <span>{{ question.length }}/1000</span>
            <button data-test="send" type="button" :disabled="!canSend" @click="submitQuestion(false)">
              {{ pending ? '检索中…' : '发送' }}
            </button>
          </div>
        </div>
      </div>
    </section>
  </main>
</template>

<style scoped>
.knowledge-assistant { min-height: calc(100vh - 72px); display: grid; grid-template-columns: 280px minmax(0, 1fr); background: #f6f8f7; color: #20322d; }
.session-panel { display: flex; flex-direction: column; padding: 28px 20px; background: #183a32; color: #f5fbf8; }
.brand-block { display: flex; gap: 12px; align-items: center; margin-bottom: 28px; }
.brand-icon, .avatar { display: grid; place-items: center; flex: 0 0 auto; border-radius: 14px; background: #dff3e9; color: #1e5b49; font-weight: 800; }
.brand-icon { width: 44px; height: 44px; font-size: 20px; }
.eyebrow { margin: 0 0 3px; color: #82bca9; font-size: 11px; font-weight: 800; letter-spacing: .12em; }
h1, h2, h3, p { margin-top: 0; }
h1 { margin-bottom: 0; font-size: 21px; }
.new-session { width: 100%; padding: 12px 16px; border: 1px solid #659887; border-radius: 12px; background: #245346; color: white; font-weight: 700; text-align: left; cursor: pointer; }
.session-label { margin: 26px 8px 10px; color: #aac9bf; font-size: 12px; }
.session-list { display: grid; gap: 7px; }
.session-item { display: grid; gap: 4px; padding: 11px 12px; border: 0; border-radius: 10px; background: transparent; color: #e9f3f0; text-align: left; cursor: pointer; }
.session-item:hover, .session-item.active { background: #2b594c; }
.session-item span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.session-item small, .empty-sessions { color: #9bbeb3; }
.history-error { display: grid; gap: 8px; color: #ffd5cc; font-size: 13px; }
.history-error button, .send-error button { width: fit-content; border: 0; background: transparent; color: inherit; font-weight: 800; text-decoration: underline; cursor: pointer; }
.privacy-note { margin-top: auto; margin-bottom: 0; padding-top: 24px; color: #9bbeb3; font-size: 12px; line-height: 1.6; }
.conversation { min-width: 0; display: grid; grid-template-rows: auto minmax(0, 1fr) auto; min-height: calc(100vh - 72px); }
.conversation-header { display: flex; justify-content: space-between; align-items: center; padding: 30px clamp(24px, 5vw, 72px) 18px; border-bottom: 1px solid #e1e9e5; background: rgba(255,255,255,.82); }
.conversation-header h2 { margin-bottom: 0; font-size: clamp(22px, 3vw, 32px); }
.status-pill { padding: 8px 12px; border-radius: 99px; background: #e7f5ef; color: #286450; font-size: 12px; font-weight: 700; }
.status-pill i { display: inline-block; width: 7px; height: 7px; margin-right: 5px; border-radius: 50%; background: #39a87b; }
.message-scroll { overflow-y: auto; padding: 30px clamp(24px, 8vw, 130px); }
.welcome-card { max-width: 620px; margin: 8vh auto 0; text-align: center; }
.welcome-mark { display: grid; place-items: center; width: 62px; height: 62px; margin: 0 auto 20px; border-radius: 20px; background: #dff3e9; color: #24745a; font-size: 28px; }
.welcome-card h3 { margin-bottom: 10px; font-size: 26px; }
.welcome-card > p { color: #667a73; line-height: 1.7; }
.suggestions { display: flex; flex-wrap: wrap; justify-content: center; gap: 9px; margin-top: 25px; }
.suggestions button { padding: 10px 14px; border: 1px solid #d3e2dc; border-radius: 99px; background: white; color: #37564d; cursor: pointer; }
.message { display: flex; gap: 12px; max-width: 760px; margin: 0 auto 22px; }
.message.user { flex-direction: row-reverse; }
.avatar { width: 38px; height: 38px; border-radius: 12px; }
.message.user .avatar { background: #2f6f5c; color: white; }
.message-body { max-width: min(620px, 78vw); padding: 15px 17px; border: 1px solid #dce7e2; border-radius: 6px 18px 18px; background: white; box-shadow: 0 8px 24px rgba(30,66,55,.06); }
.message.user .message-body { border: 0; border-radius: 18px 6px 18px 18px; background: #2f6f5c; color: white; }
.message-body.failed { outline: 2px solid #e29a86; }
.message-body > p { margin-bottom: 0; white-space: pre-wrap; line-height: 1.75; }
.message-body > small { display: block; margin-top: 8px; color: #ffd8ce; }
.sources { margin-top: 16px; padding-top: 13px; border-top: 1px solid #e4ece8; }
.sources > p { margin-bottom: 8px; color: #6b7f78; font-size: 12px; font-weight: 800; }
.sources ul { display: grid; gap: 7px; margin: 0; padding: 0; list-style: none; }
.sources li { display: grid; gap: 2px; padding: 9px 11px; border-radius: 9px; background: #f3f8f6; font-size: 13px; }
.sources li span { color: #6a7e77; }
.thinking::after { content: '…'; animation: pulse 1.1s infinite; }
.center-state { padding-top: 20vh; text-align: center; color: #667a73; }
.composer-wrap { padding: 14px clamp(24px, 8vw, 130px) 26px; background: linear-gradient(transparent, #f6f8f7 20%); }
.send-error { display: flex; justify-content: space-between; gap: 12px; max-width: 760px; margin: 0 auto 9px; padding: 10px 13px; border-radius: 10px; background: #fff0ec; color: #9c3f2a; font-size: 13px; }
.composer { max-width: 760px; margin: 0 auto; padding: 13px 14px 10px; border: 1px solid #cbdcd5; border-radius: 17px; background: white; box-shadow: 0 12px 32px rgba(27,66,54,.1); }
.composer textarea { width: 100%; min-height: 64px; resize: none; border: 0; outline: 0; color: #20322d; font: inherit; line-height: 1.55; }
.composer-footer { display: flex; justify-content: space-between; align-items: center; color: #84958f; font-size: 12px; }
.composer-footer button { min-width: 82px; padding: 9px 17px; border: 0; border-radius: 10px; background: #245f4d; color: white; font-weight: 800; cursor: pointer; }
.composer-footer button:disabled { opacity: .45; cursor: not-allowed; }
@keyframes pulse { 50% { opacity: .35; } }
@media (max-width: 760px) {
  .knowledge-assistant { grid-template-columns: 1fr; }
  .session-panel { padding: 16px; }
  .brand-block, .session-label, .session-list, .privacy-note { display: none; }
  .new-session { text-align: center; }
  .conversation, .knowledge-assistant { min-height: calc(100vh - 60px); }
  .conversation-header { padding: 20px 18px 14px; }
  .status-pill { display: none; }
  .message-scroll, .composer-wrap { padding-left: 16px; padding-right: 16px; }
}
</style>
