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

        <div class="recommendation-section">
          <h4>建议</h4>
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
          <button class="btn ai-btn" :disabled="aiLoading" @click="loadAiInterpretation">
            {{ aiLoading ? 'AI 分析中...' : aiContent ? '刷新 AI 解读' : 'AI 智能解读' }}
          </button>
        </div>

        <div v-if="aiContent" class="ai-section">
          <h4>AI 智能解读</h4>
          <div class="ai-content" v-html="aiContentHtml"></div>
          <p class="ai-disclaimer">以上内容由 AI 生成，仅供参考，不构成医疗建议。</p>
        </div>
        <div v-else-if="aiError" class="ai-error">
          <p>{{ aiError }}</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { getInterpretation } from '@/api/ai'
import { ElMessage } from 'element-plus'

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
const scaleType = ref(route.query.type ? (route.query.type as string) : 'phq-9')
const aiContent = ref('')
const aiError = ref('')
const aiLoading = ref(false)

const aiContentHtml = computed(() => {
  return aiContent.value
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br>')
    .replace(/^(.+)$/gm, (_, p1) => (p1 ? `<p>${p1}</p>` : ''))
    .replace(/<\/p><p>/g, '</p><p>')
})

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

const loadAiInterpretation = async () => {
  aiLoading.value = true
  aiError.value = ''
  try {
    const numScore = Number(score.value)
    const maxScore = scaleType.value === 'gad-7' ? 21 : 27
    const res = await getInterpretation({
      scaleName: title.value,
      scaleType: scaleType.value,
      totalScore: numScore,
      maxScore,
      itemScores: [],
      riskLevel:
        numScore >= (scaleType.value === 'gad-7' ? 15 : 20)
          ? 'high'
          : numScore >= (scaleType.value === 'gad-7' ? 10 : 15)
            ? 'moderate'
            : numScore >= (scaleType.value === 'gad-7' ? 5 : 5)
              ? 'mild'
              : 'low',
    })
    aiContent.value = res.content
    ElMessage.success('AI 解读生成成功')
  } catch (error: any) {
    aiError.value = error?.response?.data?.message || 'AI 解读暂不可用，请稍后重试'
    ElMessage.warning(aiError.value)
  } finally {
    aiLoading.value = false
  }
}

onMounted(() => {
  // 如果没有结果数据，跳回列表页
  if (!result.value) {
    router.push('/improve/questionnaire')
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
        border-radius: $border-radius-full;
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
        background-color: $bg-light;
        border-radius: $border-radius-md;
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
      .ai-btn {
        background-color: #7c4dff;
        border-color: #7c4dff;
        color: $white;
        &:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
      }
    }
  }
}

.ai-section {
  margin-top: 24px;
  padding: 20px;
  background: linear-gradient(135deg, #f5f0ff 0%, #ede7f6 100%);
  border-radius: $border-radius-md;
  border: 1px solid #d1c4e9;
  text-align: left;

  h4 {
    margin-bottom: 12px;
    color: #5e35b1;
  }

  .ai-content {
    line-height: 1.8;
    color: $text-color;
    font-size: $font-size-md;

    :deep(p) {
      margin-bottom: 8px;
    }
  }

  .ai-disclaimer {
    margin-top: 12px;
    font-size: $font-size-sm;
    color: $text-light-color;
    font-style: italic;
  }
}

.ai-error {
  margin-top: 16px;
  padding: 12px;
  background-color: #fff3e0;
  border-radius: $border-radius-md;
  color: #e65100;
  font-size: $font-size-sm;
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
</style>
