<template>
  <div class="counseling-page">
    <div class="page-header">
      <div class="header-left">
        <button class="sidebar-toggle" type="button" @click="sidebarOpen = !sidebarOpen" aria-label="切换会话列表">
          <span class="toggle-icon">☰</span>
        </button>
        <h1>AI 心理助手</h1>
      </div>
      <p class="description">陪你梳理情绪，也回答有来源的心理健康问题</p>
    </div>

    <div class="counseling-layout">
      <!-- 会话列表侧边栏 -->
      <transition name="sidebar-slide">
        <div v-if="sidebarOpen" class="session-sidebar-overlay" @click.self="sidebarOpen = false">
          <CounselingHistorySidebar
            :sessions="sessions"
            :current-session-id="currentSessionId"
            :loading="sessionsLoading"
            :error="sessionsError"
            @close="sidebarOpen = false"
            @create="createNewSession"
            @retry="loadSessions"
            @select="switchSession"
            @rename="handleRenameSession"
          />
        </div>
      </transition>

      <div class="counseling-container">
      <aside class="history-column" aria-label="历史会话栏">
        <CounselingHistorySidebar
          :sessions="sessions"
          :current-session-id="currentSessionId"
          :loading="sessionsLoading"
          :error="sessionsError"
          @close="sidebarOpen = true"
          @create="createNewSession"
          @retry="loadSessions"
          @select="switchSession"
          @rename="handleRenameSession"
        />
      </aside>
      <aside class="info-panel">
        <section class="info-card">
          <h3>服务介绍</h3>
          <p>
            这是一个用于情绪倾诉与压力梳理的陪伴空间。你可以把此刻的烦恼、焦虑或困惑说出来，我们会给出温和且实用的建议。
          </p>
        </section>

        <section class="info-card">
          <h3>服务特色</h3>
          <ul>
            <li>专注倾听，减少情绪堆积</li>
            <li>结合情境，提供可执行建议</li>
            <li>需要时结合可靠知识并标注来源</li>
          </ul>
        </section>

        <section class="contact-info">
          <h3>紧急联系</h3>
          <p>如出现强烈自伤或伤人风险，请立即联系身边信任的人或学校支持，并拨打当地紧急服务 110/120。</p>
          <a class="emergency-number" href="tel:12356">全国统一心理援助热线：12356</a>
          <p>AI 和心理援助热线不能替代紧急救援。</p>
        </section>
      </aside>

      <section class="chat-panel">
        <header class="chat-header">
          <h2>今日对话</h2>
          <p>你说的话会被认真对待，请放心表达。</p>
          <button
            class="clear-chat-button"
            type="button"
            :disabled="isSending"
            @click="clearConversation"
          >
            清空对话
          </button>
        </header>

        <div class="quick-prompts" aria-label="示例问题">
          <button type="button" @click="inputMessage = '怎样改善睡眠质量？'">改善睡眠</button>
          <button type="button" @click="inputMessage = '焦虑时可以怎样放松？'">焦虑放松</button>
          <button type="button" @click="inputMessage = '我今天压力很大，想找人聊聊'">聊聊压力</button>
        </div>

        <div ref="messageContainerRef" class="message-container">
          <transition-group name="bubble" tag="div" class="message-list">
            <div
              v-for="msg in messages"
              :key="msg.id"
              class="message-row"
              :class="msg.role === 'user' ? 'is-user' : 'is-assistant'"
            >
              <div class="bubble" :class="msg.role">
                <p>{{ msg.content }}</p>
                <div
                  v-if="msg.role === 'assistant' && msg.sources?.length"
                  class="message-sources"
                  aria-label="参考来源"
                >
                  <strong>参考来源</strong>
                  <ul>
                    <li v-for="source in msg.sources" :key="`${source.title}-${source.reference}`">
                      <span>{{ source.title }}</span>
                      <small>{{ source.reference }}</small>
                    </li>
                  </ul>
                </div>
                <details
                  v-if="msg.role === 'assistant' && msg.reasoningSteps?.length"
                  class="reasoning-trace"
                  open
                >
                  <summary>
                    <span class="rt-title">AI 是怎么想的</span>
                    <span class="rt-count">{{ msg.reasoningSteps.length }} 步</span>
                  </summary>
                  <ol>
                    <li
                      v-for="(step, idx) in msg.reasoningSteps"
                      :key="idx"
                      class="trace-item"
                      :class="`trace-${step.phase}`"
                    >
                      <span class="trace-node" :aria-hidden="true">{{ traceIcon(step.phase) }}</span>
                      <div class="trace-body">
                        <span class="trace-phase">{{ traceLabel(step.phase) }}</span>
                        <span class="trace-label">{{ step.label }}</span>
                        <small v-if="step.detail" class="trace-detail">{{ step.detail }}</small>
                      </div>
                    </li>
                  </ol>
                </details>
                <div class="message-meta">
                  <span class="time">{{ formatTime(msg.createdAt) }}</span>
                  <button
                    v-if="msg.role === 'user' && msg.status === 'failed'"
                    class="retry-button"
                    type="button"
                    :disabled="isSending"
                    @click="retryMessage(msg.id)"
                  >
                    重试
                  </button>
                  <span
                    v-else-if="msg.role === 'user' && msg.status === 'sending'"
                    class="status-text"
                  >
                    发送中...
                  </span>
                </div>
                <span
                  v-if="msg.role === 'assistant' && msg.riskLevel"
                  class="risk-badge"
                  :class="msg.riskLevel"
                >
                  {{ riskText[msg.riskLevel] }}
                </span>
              </div>
            </div>
          </transition-group>

          <div v-if="isSending" class="message-row is-assistant">
            <div class="bubble assistant loading-bubble" aria-label="助手正在输入">
              <span></span>
              <span></span>
              <span></span>
            </div>
          </div>
        </div>

        </section>

        <footer class="input-panel">
          <el-input
            v-model="inputMessage"
            type="textarea"
            :rows="3"
            :autosize="{ minRows: 3, maxRows: 6 }"
            resize="none"
            maxlength="1000"
            show-word-limit
            placeholder="把你现在的感受告诉我，支持换行输入..."
            @keydown.ctrl.enter.exact.prevent="handleCtrlEnterSend"
          />

          <div v-if="sendError" class="send-error" role="alert" aria-live="assertive">
            {{ sendError }}
          </div>

          <el-button
            class="send-button"
            type="primary"
            round
            :disabled="!canSend"
            :loading="isSending"
            @click="sendMessage"
          >
            {{ isSending ? '发送中...' : '发送' }}
          </el-button>
        </footer>
        <div class="send-tip">按 Ctrl + Enter 发送，Enter 换行</div>
    </div>
  </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { sendSessionCounselingMessage, getSessions, loadSessionMessages, renameSession } from '@/api/counseling'
import type { KnowledgeSource, SessionItem, ReasoningStep } from '@/api/counseling'
import { useUserStore } from '@/stores/userStore'
import CounselingHistorySidebar from '@/components/counseling/CounselingHistorySidebar.vue'

type RiskLevel = 'low' | 'medium' | 'high'
type MessageStatus = 'sending' | 'sent' | 'failed'

interface MessageItem {
  id: string
  role: 'user' | 'assistant'
  content: string
  createdAt: string
  status?: MessageStatus
  riskLevel?: RiskLevel
  sources?: KnowledgeSource[]
  reasoningSteps?: ReasoningStep[]
}

const userStore = useUserStore()
const inputMessage = ref('')
const isSending = ref(false)
const sendError = ref('')
const messageContainerRef = ref<HTMLElement | null>(null)
const currentSessionId = ref('')
const sessions = ref<SessionItem[]>([])
const sessionsLoading = ref(false)
const sessionsError = ref('')
const sidebarOpen = ref(false)
const messages = ref<MessageItem[]>([
  {
    id: crypto.randomUUID(),
    role: 'assistant',
    content:
      '你好，我是 AI 心理助手。你可以和我聊聊此刻的感受，也可以询问心理健康知识。',
    createdAt: new Date().toISOString(),
  },
])

const riskText: Record<RiskLevel, string> = {
  low: '低风险',
  medium: '中风险',
  high: '高风险',
}

const canSend = computed(() => inputMessage.value.trim().length > 0 && !isSending.value)

const scrollToBottom = async () => {
  await nextTick()
  if (!messageContainerRef.value) {
    return
  }
  messageContainerRef.value.scrollTop = messageContainerRef.value.scrollHeight
}

watch(
  () => [messages.value, isSending.value],
  () => {
    scrollToBottom()
  },
  { deep: true }
)

onMounted(() => {
  scrollToBottom()
  currentSessionId.value = generateSessionId()
  loadSessions()
})

const generateSessionId = (): string => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
  })
}

const loadSessions = async () => {
  sessionsLoading.value = true
  sessionsError.value = ''
  try {
    sessions.value = await getSessions()
  } catch {
    sessionsError.value = '历史会话加载失败，请重试'
  } finally {
    sessionsLoading.value = false
  }
}

const createNewSession = () => {
  currentSessionId.value = generateSessionId()
  messages.value = [
    {
      id: crypto.randomUUID(),
      role: 'assistant',
      content:
        '你好，我是 AI 心理助手。你可以和我聊聊此刻的感受，也可以询问心理健康知识。',
      createdAt: new Date().toISOString(),
    },
  ]
  sendError.value = ''
  sidebarOpen.value = false
}

const switchSession = async (sessionId: string) => {
  try {
    const loadedMessages = await loadSessionMessages(sessionId)
    const nextMessages = loadedMessages
      .filter(m => m.role === 'user' || m.role === 'assistant')
      .map(m => ({
      id: crypto.randomUUID(),
      role: m.role as 'user' | 'assistant',
      content: m.content,
      createdAt: m.createdAt || new Date().toISOString(),
      sources: m.sources || [],
    }))

    if (nextMessages.length === 0) {
      nextMessages.push({
        id: crypto.randomUUID(),
        role: 'assistant' as const,
        content: '你好，欢迎回来。我们继续聊聊吧。',
        createdAt: new Date().toISOString(),
        sources: [],
      })
    }

    currentSessionId.value = sessionId
    messages.value = nextMessages
    sendError.value = ''
    sidebarOpen.value = false
  } catch {
    ElMessage.error('会话加载失败，请重试')
  }
}

const handleRenameSession = async (payload: { sessionId: string; title: string }) => {
  try {
    const renamed = await renameSession(payload.sessionId, payload.title)
    sessions.value = sessions.value.map(session => (
      session.sessionId === payload.sessionId
        ? { ...session, title: renamed.title }
        : session
    ))
    ElMessage.success('会话已重命名')
  } catch (error: unknown) {
    ElMessage.error(error instanceof Error ? error.message : '重命名失败，请重试')
  }
}

const formatTime = (isoTime: string): string => {
  const date = new Date(isoTime)
  const hour = `${date.getHours()}`.padStart(2, '0')
  const minute = `${date.getMinutes()}`.padStart(2, '0')
  return `${hour}:${minute}`
}

// CoT 推理轨迹：phase → 中文标签 + 语义图标（与 AI 服务 orchestration.py 的 ReasoningStep.phase 对齐）
const TRACE_META: Record<string, { label: string; icon: string }> = {
  safety: { label: '安全检查', icon: '🛡️' },
  retrieve: { label: '检索知识', icon: '📚' },
  web: { label: '联网检索', icon: '🌐' },
  decision: { label: '决策', icon: '🧭' },
  tools: { label: '调用工具', icon: '🔧' },
  collect_tool_result: { label: '整合结果', icon: '🔗' },
  collect: { label: '整合结果', icon: '🔗' },
  memory: { label: '长程记忆', icon: '🧠' },
  synthesis: { label: '总结作答', icon: '✨' },
}
const traceLabel = (phase: string): string => TRACE_META[phase]?.label ?? phase
const traceIcon = (phase: string): string => TRACE_META[phase]?.icon ?? '•'

const handleCtrlEnterSend = async () => {
  await sendMessage()
}

const buildContext = (retryMessageId?: string) => {
  return messages.value
    .filter((msg) => {
      if (msg.role === 'assistant') {
        return true
      }
      if (msg.id === retryMessageId) {
        return true
      }
      return msg.status !== 'failed'
    })
    .slice(-10)
    .map((msg) => ({
      role: msg.role,
      content: msg.content,
    }))
}

const updateUserMessageStatus = (messageId: string, status: MessageStatus) => {
  const index = messages.value.findIndex((msg) => msg.id === messageId && msg.role === 'user')
  if (index < 0) {
    return
  }
  messages.value[index] = {
    ...messages.value[index],
    status,
  }
}

const sendToService = async (targetUserMessage: MessageItem, inputSnapshot: string) => {
  const result = await sendSessionCounselingMessage({
    message: targetUserMessage.content,
    sessionId: currentSessionId.value,
  })

  updateUserMessageStatus(targetUserMessage.id, 'sent')

  // 如果服务端返回了 sessionId（首次发送时），更新本地 sessionId
  if (result.sessionId && result.sessionId !== currentSessionId.value) {
    currentSessionId.value = result.sessionId
  }

  messages.value.push({
    id: crypto.randomUUID(),
    role: 'assistant',
    content: result.response,
    riskLevel: result.riskLevel as MessageItem['riskLevel'],
    sources: result.sources || [],
    reasoningSteps: result.reasoningSteps || [],
    createdAt: new Date().toISOString(),
  })

  if (result.hasRiskContent && result.suggestion) {
    ElMessage.warning(result.suggestion)
  }

  if (inputMessage.value.trim() === inputSnapshot.trim()) {
    inputMessage.value = ''
  }
  sendError.value = ''

  // 刷新会话列表
  loadSessions()
}

const sendMessage = async () => {
  if (!canSend.value || isSending.value) {
    return
  }

  const inputSnapshot = inputMessage.value
  const content = inputSnapshot.trim()
  sendError.value = ''

  const newUserMessage: MessageItem = {
    id: crypto.randomUUID(),
    role: 'user',
    content,
    status: 'sending',
    createdAt: new Date().toISOString(),
  }

  messages.value.push(newUserMessage)
  inputMessage.value = ''

  isSending.value = true

  try {
    await sendToService(newUserMessage, inputSnapshot)
  } catch (error: unknown) {
    updateUserMessageStatus(newUserMessage.id, 'failed')
    if (!inputMessage.value.trim()) {
      inputMessage.value = inputSnapshot
    }
    const message = error instanceof Error ? error.message : '发送失败，请稍后再试'
    sendError.value = `发送失败：${message}。原文字已保留，可修改后重试。`
    ElMessage.error(message)
  } finally {
    isSending.value = false
  }
}

const retryMessage = async (messageId: string) => {
  if (isSending.value) {
    return
  }

  const target = messages.value.find((msg) => msg.id === messageId)
  if (!target || target.role !== 'user' || target.status !== 'failed') {
    return
  }

  isSending.value = true
  updateUserMessageStatus(target.id, 'sending')
  sendError.value = ''

  try {
    await sendToService(target, inputMessage.value)
  } catch (error: unknown) {
    updateUserMessageStatus(target.id, 'failed')
    const message = error instanceof Error ? error.message : '重试失败，请稍后再试'
    sendError.value = `发送失败：${message}。原文字已保留，可修改后重试。`
    ElMessage.error(message)
  } finally {
    isSending.value = false
  }
}

const clearConversation = async () => {
  if (isSending.value) return
  try {
    await ElMessageBox.confirm('确定要清空所有对话记录吗？此操作不可撤销。', '清空对话', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning',
    })
    messages.value = [
      {
        id: crypto.randomUUID(),
        role: 'assistant',
        content:
          '你好，我是 AI 心理助手。你可以和我聊聊此刻的感受，也可以询问心理健康知识。',
        createdAt: new Date().toISOString(),
      },
    ]
    sendError.value = ''
    ElMessage.success('对话已清空')
  } catch {
    // 用户取消操作
  }
}
</script>

<style scoped lang="scss">
.counseling-page {
  --chat-panel: var(--surface);
  --chat-line: var(--border-color);
  --chat-text-main: var(--text-color);
  --chat-text-sub: var(--muted);
  --chat-assistant-bubble: var(--surface);
  --chat-user-bubble: var(--primary-soft-bg);

  min-height: 100vh;
  padding: 20px;
  background: var(--bg-color);
}

.page-header {
  text-align: center;
  margin-bottom: 20px;

  .header-left {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
  }

  h1 {
    margin: 0;
    font-size: 30px;
    color: var(--chat-text-main);
    font-family: var(--font-display);
    letter-spacing: 0.02em;
  }

  .description {
    margin-top: 8px;
    color: var(--chat-text-sub);
  }
}

.sidebar-toggle {
  background: none;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 4px 10px;
  font-size: 18px;
  cursor: pointer;
  color: var(--chat-text-sub);
  line-height: 1;
  transition: all 0.2s ease;

  &:hover {
    color: var(--primary-color);
    border-color: var(--primary-color);
  }
}

.counseling-layout {
  position: relative;
}

.session-sidebar-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.3);
  z-index: 100;
  display: flex;
  justify-content: flex-start;
}

.sidebar-slide-enter-active,
.sidebar-slide-leave-active {
  transition: opacity 0.25s ease;

  .session-sidebar {
    transition: transform 0.25s ease;
  }
}

.sidebar-slide-enter-from,
.sidebar-slide-leave-to {
  opacity: 0;

  .session-sidebar {
    transform: translateX(-100%);
  }
}

.counseling-container {
  max-width: 1600px;
  margin: 0 auto;
  min-height: calc(100vh - 140px);
  display: grid;
  grid-template-columns: minmax(220px, 260px) minmax(0, 1fr) minmax(260px, 300px);
  grid-template-areas:
    'history chat info'
    'composer composer composer'
    'tip tip tip';
  gap: 20px;
  align-items: start;
}

.history-column {
  grid-area: history;
  position: sticky;
  top: 20px;
  height: calc(100vh - 180px);
  min-height: 520px;
  overflow: hidden;
  border: 1px solid var(--border-color);
  border-radius: 16px;
  background: var(--surface);
  box-shadow: var(--shadow-sm);

  :deep(.session-sidebar) {
    width: 100%;
    max-width: none;
    border-right: 0;
    box-shadow: none;
  }

  :deep(.close-sidebar) {
    display: none;
  }
}

.info-panel {
  grid-area: info;
  flex: 0 0 320px;
  position: sticky;
  top: 20px;
  height: fit-content;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.info-card,
.contact-info {
  background: var(--surface);
  border: 1px solid var(--border-color);
  border-radius: 16px;
  padding: 16px;
  box-shadow: var(--shadow-sm);

  h3 {
    margin: 0 0 10px;
    color: var(--chat-text-main);
    font-size: 16px;
  }

  p,
  li {
    color: var(--chat-text-sub);
    line-height: 1.7;
    font-size: 14px;
  }

  ul {
    margin: 0;
    padding-left: 18px;
  }
}

.contact-info .emergency-number {
  color: var(--danger);
  font-weight: 600;
}

.chat-panel {
  grid-area: chat;
  min-width: 0;
  flex: 1;
  background: var(--surface);
  border: 1px solid var(--border-color);
  border-radius: 20px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: var(--shadow-md);
}

.quick-prompts {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 10px 18px;
  border-bottom: 1px solid var(--chat-line);

  button {
    padding: 7px 12px;
    border: 1px solid var(--chat-line);
    border-radius: 999px;
    background: var(--surface);
    color: var(--chat-text-sub);
    cursor: pointer;
  }
}

.chat-header {
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-color);
  background: var(--surface-muted);
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px;

  h2 {
    margin: 0;
    color: var(--chat-text-main);
    font-size: 18px;
  }

  p {
    margin: 6px 0 0;
    color: var(--chat-text-sub);
    font-size: 13px;
    flex-basis: 100%;
  }
}

.clear-chat-button {
  padding: 6px 14px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background: var(--surface);
  color: var(--text-muted);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;

  &:hover:not(:disabled) {
    color: var(--danger-color);
    border-color: var(--danger-color);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}

.message-container {
  flex: 1;
  min-height: 360px;
  overflow-y: auto;
  padding: 18px;
}

.message-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.message-row {
  display: flex;
}

.message-row.is-user {
  justify-content: flex-end;
}

.message-row.is-assistant {
  justify-content: flex-start;
}

.bubble {
  position: relative;
  max-width: min(76%, 700px);
  border-radius: 16px;
  padding: 11px 14px;
  line-height: 1.7;
  animation: fade-up 0.25s ease;

  p {
    margin: 0;
    white-space: pre-wrap;
    word-break: break-word;
    color: var(--chat-text-main);
    font-size: 14px;
  }

  &.assistant {
    background: var(--chat-assistant-bubble);
    border: 1px solid var(--border-color);
    border-top-left-radius: 6px;
  }

  &.user {
    background: var(--chat-user-bubble);
    border: 1px solid var(--primary-color);
    border-top-right-radius: 6px;
  }
}

.message-sources {
  margin-top: 12px;
  padding-top: 10px;
  border-top: 1px solid var(--chat-line);

  strong {
    font-size: 12px;
    color: var(--chat-text-sub);
  }

  ul {
    display: grid;
    gap: 6px;
    margin: 8px 0 0;
    padding: 0;
    list-style: none;
  }

  li {
    display: grid;
    gap: 2px;
    padding: 8px 10px;
    border-radius: 8px;
    background: var(--bg-color);
  }

  small {
    color: var(--chat-text-sub);
  }
}

.reasoning-trace {
  margin-top: 12px;
  padding: 10px 12px 12px;
  border: 1px solid var(--chat-line);
  border-radius: 10px;
  background: color-mix(in srgb, var(--bg-color) 60%, transparent);

  summary {
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
    font-size: 12px;
    font-weight: 700;
    color: var(--chat-text-sub);
    user-select: none;

    &::marker {
      color: var(--brand-color, #2f6f5c);
    }
  }

  .rt-title {
    flex: 0 0 auto;
  }

  .rt-count {
    flex: 0 0 auto;
    padding: 1px 7px;
    border-radius: 99px;
    font-size: 10px;
    font-weight: 600;
    color: var(--brand-color, #2f6f5c);
    background: color-mix(in srgb, var(--brand-color, #2f6f5c) 14%, transparent);
  }

  // 展开动画（details[open] 内容淡入下滑）
  &[open] ol {
    animation: trace-fade-in 0.28s ease both;
  }

  @keyframes trace-fade-in {
    from {
      opacity: 0;
      transform: translateY(-4px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  ol {
    margin: 12px 0 2px;
    padding: 0;
    list-style: none;
  }

  .trace-item {
    --trace-accent: var(--brand-color, #2f6f5c);
    position: relative;
    display: grid;
    grid-template-columns: 22px 1fr;
    gap: 10px;
    padding-bottom: 10px;

    // 时间线连接线（除最后一项外向下延伸）
    &:not(:last-child)::before {
      content: '';
      position: absolute;
      left: 10px;
      top: 22px;
      bottom: 0;
      width: 2px;
      background: color-mix(in srgb, var(--trace-accent) 30%, transparent);
    }
  }

  .trace-node {
    z-index: 1;
    width: 22px;
    height: 22px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    font-size: 12px;
    background: color-mix(in srgb, var(--trace-accent) 16%, transparent);
    border: 1px solid color-mix(in srgb, var(--trace-accent) 45%, transparent);
  }

  .trace-body {
    display: grid;
    gap: 2px;
    font-size: 13px;
    color: var(--chat-text);
    min-width: 0;
  }

  // 各阶段配色
  .trace-safety { --trace-accent: #2f6f5c; }
  .trace-retrieve { --trace-accent: #3b6ea5; }
  .trace-web { --trace-accent: #b07d2b; }
  .trace-decision { --trace-accent: #8a4f9e; }
  .trace-tools { --trace-accent: #5a6b7a; }
  .trace-collect_tool_result,
  .trace-collect { --trace-accent: #4a8a8a; }
  .trace-memory { --trace-accent: #a85d5d; }
  .trace-synthesis { --trace-accent: #c2691d; }

  .trace-phase {
    display: inline-block;
    width: fit-content;
    padding: 1px 8px;
    border-radius: 99px;
    font-size: 11px;
    font-weight: 700;
    color: var(--trace-accent);
    background: color-mix(in srgb, var(--trace-accent) 14%, transparent);
  }

  .trace-label {
    font-weight: 600;
  }

  .trace-detail {
    color: var(--chat-text-sub);
    line-height: 1.5;
    word-break: break-word;
  }
}

.message-meta {
  margin-top: 6px;
  display: flex;
  align-items: center;
  gap: 8px;

  .time {
    color: var(--muted);
    font-size: 11px;
  }

  .status-text {
    color: var(--primary-color);
    font-size: 11px;
  }
}

.retry-button {
  border: none;
  background: transparent;
  color: var(--primary-color);
  font-size: 11px;
  cursor: pointer;
  padding: 0;

  &:hover {
    color: var(--primary-hover);
    text-decoration: underline;
  }

  &:disabled {
    color: var(--muted);
    cursor: not-allowed;
    text-decoration: none;
  }
}

.risk-badge {
  position: absolute;
  top: -10px;
  right: 10px;
  border-radius: 20px;
  padding: 2px 8px;
  font-size: 11px;
  color: #fff;
  font-weight: 600;

  &.low {
    background: var(--risk-low);
  }

  &.medium {
    background: var(--risk-medium);
  }

  &.high {
    background: var(--risk-high);
  }
}

.loading-bubble {
  display: inline-flex;
  gap: 6px;
  align-items: center;

  span {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--primary-color);
    animation: pulse 1.1s infinite ease-in-out;
  }

  span:nth-child(2) {
    animation-delay: 0.12s;
  }

  span:nth-child(3) {
    animation-delay: 0.24s;
  }
}

.input-panel {
  grid-area: composer;
  border-top: 1px solid var(--border-color);
  padding: 14px;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 12px;
  align-items: flex-end;
  background: var(--surface);
}

.send-error {
  grid-column: 1 / -1;
  padding: 10px 12px;
  color: var(--danger);
  background: var(--surface);
  border: 1px solid var(--danger);
  border-radius: 12px;
  font-size: 14px;
  line-height: 1.45;
}

.send-tip {
  grid-area: tip;
  padding: 0 16px 12px;
  color: var(--muted);
  font-size: 12px;
  background: var(--surface);
}

.send-button {
  min-width: 110px;
  height: 42px;
  border: none;
  background: var(--primary-color);
  color: #fff;
  transition:
    transform 0.2s ease,
    background-color 0.2s ease,
    opacity 0.2s ease;

  &:hover {
    transform: translateY(-1px);
    background: var(--primary-hover);
  }

  &:disabled {
    opacity: 0.55;
    transform: none;
  }
}

:deep(.el-textarea__inner) {
  border-radius: 14px;
  border-color: var(--border-color);
  box-shadow: none;
  transition:
    border-color 0.2s ease,
    box-shadow 0.2s ease;

  &:focus {
    border-color: var(--focus);
    box-shadow: 0 0 0 3px var(--primary-soft-bg);
  }
}

.bubble-enter-active,
.bubble-leave-active {
  transition: all 0.25s ease;
}

.bubble-enter-from,
.bubble-leave-to {
  opacity: 0;
  transform: translateY(6px);
}

@keyframes fade-up {
  from {
    opacity: 0;
    transform: translateY(6px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes pulse {
  0%,
  80%,
  100% {
    transform: scale(0.7);
    opacity: 0.45;
  }

  40% {
    transform: scale(1);
    opacity: 1;
  }
}

@media (max-width: 960px) {
  .counseling-container {
    grid-template-columns: 1fr;
    grid-template-areas:
      'chat'
      'composer'
      'tip'
      'info';
    min-height: auto;
  }

  .history-column {
    display: none;
  }

  .info-panel {
    position: static;
    flex: none;
  }

  .chat-panel {
    min-height: 72vh;
  }

  .bubble {
    max-width: 88%;
  }
}
</style>
