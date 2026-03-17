<template>
  <div class="survey-page">
    <h1>情绪问卷</h1>
    <div v-if="!currentQuestionnaire">
      <h2>请选择一个问卷</h2>
      <ul>
        <li v-for="q in questionnaires" :key="q.id" @click="selectQuestionnaire(q)">
          {{ q.title }}
        </li>
      </ul>
    </div>
    <div v-else>
      <h2>{{ currentQuestionnaire.title }}</h2>
      <p>{{ currentQuestionnaire.description }}</p>
      <div
        v-for="(question, index) in currentQuestionnaire.questions"
        :key="question.id"
        class="question"
      >
        <p>{{ index + 1 }}. {{ question.question_text }}</p>
        <div v-if="question.options && question.options.length > 0">
          <label v-for="(opt, optIndex) in question.options" :key="optIndex">
            <input
              v-model="answers[question.id]"
              type="radio"
              :name="'q' + question.id"
              :value="opt"
            />
            {{ opt }}
          </label>
        </div>
        <div v-else>
          <textarea v-model="answers[question.id]" rows="3"></textarea>
        </div>
      </div>
      <button @click="submitSurvey">提交问卷</button>
      <button @click="cancelSurvey">返回列表</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { getQuestionnaires, getQuestionnaireDetail, submitAssessment } from '@/api/questionnaire'
import type { Questionnaire, SubmitData } from '@/types/questionnaire'

const questionnaires = ref<Questionnaire[]>([])
const currentQuestionnaire = ref<Questionnaire | null>(null)
const answers = ref<Record<number, any>>({}) // 使用对象存储，key为questionId

onMounted(async () => {
  try {
    const res = await getQuestionnaires()
    questionnaires.value = res as Questionnaire[]
  } catch (error) {
    console.error('加载问卷列表失败', error)
  }
})

const selectQuestionnaire = async (q: Questionnaire) => {
  // 如果需要完整题目，可调用详情接口
  try {
    const res = await getQuestionnaireDetail(q.id)
    currentQuestionnaire.value = res as Questionnaire
    answers.value = {} // 重置答案
  } catch (error) {
    console.error('加载问卷详情失败', error)
  }
}

const submitSurvey = async () => {
  if (!currentQuestionnaire.value || !currentQuestionnaire.value.questions) return
  // 简单验证：所有问题都需回答（可根据需要加强）
  const allQuestions = currentQuestionnaire.value.questions
  const missing = allQuestions.some(
    (q) => answers.value[q.id] === undefined || answers.value[q.id] === ''
  )
  if (missing) {
    ElMessage.warning('请回答所有问题')
    return
  }
  try {
    const submitData: SubmitData = {
      questionnaire_id: currentQuestionnaire.value.id,
      answers: Object.entries(answers.value).map(([questionId, answer]) => ({
        question_id: Number(questionId),
        answer: answer.toString(),
      })),
    }
    await submitAssessment(submitData as any)
    ElMessage.success('提交成功')
    currentQuestionnaire.value = null
  } catch (error) {
    ElMessage.error('提交失败，请稍后重试')
    console.error('提交失败', error)
  }
}

const cancelSurvey = () => {
  currentQuestionnaire.value = null
}
</script>

<style scoped lang="scss">
@use 'sass:color';
@use '@/assets/styles/theme.scss' as *;

.survey-page {
  max-width: 600px;
  margin: 0 auto;
  padding: 20px;
  background-color: $bg-color;
  .question {
    margin: 20px 0;
    border-bottom: 1px solid $text-light-color;
    padding-bottom: 10px;
    background-color: $white;
    padding: 16px;
    border-radius: 8px;
    box-shadow: $shadow-sm;
  }
  button {
    margin-right: 10px;
    padding: 8px 16px;
    background-color: $primary-color;
    color: $white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.3s;
    &:hover {
      background-color: color.adjust($primary-color, $lightness: -10%);
    }
  }
}

// 响应式设计
@media (max-width: 768px) {
  .survey-page {
    padding: 15px;
  }

  .question {
    margin: 15px 0;
    padding: 12px;
  }

  button {
    margin-right: 8px;
    margin-bottom: 8px;
    padding: 6px 12px;
    font-size: $font-size-md;
  }
}

@media (max-width: 480px) {
  .survey-page {
    padding: 10px;
  }

  h1 {
    font-size: $font-size-xl;
  }

  h2 {
    font-size: $font-size-lg;
  }

  .question {
    margin: 12px 0;
    padding: 10px;
  }

  button {
    margin-right: 6px;
    padding: 5px 10px;
    font-size: $font-size-sm;
  }
}
</style>
