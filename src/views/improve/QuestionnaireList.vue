<template>
  <div class="questionnaire-list">
    <div class="container">
      <h2>心理筛查问卷</h2>
      <p class="description">
        以下问卷仅用于自我筛查与风险提示，不提供医学诊断或治疗结论。
      </p>

      <!-- 历史记录入口 -->
      <div class="history-link" @click="goToHistory">
        <span class="history-icon">📋</span>
        <span>查看测评历史</span>
      </div>

      <SoftLoadingState
        v-if="isLoading"
        variant="cards"
        :item-count="3"
        title="正在加载问卷"
        description="正在同步问卷列表和你的历史记录，请稍等。"
      />

      <div v-else-if="listError" class="state-panel error-panel" role="alert">
        <h3>问卷列表加载失败</h3>
        <p>{{ listError }}</p>
        <button type="button" class="retry-btn" @click="loadQuestionnairePage">重试</button>
      </div>

      <SoftEmptyState
        v-else-if="questionnaires.length === 0"
        title="暂无可用问卷"
        description="当前没有开放的问卷。你可以稍后回来查看新的筛查内容。"
        action-text="重新加载"
        compact
        @action="loadQuestionnairePage"
      />

      <div v-else class="questionnaire-cards">
        <div v-if="historyWarning" class="history-warning" role="status" aria-live="polite">
          {{ historyWarning }}
        </div>

        <div
          v-for="questionnaire in questionnaires"
          :key="questionnaire.id"
          class="questionnaire-card card"
          :class="{ completed: completedIds.includes(questionnaire.id) }"
          @click="startAssessment(questionnaire.id)"
        >
          <div class="card-header">
            <h3>{{ questionnaire.title }}</h3>
            <span v-if="completedIds.includes(questionnaire.id)" class="completed-badge">
              ✓ 已填写
            </span>
          </div>
          <p>{{ questionnaire.description }}</p>
          <button class="btn primary">
            {{ completedIds.includes(questionnaire.id) ? '重新测试' : '开始测试' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import SoftEmptyState from '@/components/shared/SoftEmptyState.vue'
import SoftLoadingState from '@/components/shared/SoftLoadingState.vue'

import { getQuestionnaires, getAssessmentHistory, Questionnaire } from '@/api/questionnaire'

const router = useRouter()
const questionnaires = ref<Questionnaire[]>([])
const completedIds = ref<number[]>([])
const isLoading = ref(true)
const listError = ref('')
const historyWarning = ref('')

const getErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error && error.message ? error.message : fallback

// 页面级加载：问卷列表是阻断数据，历史记录只影响完成标记
const loadQuestionnairePage = async () => {
  isLoading.value = true
  listError.value = ''
  historyWarning.value = ''

  const [questionnaireResult, historyResult] = await Promise.allSettled([
    getQuestionnaires(),
    getAssessmentHistory(),
  ])

  if (questionnaireResult.status === 'fulfilled') {
    questionnaires.value = questionnaireResult.value
  } else {
    console.error('获取量表列表失败', questionnaireResult.reason)
    questionnaires.value = []
    listError.value = getErrorMessage(
      questionnaireResult.reason,
      '问卷列表加载失败，请检查网络后重试。'
    )
  }

  if (historyResult.status === 'fulfilled') {
    const ids = historyResult.value.map((item) => item.questionnaire_id)
    completedIds.value = Array.from(new Set(ids))
  } else {
    console.error('获取历史记录失败', historyResult.reason)
    completedIds.value = []
    historyWarning.value = '历史记录暂时无法加载，仍可浏览和开始新的问卷。'
  }

  isLoading.value = false
}

// 开始测评
const startAssessment = (questionnaireId: number) => {
  router.push(`/improve/questionnaire/${questionnaireId}`)
}

// 前往历史记录页面
const goToHistory = () => {
  router.push('/improve/questionnaire/history')
}

onMounted(() => {
  loadQuestionnairePage()
})
</script>

<style scoped lang="scss">
@use '@/assets/styles/theme.scss' as *;

.questionnaire-list {
  padding: 20px;
  .container {
    max-width: 800px;
    margin: 0 auto;
  }
  h2 {
    text-align: center;
    margin-bottom: 16px;
    color: $primary-color;
  }
  .description {
    text-align: center;
    margin-bottom: 30px;
    color: $text-light-color;
    font-size: $font-size-md;
  }
  .history-link {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 12px 20px;
    background: white;
    border: 1px solid $primary-color;
    border-radius: 8px;
    color: $primary-color;
    cursor: pointer;
    margin-bottom: 30px;
    transition: all 0.3s ease;
    font-size: $font-size-md;

    &:hover {
      background: $primary-light;
    }

    .history-icon {
      font-size: 20px;
    }
  }
  .state-panel {
    padding: 28px;
    border-radius: 16px;
    background: white;
    text-align: center;
    box-shadow: $shadow-sm;

    h3 {
      margin: 0 0 10px;
      color: $text-color;
    }

    p {
      margin: 0 0 18px;
      color: $text-light-color;
      line-height: 1.6;
    }
  }
  .error-panel {
    border: 1px solid rgba(255, 71, 87, 0.24);
    background: rgba(255, 71, 87, 0.04);
  }
  .retry-btn {
    padding: 10px 18px;
    border: 1px solid $primary-color;
    border-radius: 8px;
    background: $primary-color;
    color: white;
    cursor: pointer;
  }
  .questionnaire-cards {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 20px;
  }
  .history-warning {
    grid-column: 1 / -1;
    padding: 12px 16px;
    border-radius: 10px;
    background: rgba(255, 209, 102, 0.18);
    color: #7a5a00;
    line-height: 1.5;
  }
  .questionnaire-card {
    cursor: pointer;
    transition: all 0.3s ease;
    &:hover {
      transform: translateY(-5px);
      box-shadow: $shadow-md;
    }
    &.completed {
      border-left: 4px solid $success-color;
    }
    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;

      h3 {
        margin: 0;
        color: $text-color;
        flex: 1;
      }

      .completed-badge {
        background: $success-light;
        color: $success-color;
        padding: 4px 10px;
        border-radius: 12px;
        font-size: $font-size-sm;
        margin-left: 10px;
        white-space: nowrap;
      }
    }
    p {
      margin-bottom: 20px;
      color: $text-light-color;
      font-size: $font-size-sm;
      line-height: 1.5;
    }
    .btn {
      width: 100%;
      margin-top: 10px;
    }
  }
}

@media (max-width: 768px) {
  .questionnaire-list {
    padding: 15px;
    .questionnaire-cards {
      grid-template-columns: 1fr;
    }
  }
}
</style>
