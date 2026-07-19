<template>
  <div class="questionnaire-result">
    <div class="container">
      <h2>筛查结果</h2>

      <div class="result-card card">
        <h3>{{ title }}</h3>
        <div v-if="testDate" class="test-date">测评时间：{{ testDate }}</div>
        <div class="score-section">
          <div class="score-circle">
            <span class="score-number">{{ score }}</span>
          </div>
          <div class="score-label">您的得分</div>
        </div>

        <div class="result-section">
          <h4>筛查提示</h4>
          <p class="result-text">{{ result }}</p>
          <p class="screening-disclaimer">
            本结果仅用于自我筛查与风险提示，不构成医学诊断，也不能替代专业评估。
          </p>
        </div>

        <!-- AI 解读区域 -->
        <div class="ai-interpretation" v-if="aiContent">
          <div class="ai-header">
            <span class="ai-badge">AI 生成</span>
            <span class="ai-time" v-if="aiGeneratedAt">{{ aiGeneratedAt }}</span>
          </div>
          <div class="ai-content">{{ aiContent }}</div>
        </div>

        <!-- AI 加载骨架 -->
        <div class="ai-interpretation loading" v-if="aiLoading">
          <div class="skeleton-line"></div>
          <div class="skeleton-line short"></div>
          <div class="skeleton-line medium"></div>
          <p class="loading-text">正在生成个性化解读...</p>
        </div>

        <div class="recommendation-section" v-if="showFallback">
          <h4>建议</h4>
          <p class="ai-fallback-notice" v-if="aiFailed">AI 解读暂时不可用，展示通用建议</p>
          <ul class="recommendations">
            <li>保持规律的作息时间，保证充足的睡眠</li>
            <li>适当进行体育锻炼，如散步、瑜伽等</li>
            <li>多与朋友和家人交流，分享自己的感受</li>
            <li>学习一些放松技巧，如深呼吸、冥想等</li>
            <li>如果困扰持续或加重，建议寻求学校心理中心或专业人员的帮助</li>
          </ul>
        </div>

        <div class="action-buttons">
          <button class="btn secondary" @click="backToList">返回量表列表</button>
          <button class="btn primary" @click="retryAssessment">重新测试</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { getAIInterpretation } from '@/api/questionnaire'

const router = useRouter()
const route = useRoute()

// 格式化日期
const formatDate = (dateString: string) => {
  const date = new Date(dateString)
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const title = ref(route.query.title ? decodeURIComponent(route.query.title as string) : '心理测评')
const score = ref(route.query.score ? (route.query.score as string) : '0')
const result = ref(route.query.result ? decodeURIComponent(route.query.result as string) : '')
const testDate = ref(route.query.date ? formatDate(route.query.date as string) : '')

// AI 解读相关状态
const aiContent = ref('')
const aiGeneratedAt = ref('')
const aiLoading = ref(false)
const aiFailed = ref(false)

const showFallback = computed(() => !aiContent.value && !aiLoading.value)

// 返回量表列表
const backToList = () => {
  router.push('/improve/questionnaire')
}

// 重新测试
const retryAssessment = () => {
  // 这里应该根据实际情况跳转到对应的量表页面
  // 暂时返回列表页
  router.push('/improve/questionnaire')
}

// 直接访问时请求 AI 解读
const fetchAIInterpretation = async () => {
  try {
    const scaleType = title.value || 'GAD-7'
    const totalScore = Number(score.value) || 0
    const resultText = decodeURIComponent(result.value as string)
    const res = await getAIInterpretation({
      scaleType,
      totalScore,
      itemScores: [],
      resultText,
    })
    aiContent.value = res.content || ''
    aiGeneratedAt.value = res.generatedAt || ''
  } catch {
    aiFailed.value = true
  } finally {
    aiLoading.value = false
  }
}

onMounted(() => {
  // 如果没有结果数据，跳回列表页
  if (!result.value) {
    router.push('/improve/questionnaire')
  }

  // 处理 AI 解读相关 query 参数
  const aiContentParam = route.query.aiContent
  const aiGeneratedAtParam = route.query.aiGeneratedAt
  const aiFailedParam = route.query.aiFailed

  if (aiContentParam) {
    aiContent.value = decodeURIComponent(aiContentParam as string)
    aiGeneratedAt.value = aiGeneratedAtParam
      ? decodeURIComponent(aiGeneratedAtParam as string)
      : ''
  } else if (aiFailedParam === 'true') {
    aiFailed.value = true
  } else if (!aiContentParam && !aiFailedParam) {
    // 从直接链接进入，没有 AI 结果，尝试请求
    aiLoading.value = true
    fetchAIInterpretation()
  }
})
</script>

<style scoped lang="scss">
@use '@/assets/styles/theme.scss' as *;

.questionnaire-result {
  padding: 20px;
  .container {
    max-width: 800px;
    margin: 0 auto;
  }
  h2 {
    text-align: center;
    margin-bottom: 30px;
    color: $primary-color;
  }

  .result-card {
    text-align: center;
    padding: 30px;
    h3 {
      margin-bottom: 10px;
      color: $text-color;
    }
    .test-date {
      color: $text-light-color;
      font-size: $font-size-sm;
      margin-bottom: 20px;
    }

    // 得分部分
    .score-section {
      margin-bottom: 30px;
      .score-circle {
        width: 120px;
        height: 120px;
        border-radius: 50%;
        background-color: $primary-color;
        display: flex;
        align-items: center;
        justify-content: center;
        margin: 0 auto 16px;
        .score-number {
          font-size: 36px;
          font-weight: 700;
          color: $white;
        }
      }
      .score-label {
        font-size: $font-size-lg;
        color: $text-color;
        font-weight: 500;
      }
    }

    // 结果部分
    .result-section {
      margin-bottom: 30px;
      text-align: left;
      h4 {
        margin-bottom: 12px;
        color: $text-color;
      }
      .result-text {
        padding: 16px;
        background-color: $bg-warm;
        border-radius: $radius-md;
        line-height: 1.6;
        color: $text-light-color;
      }
      .screening-disclaimer {
        margin-top: 12px;
        color: $text-light-color;
        font-size: $font-size-sm;
        line-height: 1.6;
      }
    }

    // 建议部分
    .recommendation-section {
      margin-bottom: 30px;
      text-align: left;
      h4 {
        margin-bottom: 12px;
        color: $text-color;
      }
      .recommendations {
        list-style: none;
        padding: 0;
        li {
          padding: 8px 0;
          padding-left: 20px;
          position: relative;
          color: $text-light-color;
          &::before {
            content: '•';
            color: $primary-color;
            font-weight: bold;
            position: absolute;
            left: 0;
          }
        }
      }
    }

    // 操作按钮
    .action-buttons {
      display: flex;
      gap: 16px;
      justify-content: center;
      .btn {
        min-width: 120px;
      }
    }
  }
}

@media (max-width: 768px) {
  .questionnaire-result {
    padding: 15px;
    .result-card {
      padding: 20px;
      .action-buttons {
        flex-direction: column;
        .btn {
          width: 100%;
        }
      }
    }
  }
}

// AI 解读样式
.ai-interpretation {
  margin-top: 24px;
  padding: 20px;
  background: linear-gradient(135deg, #f0f4ff 0%, #faf5ff 100%);
  border-radius: 16px;
  border: 1px solid #e0d4ff;
  text-align: left;
}

.ai-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.ai-badge {
  display: inline-block;
  padding: 2px 10px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #fff;
  font-size: 12px;
  border-radius: 10px;
  font-weight: 500;
}

.ai-time {
  font-size: 12px;
  color: #999;
}

.ai-content {
  font-size: 15px;
  line-height: 1.8;
  color: #333;
  white-space: pre-wrap;
}

.ai-interpretation.loading {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.skeleton-line {
  height: 14px;
  background: linear-gradient(90deg, #e0e0e0 25%, #f0f0f0 50%, #e0e0e0 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
  border-radius: 4px;
  width: 100%;
}

.skeleton-line.short { width: 60%; }
.skeleton-line.medium { width: 80%; }

@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

.loading-text {
  font-size: 13px;
  color: #999;
  text-align: center;
  margin-top: 8px;
}

.ai-fallback-notice {
  font-size: 12px;
  color: #f0a060;
  text-align: center;
  margin-bottom: 12px;
  padding: 6px 12px;
  background: #fff8f0;
  border-radius: 8px;
}
</style>
