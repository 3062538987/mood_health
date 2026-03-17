<template>
  <div class="counseling-chat">
    <!-- 聊天头部 -->
    <div class="chat-header">
      <h3>心理咨询陪伴</h3>
      <p class="subtitle">专业的情绪支持，温暖的心灵陪伴</p>
    </div>

    <!-- 聊天内容区 -->
    <div ref="chatContent" class="chat-content">
      <!-- 系统欢迎消息 -->
      <div v-if="messages.length === 0" class="system-message">
        <div class="message-bubble system">
          <p>
            你好！我是你的心理咨询陪伴助手，很高兴能为你提供支持和倾听。无论你现在是什么心情，我都在这里陪伴你。
          </p>
        </div>
      </div>

      <!-- 对话消息 -->
      <div
        v-for="(message, index) in messages"
        :key="index"
        :class="['message-item', message.role === 'user' ? 'user-message' : 'assistant-message']"
      >
        <div class="message-avatar">
          <img
            v-if="message.role === 'user'"
            src="https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=friendly%20user%20avatar%20portrait&image_size=square"
            alt="用户"
          />
          <img
            v-else
            src="https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=professional%20counselor%20avatar%20portrait&image_size=square"
            alt="助手"
          />
        </div>
        <div class="message-bubble" :class="message.role">
          <p>{{ message.content }}</p>
          <div
            v-if="message.role === 'assistant' && message.riskLevel"
            class="risk-indicator"
            :class="message.riskLevel"
          >
            {{
              message.riskLevel === 'high'
                ? '高风险'
                : message.riskLevel === 'medium'
                  ? '中风险'
                  : '低风险'
            }}
          </div>
        </div>
      </div>

      <!-- 加载状态 -->
      <div v-if="isLoading" class="loading-message">
        <div class="message-avatar">
          <img
            src="https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=professional%20counselor%20avatar%20portrait&image_size=square"
            alt="助手"
          />
        </div>
        <div class="message-bubble assistant">
          <div class="loading-dots">
            <span></span>
            <span></span>
            <span></span>
          </div>
        </div>
      </div>
    </div>

    <!-- 输入区域 -->
    <div class="chat-input-area">
      <el-input
        v-model="inputMessage"
        type="textarea"
        :rows="2"
        placeholder="请输入你的心情或问题..."
        :disabled="isLoading"
        @keyup.enter.exact="sendMessage"
      />
      <el-button
        type="primary"
        :loading="isLoading"
        :disabled="!inputMessage.trim() || isLoading"
        @click="sendMessage"
      >
        发送
      </el-button>
    </div>

    <!-- 安全提示 -->
    <div class="safety-tip">
      <el-icon><Warning /></el-icon>
      <p>温馨提示：本服务仅提供心理支持，不能替代专业医疗诊断和治疗</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch, nextTick } from 'vue'
import { ElMessage } from 'element-plus'
import { Warning } from '@element-plus/icons-vue'
import { sendCounselingMessage } from '@/api/counseling'

// 定义消息类型
interface Message {
  role: 'user' | 'assistant'
  content: string
  riskLevel?: 'low' | 'medium' | 'high'
}

// 响应式数据
const messages = ref<Message[]>([])
const inputMessage = ref('')
const isLoading = ref(false)
const chatContent = ref<HTMLElement | null>(null)

// 滚动到底部
const scrollToBottom = async () => {
  await nextTick()
  if (chatContent.value) {
    chatContent.value.scrollTop = chatContent.value.scrollHeight
  }
}

// 监听消息变化，自动滚动到底部
watch(
  messages,
  () => {
    scrollToBottom()
  },
  { deep: true }
)

// 发送消息
const sendMessage = async () => {
  const message = inputMessage.value.trim()
  if (!message || isLoading.value) return

  // 添加用户消息
  messages.value.push({
    role: 'user',
    content: message,
  })

  inputMessage.value = ''
  isLoading.value = true

  try {
    // 构建上下文
    const context = messages.value.map((msg) => ({
      role: msg.role,
      content: msg.content,
    }))

    // 调用API
    const response = await sendCounselingMessage({
      message,
      context: context.slice(-10), // 只保留最近10条消息作为上下文
    })

    // 添加助手回复
    messages.value.push({
      role: 'assistant',
      content: response.response,
      riskLevel: response.riskLevel,
    })

    // 如果有风险提示，显示额外信息
    if (response.hasRiskContent && response.suggestion) {
      ElMessage({
        message: response.suggestion,
        type: 'warning',
        duration: 5000,
      })
    }
  } catch (error: any) {
    ElMessage({
      message: error.message || '发送失败，请稍后重试',
      type: 'error',
    })
  } finally {
    isLoading.value = false
  }
}

// 组件挂载时的初始化
onMounted(() => {
  // 可以在这里添加初始化逻辑
  scrollToBottom()
})
</script>

<style scoped lang="scss">
.counseling-chat {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background-color: #f5f7fa;
  border-radius: 8px;
  box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.1);

  .chat-header {
    padding: 20px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    border-radius: 8px 8px 0 0;

    h3 {
      margin: 0 0 5px 0;
      font-size: 18px;
      font-weight: 600;
    }

    .subtitle {
      margin: 0;
      font-size: 14px;
      opacity: 0.9;
    }
  }

  .chat-content {
    flex: 1;
    padding: 20px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 16px;

    // 滚动条样式
    &::-webkit-scrollbar {
      width: 6px;
    }

    &::-webkit-scrollbar-track {
      background: #f1f1f1;
      border-radius: 3px;
    }

    &::-webkit-scrollbar-thumb {
      background: #c1c1c1;
      border-radius: 3px;
    }

    &::-webkit-scrollbar-thumb:hover {
      background: #a8a8a8;
    }

    .system-message {
      display: flex;
      justify-content: center;
      margin-bottom: 20px;

      .message-bubble {
        max-width: 80%;
        background-color: #e6f7ff;
        color: #1890ff;
        border: 1px solid #91d5ff;
      }
    }

    .message-item {
      display: flex;
      gap: 12px;

      &.user-message {
        flex-direction: row-reverse;
      }

      .message-avatar {
        width: 40px;
        height: 40px;
        flex-shrink: 0;

        img {
          width: 100%;
          height: 100%;
          border-radius: 50%;
          object-fit: cover;
        }
      }

      .message-bubble {
        max-width: 70%;
        padding: 12px 16px;
        border-radius: 18px;
        position: relative;
        word-wrap: break-word;
        line-height: 1.4;

        &.user {
          background-color: #667eea;
          color: white;
          border-bottom-right-radius: 4px;
        }

        &.assistant {
          background-color: white;
          color: #333;
          border: 1px solid #e8e8e8;
          border-bottom-left-radius: 4px;
        }

        .risk-indicator {
          position: absolute;
          top: -8px;
          right: 10px;
          font-size: 10px;
          padding: 2px 6px;
          border-radius: 10px;
          font-weight: 500;

          &.high {
            background-color: #ff4d4f;
            color: white;
          }

          &.medium {
            background-color: #faad14;
            color: white;
          }

          &.low {
            background-color: #52c41a;
            color: white;
          }
        }
      }

      .loading-message {
        display: flex;
        gap: 12px;

        .loading-dots {
          display: flex;
          gap: 4px;

          span {
            width: 8px;
            height: 8px;
            background-color: #667eea;
            border-radius: 50%;
            animation: loading 1.4s ease-in-out infinite both;

            &:nth-child(1) {
              animation-delay: -0.32s;
            }

            &:nth-child(2) {
              animation-delay: -0.16s;
            }
          }
        }
      }
    }
  }

  .chat-input-area {
    padding: 20px;
    background-color: white;
    border-top: 1px solid #e8e8e8;
    display: flex;
    gap: 12px;
    align-items: flex-end;

    .el-input {
      flex: 1;

      textarea {
        resize: none;
        border-radius: 8px;
      }
    }

    .el-button {
      align-self: flex-end;
      height: 40px;
      border-radius: 8px;
    }
  }

  .safety-tip {
    padding: 12px 20px;
    background-color: #fff7e6;
    border-top: 1px solid #ffd591;
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;
    color: #fa8c16;

    .el-icon {
      font-size: 14px;
    }

    p {
      margin: 0;
    }
  }
}

@keyframes loading {
  0%,
  80%,
  100% {
    transform: scale(0);
  }
  40% {
    transform: scale(1);
  }
}
</style>
