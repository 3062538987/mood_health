<template>
  <div class="questionnaire">
    <div class="container">
      <h2>{{ questionnaire?.title }}</h2>

      <!-- 进度条 -->
      <div class="progress-container">
        <div class="progress-bar">
          <div
            class="progress-fill"
            :style="{
              width: `${((currentQuestionIndex + 1) / questions.length) * 100}%`,
            }"
          ></div>
        </div>
        <div class="progress-text">{{ currentQuestionIndex + 1 }} / {{ questions.length }}</div>
      </div>

      <!-- 问题内容 -->
      <div v-if="currentQuestion" class="question-content">
        <h3>{{ currentQuestion.question_text }}</h3>
        <div class="options">
          <div
            v-for="(option, index) in currentQuestion.options"
            :key="index"
            class="option-item"
            :class="{ active: selectedAnswer === index }"
            @click="selectAnswer(index)"
          >
            {{ option }}
          </div>
        </div>
      </div>

      <!-- 导航按钮 -->
      <div class="navigation-buttons">
        <button class="btn secondary" :disabled="currentQuestionIndex === 0" @click="prevQuestion">
          上一题
        </button>
        <button class="btn primary" @click="nextQuestion">
          {{ currentQuestionIndex === questions.length - 1 ? '提交' : '下一题' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { useRouter, useRoute } from 'vue-router'

import {
  getQuestionnaireDetail,
  getQuestionnaireQuestions,
  submitAssessment,
  Questionnaire,
  Question,
} from '@/api/questionnaire'

const router = useRouter()
const route = useRoute()
const questionnaireId = computed(() => parseInt(route.params.id as string))

const questionnaire = ref<Questionnaire | null>(null)
const questions = ref<Question[]>([])
const currentQuestionIndex = ref(0)
const selectedAnswers = ref<number[]>([])

// 当前问题
const currentQuestion = computed(() => {
  return questions.value[currentQuestionIndex.value]
})

// 当前选中的答案
const selectedAnswer = computed({
  get: () => selectedAnswers.value[currentQuestionIndex.value] ?? -1,
  set: (value) => {
    selectedAnswers.value[currentQuestionIndex.value] = value
  },
})

// 获取量表详情和问题
const fetchQuestionnaireData = async () => {
  try {
    // 获取量表详情
    const detailRes = await getQuestionnaireDetail(questionnaireId.value)
    questionnaire.value = (detailRes as { data: Questionnaire }).data

    // 获取问题列表
    const questionsRes = await getQuestionnaireQuestions(questionnaireId.value)
    questions.value = (questionsRes as { data: Question[] }).data

    // 初始化答案数组
    selectedAnswers.value = new Array(questions.value.length).fill(-1)
  } catch (error) {
    console.error('获取量表数据失败', error)
  }
}

// 选择答案
const selectAnswer = (index: number) => {
  selectedAnswer.value = index
}

// 上一题
const prevQuestion = () => {
  if (currentQuestionIndex.value > 0) {
    currentQuestionIndex.value--
  }
}

// 下一题或提交
const nextQuestion = async () => {
  if (selectedAnswer.value === -1) {
    ElMessage.warning('请选择一个答案')
    return
  }

  if (currentQuestionIndex.value < questions.value.length - 1) {
    currentQuestionIndex.value++
  } else {
    try {
      const res = await submitAssessment({
        questionnaire_id: questionnaireId.value,
        answers: selectedAnswers.value,
      })
      const data = (
        res as {
          data: { score: number; result_text: string }
        }
      ).data
      router.push({
        path: '/improve/questionnaire/result',
        query: {
          score: data.score.toString(),
          result: encodeURIComponent(data.result_text),
          title: encodeURIComponent(questionnaire.value?.title || ''),
        },
      })
    } catch (error) {
      ElMessage.error('提交答案失败，请稍后重试')
      console.error('提交答案失败', error)
    }
  }
}

onMounted(() => {
  fetchQuestionnaireData()
})
</script>

<style scoped lang="scss">
@use '@/assets/styles/theme.scss' as *;

.questionnaire {
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

  // 进度条
  .progress-container {
    margin-bottom: 30px;
    .progress-bar {
      width: 100%;
      height: 8px;
      background-color: $bg-light;
      border-radius: $border-radius-full;
      overflow: hidden;
      margin-bottom: 8px;
      .progress-fill {
        height: 100%;
        background-color: $primary-color;
        transition: width 0.3s ease;
      }
    }
    .progress-text {
      text-align: right;
      font-size: $font-size-sm;
      color: $text-light-color;
    }
  }

  // 问题内容
  .question-content {
    background-color: $white;
    border-radius: $border-radius-md;
    box-shadow: $shadow-sm;
    padding: 24px;
    margin-bottom: 30px;
    h3 {
      margin-bottom: 20px;
      color: $text-color;
      line-height: 1.4;
    }
    .options {
      display: flex;
      flex-direction: column;
      gap: 12px;
      .option-item {
        padding: 16px;
        border: 2px solid $border-color;
        border-radius: $border-radius-md;
        cursor: pointer;
        transition: all 0.3s ease;
        &:hover {
          border-color: $primary-color;
          background-color: rgba($primary-color, 0.05);
        }
        &.active {
          border-color: $primary-color;
          background-color: rgba($primary-color, 0.1);
          font-weight: 500;
        }
      }
    }
  }

  // 导航按钮
  .navigation-buttons {
    display: flex;
    justify-content: space-between;
    gap: 16px;
    .btn {
      flex: 1;
      padding: 12px;
      font-size: $font-size-md;
    }
  }
}

@media (max-width: 768px) {
  .questionnaire {
    padding: 15px;
    .question-content {
      padding: 20px;
    }
    .navigation-buttons {
      flex-direction: column;
      .btn {
        width: 100%;
      }
    }
  }
}
</style>
