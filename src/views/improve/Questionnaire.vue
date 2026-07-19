<template>
  <div class="questionnaire">
    <div class="container">
      <!-- 加载骨架 -->
      <template v-if="loading">
        <el-skeleton :rows="3" animated />
        <el-skeleton :rows="5" animated style="margin-top: 20px" />
      </template>

      <!-- 空状态 -->
      <el-empty v-else-if="isEmpty" description="暂无可用问卷" />

      <!-- 正常内容 -->
      <template v-else>
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
        <Transition name="question-slide" mode="out-in">
          <div v-if="currentQuestion" class="question-content" :key="currentQuestion.id">
            <fieldset class="options">
              <legend>{{ currentQuestion.question_text }}</legend>
              <div class="shortcut-hint">💡 按数字键 1-{{ currentQuestion.options.length }} 快速选择</div>
              <label
                v-for="(option, index) in currentQuestion.options"
                :key="index"
                class="option-item"
                :class="{ active: selectedAnswer === index }"
                @click="selectAnswer(index)"
              >
                <span class="option-key">{{ index + 1 }}</span>
                <input
                  class="option-radio"
                  type="radio"
                  :name="`question-${currentQuestion.id}`"
                  :value="index"
                  :checked="selectedAnswer === index"
                  @change="selectAnswer(index)"
                />
                {{ option }}
              </label>
            </fieldset>
          </div>
        </Transition>

        <div v-if="submitError" class="submit-error" role="alert" aria-live="assertive">
          {{ submitError }}
        </div>

        <!-- 导航按钮 -->
        <div class="navigation-buttons">
          <button
            class="btn secondary"
            :disabled="currentQuestionIndex === 0 || isSubmitting"
            @click="prevQuestion"
          >
            上一题
          </button>
          <button class="btn primary" :disabled="isSubmitting" @click="nextQuestion">
            {{ submitButtonText }}
          </button>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { ElMessage } from 'element-plus'
import { useRouter, useRoute } from 'vue-router'

import {
  getQuestionnaireDetail,
  getQuestionnaireQuestions,
  submitAssessment,
  getAIInterpretation,
  Questionnaire,
  Question,
} from '@/api/questionnaire'

const router = useRouter()
const route = useRoute()
const questionnaireId = computed(() => parseInt(route.params.id as string))

const loading = ref(true)
const error = ref(false)
const questionnaire = ref<Questionnaire | null>(null)
const questions = ref<Question[]>([])
const currentQuestionIndex = ref(0)
const selectedAnswers = ref<number[]>([])
const isSubmitting = ref(false)
const submitError = ref('')

const isEmpty = computed(() => questions.value.length === 0)

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

const isLastQuestion = computed(() => currentQuestionIndex.value === questions.value.length - 1)

const submitButtonText = computed(() => {
  if (isSubmitting.value) {
    return '提交中...'
  }

  return isLastQuestion.value ? '提交' : '下一题'
})

// 获取量表详情和问题
const fetchQuestionnaireData = async () => {
  loading.value = true
  error.value = false
  try {
    // 获取量表详情
    const detailRes = await getQuestionnaireDetail(questionnaireId.value)
    questionnaire.value = detailRes

    // 获取问题列表
    const questionsRes = await getQuestionnaireQuestions(questionnaireId.value)
    questions.value = questionsRes

    // 初始化答案数组
    selectedAnswers.value = new Array(questions.value.length).fill(-1)
  } catch (err) {
    error.value = true
    console.error('获取量表数据失败', err)
  } finally {
    loading.value = false
  }
}

// 选择答案
const selectAnswer = (index: number) => {
  selectedAnswer.value = index
  submitError.value = ''
}

// 上一题
const prevQuestion = () => {
  if (isSubmitting.value) {
    return
  }

  if (currentQuestionIndex.value > 0) {
    submitError.value = ''
    currentQuestionIndex.value--
  }
}

// 下一题或提交
const nextQuestion = async () => {
  if (isSubmitting.value) {
    return
  }

  if (selectedAnswer.value === -1) {
    ElMessage.warning('请选择一个答案')
    return
  }

  if (!isLastQuestion.value) {
    submitError.value = ''
    currentQuestionIndex.value++
  } else {
    try {
      submitError.value = ''
      isSubmitting.value = true
      const res = await submitAssessment({
        questionnaire_id: questionnaireId.value,
        answers: questions.value.map((q, i) => ({ itemId: q.id, score: selectedAnswers.value[i] })),
      })
      try {
        const aiResult = await getAIInterpretation({
          scaleType: questionnaire.value?.type || '',
          totalScore: res.score,
          itemScores: (res as any).item_scores || [],
          resultText: res.result_text,
        })
        router.push({
          path: '/improve/questionnaire/result',
          query: {
            score: res.score.toString(),
            result: encodeURIComponent(res.result_text),
            title: encodeURIComponent(questionnaire.value?.title || ''),
            aiContent: encodeURIComponent(aiResult.content || ''),
            aiGeneratedAt: encodeURIComponent(aiResult.generatedAt || ''),
          },
        })
      } catch (aiError) {
        router.push({
          path: '/improve/questionnaire/result',
          query: {
            score: res.score.toString(),
            result: encodeURIComponent(res.result_text),
            title: encodeURIComponent(questionnaire.value?.title || ''),
            aiFailed: 'true',
          },
        })
      }
    } catch (error) {
      submitError.value = '提交失败，答案已保留，请稍后重试。'
      ElMessage.error('提交答案失败，请稍后重试')
      console.error('提交答案失败', error)
    } finally {
      isSubmitting.value = false
    }
  }
}

onMounted(() => {
  fetchQuestionnaireData()
  window.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
})

// 键盘快捷键
const handleKeydown = (e: KeyboardEvent) => {
  if (loading.value || isSubmitting.value) return
  const num = parseInt(e.key)
  if (num >= 1 && num <= currentQuestion.value?.options.length) {
    selectAnswer(num - 1)
  }
  if (e.key === 'Enter') {
    nextQuestion()
  }
}
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
      background-color: $bg-warm;
      border-radius: $radius-full;
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
    border-radius: $radius-md;
    box-shadow: $shadow-sm;
    padding: 24px;
    margin-bottom: 30px;
    legend {
      margin-bottom: 20px;
      color: $text-color;
      font-size: 1.17em;
      font-weight: 600;
      line-height: 1.4;
    }
    .options {
      display: flex;
      flex-direction: column;
      gap: 12px;
      padding: 0;
      margin: 0;
      border: 0;
      .option-item {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 16px;
        border: 2px solid $border-color;
        border-radius: $radius-md;
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
        &:focus-within {
          border-color: $primary-color;
          box-shadow: 0 0 0 3px rgba($primary-color, 0.18);
        }
        .option-radio {
          width: 18px;
          height: 18px;
          flex: 0 0 auto;
          accent-color: $primary-color;
        }
      }
    }
  }

  // 导航按钮
  .submit-error {
    margin-bottom: 16px;
    padding: 12px 16px;
    color: $danger-color;
    background-color: rgba($danger-color, 0.08);
    border: 1px solid rgba($danger-color, 0.35);
    border-radius: $radius-md;
    line-height: 1.5;
  }

  .shortcut-hint {
    margin-bottom: 12px;
    font-size: 12px;
    color: $text-light-color;
    opacity: 0.7;
  }

  .option-key {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    border-radius: 6px;
    background: $bg-warm;
    color: $text-light-color;
    font-size: 12px;
    font-weight: 600;
    flex-shrink: 0;
  }

  .option-item.active .option-key {
    background: $primary-color;
    color: white;
  }

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

// 过渡动画
.question-slide-enter-active {
  transition: all 0.3s ease-out;
}
.question-slide-leave-active {
  transition: all 0.2s ease-in;
}
.question-slide-enter-from {
  opacity: 0;
  transform: translateX(30px);
}
.question-slide-leave-to {
  opacity: 0;
  transform: translateX(-30px);
}

@media (max-width: 768px) {
  .questionnaire {
    padding: 15px;
    .container {
      padding-bottom: calc(96px + env(safe-area-inset-bottom));
    }
    .question-content {
      padding: 20px;
    }
    .navigation-buttons {
      position: sticky;
      bottom: 0;
      z-index: 10;
      padding: 12px 0 calc(12px + env(safe-area-inset-bottom));
      background: var(--surface);
      border-top: 1px solid var(--border-color);
      box-shadow: 0 -8px 20px rgba(0, 0, 0, 0.08);
      .btn {
        min-width: 0;
        width: 100%;
      }
    }
  }
}
</style>
