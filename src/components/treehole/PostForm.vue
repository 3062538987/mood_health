<template>
  <div class="create-post card">
    <h2>分享你的心事</h2>
    <div class="form-group">
      <input v-model="newPost.title" placeholder="标题" />
    </div>
    <div class="form-group">
      <textarea
        v-model="newPost.content"
        placeholder="在这里倾诉你的心事，树洞会给你一个温柔的回复..."
        rows="4"
        :maxlength="1000"
        @input="handleContentInput"
      ></textarea>
      <div class="content-hint">
        <span class="char-count">{{ newPost.content.length }}/1000</span>
        <span v-if="sensitiveWarning" class="sensitive-warning">
          <i class="fas fa-exclamation-triangle"></i>
          {{ sensitiveWarning }}
        </span>
      </div>
    </div>
    <div class="form-group checkbox-group">
      <label class="checkbox-label">
        <input v-model="newPost.isAnonymous" type="checkbox" />
        <span>匿名发布</span>
      </label>
    </div>

    <!-- 温柔回复区域 -->
    <div v-if="gentleReply" class="gentle-reply-section">
      <div class="reply-header">
        <i class="fas fa-heart"></i>
        <span>树洞的温柔回复</span>
        <span v-if="isFallback" class="fallback-badge">暖心陪伴</span>
      </div>
      <div class="reply-content">
        {{ gentleReply }}
      </div>
    </div>

    <!-- 加载状态 -->
    <div v-if="isLoading" class="loading-section">
      <div class="loading-animation">
        <div class="heart-loader">
          <div class="heart"></div>
          <div class="heart"></div>
          <div class="heart"></div>
        </div>
        <p class="loading-text">树洞正在倾听你的心事...</p>
        <p class="loading-subtext">请稍等片刻，一份温柔的回复正在路上</p>
      </div>
    </div>

    <button
      class="btn primary"
      :disabled="isLoading || !isValid"
      :class="{ 'btn-loading': isLoading }"
      @click="submitPost"
    >
      <span v-if="isLoading">
        <i class="fas fa-spinner fa-spin"></i>
        生成回复中...
      </span>
      <span v-else>发布并获取温柔回复</span>
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { ElMessage } from 'element-plus'
import type { CreatePostData } from '@/types/post'
import { validateTreeHoleContent, checkSensitiveContent } from '@/api/treehole'

const newPost = ref<CreatePostData>({
  title: '',
  content: '',
  isAnonymous: false,
})

const isLoading = ref(false)
const gentleReply = ref('')
const isFallback = ref(false)
const sensitiveWarning = ref('')

const localReplyPool = [
  '谢谢你愿意说出来。先深呼吸一下，你已经很勇敢了。',
  '你正在经历的感受很真实，也很值得被认真对待。',
  '慢一点也没有关系，先照顾好自己，再去处理事情。',
  '今天已经很不容易了，允许自己先休息一会儿。',
  '你并不孤单，很多人也在和类似的压力做斗争。',
  '把问题拆小，一步一步来，你会比想象中更稳。',
  '情绪有起伏很正常，给自己一点耐心和温柔。',
  '无论今天怎样，明天都可以是一个新的开始。',
]

const getLocalGentleReply = () => {
  const index = Math.floor(Math.random() * localReplyPool.length)
  return localReplyPool[index]
}

const emit = defineEmits<{
  (e: 'submit', post: CreatePostData): void
}>()

/**
 * 表单是否有效
 */
const isValid = computed(() => {
  return newPost.value.title.trim() && newPost.value.content.trim() && !sensitiveWarning.value
})

/**
 * 处理内容输入
 * 实时检查敏感词
 */
const handleContentInput = () => {
  const content = newPost.value.content

  if (checkSensitiveContent(content)) {
    sensitiveWarning.value = '内容包含敏感信息，请修改后重试'
  } else {
    sensitiveWarning.value = ''
  }
}

/**
 * 发布帖子并获取温柔回复
 */
const submitPost = async () => {
  // 表单验证
  if (!newPost.value.title.trim() || !newPost.value.content.trim()) {
    ElMessage.warning('标题和内容不能为空')
    return
  }

  // 敏感词检查
  if (sensitiveWarning.value) {
    ElMessage.warning(sensitiveWarning.value)
    return
  }

  // 内容验证
  const validationError = validateTreeHoleContent(newPost.value.content)
  if (validationError) {
    ElMessage.warning(validationError)
    return
  }

  isLoading.value = true
  gentleReply.value = ''
  isFallback.value = false

  try {
    // AI 下线后使用本地温柔文案，避免依赖外部服务
    gentleReply.value = getLocalGentleReply()
    isFallback.value = true

    // 触发提交事件
    emit('submit', newPost.value)

    // 重置表单
    newPost.value = { title: '', content: '', isAnonymous: false }
    sensitiveWarning.value = ''

    // 显示成功提示
    ElMessage.success('发布成功！树洞给你回复了温暖的话语')
  } catch (error: any) {
    console.error('发布失败:', error)
    ElMessage.error(error.message || '发布失败，请稍后重试')
  } finally {
    isLoading.value = false
  }
}
</script>

<style scoped lang="scss">
@use 'sass:color';
@use '@/assets/styles/theme.scss' as *;

.create-post {
  margin-bottom: 30px;
  background-color: $white;
  padding: 24px;
  border-radius: 12px;
  box-shadow: $shadow-sm;

  h2 {
    color: $text-color;
    margin-bottom: 20px;
    font-size: $font-size-xl;
    font-weight: 600;
  }

  .form-group {
    margin-bottom: 20px;

    input,
    textarea {
      width: 100%;
      padding: 12px 16px;
      border: 1px solid $border-color;
      border-radius: 8px;
      font-size: $font-size-md;
      transition: all 0.3s ease;
      background: rgba(255, 255, 255, 0.8);

      &:focus {
        outline: none;
        border-color: $primary-color;
        box-shadow: 0 0 0 3px rgba($primary-color, 0.1);
      }

      &::placeholder {
        color: $text-light-color;
      }
    }

    textarea {
      resize: vertical;
      min-height: 120px;
      font-family: inherit;
      line-height: 1.6;
    }

    .content-hint {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-top: 8px;
      font-size: $font-size-sm;

      .char-count {
        color: $text-light-color;
      }

      .sensitive-warning {
        color: #f56c6c;
        display: flex;
        align-items: center;
        gap: 4px;

        i {
          font-size: 12px;
        }
      }
    }
  }

  .checkbox-group {
    .checkbox-label {
      display: flex;
      align-items: center;
      gap: 8px;
      cursor: pointer;
      color: $text-color;
      font-size: $font-size-md;

      input[type='checkbox'] {
        width: auto;
        margin: 0;
      }

      span {
        user-select: none;
      }
    }
  }

  // 温柔回复区域
  .gentle-reply-section {
    margin: 24px 0;
    padding: 20px;
    background: linear-gradient(135deg, #fff5f5 0%, #fff0f6 100%);
    border-radius: 12px;
    border-left: 4px solid $primary-color;
    animation: fadeIn 0.5s ease;

    .reply-header {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 12px;
      font-weight: 600;
      color: $primary-color;

      i {
        color: #ff6b6b;
        animation: heartbeat 1.5s ease-in-out infinite;
      }

      .fallback-badge {
        margin-left: auto;
        padding: 2px 8px;
        background: rgba($primary-color, 0.1);
        color: $primary-color;
        font-size: $font-size-xs;
        border-radius: 12px;
        font-weight: normal;
      }
    }

    .reply-content {
      color: $text-color;
      line-height: 1.8;
      font-size: $font-size-md;
      white-space: pre-wrap;
    }
  }

  // 加载状态
  .loading-section {
    margin: 24px 0;
    padding: 40px 20px;
    background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
    border-radius: 12px;
    text-align: center;

    .loading-animation {
      .heart-loader {
        display: flex;
        justify-content: center;
        gap: 12px;
        margin-bottom: 20px;

        .heart {
          width: 20px;
          height: 20px;
          background: #ff6b6b;
          position: relative;
          transform: rotate(-45deg);
          animation: heart-beat 1.2s ease-in-out infinite;

          &::before,
          &::after {
            content: '';
            width: 20px;
            height: 20px;
            position: absolute;
            background: #ff6b6b;
            border-radius: 50%;
          }

          &::before {
            top: -10px;
            left: 0;
          }

          &::after {
            left: 10px;
            top: 0;
          }

          &:nth-child(2) {
            animation-delay: 0.2s;
            background: #ff8e8e;
            &::before,
            &::after {
              background: #ff8e8e;
            }
          }

          &:nth-child(3) {
            animation-delay: 0.4s;
            background: #ffb4b4;
            &::before,
            &::after {
              background: #ffb4b4;
            }
          }
        }
      }

      .loading-text {
        font-size: $font-size-lg;
        color: $text-color;
        font-weight: 500;
        margin-bottom: 8px;
      }

      .loading-subtext {
        font-size: $font-size-sm;
        color: $text-light-color;
      }
    }
  }

  button {
    width: 100%;
    background: linear-gradient(
      135deg,
      $primary-color,
      color.adjust($primary-color, $lightness: -8%)
    );
    color: $white;
    border: none;
    padding: 14px 24px;
    border-radius: 8px;
    cursor: pointer;
    font-size: $font-size-md;
    font-weight: 600;
    transition: all 0.3s ease;
    box-shadow: 0 4px 12px rgba($primary-color, 0.3);

    &:hover:not(:disabled) {
      transform: translateY(-2px);
      box-shadow: 0 6px 20px rgba($primary-color, 0.4);
    }

    &:disabled {
      opacity: 0.6;
      cursor: not-allowed;
      transform: none;
    }

    &.btn-loading {
      background: linear-gradient(135deg, #909399, #a6a9ad);
      box-shadow: none;
    }

    i {
      margin-right: 8px;
    }
  }
}

// 动画
@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes heartbeat {
  0%,
  100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.1);
  }
}

@keyframes heart-beat {
  0%,
  100% {
    transform: rotate(-45deg) scale(1);
  }
  50% {
    transform: rotate(-45deg) scale(1.1);
  }
}

@media (max-width: 768px) {
  .create-post {
    padding: 16px;

    .gentle-reply-section,
    .loading-section {
      padding: 16px;
    }
  }
}
</style>
