<template>
  <div class="counseling-page">
    <div class="page-header">
      <h1>心理咨询陪伴</h1>
      <p class="description">专业支持，温柔陪伴，和你一起慢慢变好</p>
    </div>

    <div class="counseling-container">
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
            <li>支持多轮对话与连续陪伴</li>
          </ul>
        </section>

        <section class="contact-info">
          <h3>紧急联系</h3>
          <p>如出现强烈自伤或伤人风险，请立刻联系专业机构：</p>
          <p class="emergency-number">全国心理危机干预热线：400-161-9995</p>
        </section>
      </aside>

      <section class="chat-panel">
        <header class="chat-header">
          <h2>今日对话</h2>
          <p>你说的话会被认真对待，请放心表达。</p>
        </header>

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
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { sendCounselingMessage } from '@/api/counseling'
import { useUserStore } from '@/stores/userStore'

type RiskLevel = 'low' | 'medium' | 'high'
type MessageStatus = 'sending' | 'sent' | 'failed'

interface MessageItem {
  id: string
  role: 'user' | 'assistant'
  content: string
  createdAt: string
  status?: MessageStatus
  riskLevel?: RiskLevel
}

const userStore = useUserStore()
const inputMessage = ref('')
const isSending = ref(false)
const messageContainerRef = ref<HTMLElement | null>(null)
const messages = ref<MessageItem[]>([
  {
    id: crypto.randomUUID(),
    role: 'assistant',
    content:
      '你好，欢迎来到心理咨询陪伴空间。你可以和我聊聊今天让你最在意的一件事，我们一步一步来。',
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
})

const formatTime = (isoTime: string): string => {
  const date = new Date(isoTime)
  const hour = `${date.getHours()}`.padStart(2, '0')
  const minute = `${date.getMinutes()}`.padStart(2, '0')
  return `${hour}:${minute}`
}

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

const sendToService = async (targetUserMessage: MessageItem, inputSnapshot: string) => {
  const context = buildContext(targetUserMessage.id)

  const result = await sendCounselingMessage({
    message: targetUserMessage.content,
    context,
    userId: userStore.user?.id,
  })

  targetUserMessage.status = 'sent'

  messages.value.push({
    id: crypto.randomUUID(),
    role: 'assistant',
    content: result.response,
    riskLevel: result.riskLevel,
    createdAt: new Date().toISOString(),
  })

  if (result.hasRiskContent && result.suggestion) {
    ElMessage.warning(result.suggestion)
  }

  if (inputMessage.value.trim() === inputSnapshot.trim()) {
    inputMessage.value = ''
  }
}

const sendMessage = async () => {
  if (!canSend.value || isSending.value) {
    return
  }

  const inputSnapshot = inputMessage.value
  const content = inputSnapshot.trim()

  const newUserMessage: MessageItem = {
    id: crypto.randomUUID(),
    role: 'user',
    content,
    status: 'sending',
    createdAt: new Date().toISOString(),
  }

  messages.value.push(newUserMessage)

  isSending.value = true

  try {
    await sendToService(newUserMessage, inputSnapshot)
  } catch (error: unknown) {
    newUserMessage.status = 'failed'
    const message = error instanceof Error ? error.message : '发送失败，请稍后再试'
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
  target.status = 'sending'

  try {
    await sendToService(target, inputMessage.value)
  } catch (error: unknown) {
    target.status = 'failed'
    const message = error instanceof Error ? error.message : '重试失败，请稍后再试'
    ElMessage.error(message)
  } finally {
    isSending.value = false
  }
}
</script>

<style scoped lang="scss">
.counseling-page {
  --bg-soft: #fff8fc;
  --bg-soft-2: #f6f1ff;
  --panel: rgba(255, 255, 255, 0.88);
  --line: #e9ddf6;
  --text-main: #4f4a5a;
  --text-sub: #7d748f;
  --primary: #b996d8;
  --primary-strong: #a57dca;
  --assistant-bubble: #ffffff;
  --user-bubble: #f0ddff;

  min-height: 100vh;
  padding: 20px;
  background:
    radial-gradient(circle at 10% 10%, rgba(255, 226, 239, 0.6), transparent 40%),
    radial-gradient(circle at 90% 20%, rgba(221, 223, 255, 0.55), transparent 40%),
    linear-gradient(145deg, var(--bg-soft), var(--bg-soft-2));
}

.page-header {
  text-align: center;
  margin-bottom: 20px;

  h1 {
    margin: 0;
    font-size: 30px;
    color: var(--text-main);
    letter-spacing: 1px;
  }

  .description {
    margin-top: 8px;
    color: var(--text-sub);
  }
}

.counseling-container {
  max-width: 1300px;
  margin: 0 auto;
  min-height: calc(100vh - 140px);
  display: flex;
  gap: 20px;
}

.info-panel {
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
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: 16px;
  padding: 16px;
  backdrop-filter: blur(4px);
  box-shadow: 0 10px 26px rgba(164, 132, 197, 0.12);

  h3 {
    margin: 0 0 10px;
    color: var(--text-main);
    font-size: 16px;
  }

  p,
  li {
    color: var(--text-sub);
    line-height: 1.7;
    font-size: 14px;
  }

  ul {
    margin: 0;
    padding-left: 18px;
  }
}

.contact-info .emergency-number {
  color: #9d5f87;
  font-weight: 600;
}

.chat-panel {
  min-width: 0;
  flex: 1;
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: 20px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: 0 16px 38px rgba(146, 110, 182, 0.15);
}

.chat-header {
  padding: 16px 20px;
  border-bottom: 1px solid var(--line);
  background: linear-gradient(90deg, rgba(248, 228, 255, 0.95), rgba(237, 240, 255, 0.95));

  h2 {
    margin: 0;
    color: var(--text-main);
    font-size: 18px;
  }

  p {
    margin: 6px 0 0;
    color: var(--text-sub);
    font-size: 13px;
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
    color: var(--text-main);
    font-size: 14px;
  }

  &.assistant {
    background: var(--assistant-bubble);
    border: 1px solid #ece3f5;
    border-top-left-radius: 6px;
  }

  &.user {
    background: var(--user-bubble);
    border: 1px solid #dcc2f1;
    border-top-right-radius: 6px;
  }
}

.message-meta {
  margin-top: 6px;
  display: flex;
  align-items: center;
  gap: 8px;

  .time {
    color: #9a91aa;
    font-size: 11px;
  }

  .status-text {
    color: #a283c1;
    font-size: 11px;
  }
}

.retry-button {
  border: none;
  background: transparent;
  color: #a56ecf;
  font-size: 11px;
  cursor: pointer;
  padding: 0;

  &:hover {
    color: #8b54b6;
    text-decoration: underline;
  }

  &:disabled {
    color: #c8b7d9;
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

  &.low {
    background: #7cb680;
  }

  &.medium {
    background: #d2a35f;
  }

  &.high {
    background: #cf6b7f;
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
    background: var(--primary-strong);
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
  border-top: 1px solid var(--line);
  padding: 14px;
  display: flex;
  gap: 12px;
  align-items: flex-end;
  background: #fff;
}

.send-tip {
  padding: 0 16px 12px;
  color: #9a90a9;
  font-size: 12px;
  background: #fff;
}

.send-button {
  min-width: 110px;
  height: 42px;
  border: none;
  background: linear-gradient(120deg, var(--primary), var(--primary-strong));
  color: #fff;
  transition:
    transform 0.2s ease,
    filter 0.2s ease,
    opacity 0.2s ease;

  &:hover {
    transform: translateY(-1px);
    filter: brightness(1.03);
  }

  &:disabled {
    opacity: 0.55;
    transform: none;
    filter: grayscale(0.08);
  }
}

:deep(.el-textarea__inner) {
  border-radius: 14px;
  border-color: #e1d0ef;
  box-shadow: none;
  transition:
    border-color 0.2s ease,
    box-shadow 0.2s ease;

  &:focus {
    border-color: var(--primary);
    box-shadow: 0 0 0 3px rgba(185, 150, 216, 0.16);
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
    flex-direction: column;
    min-height: auto;
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
