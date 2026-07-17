<template>
  <div class="survey-page">
    <h1>情绪筛查问卷</h1>
    <p class="screening-note">结果仅用于自我筛查与风险提示，不构成医学诊断。</p>
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
              :value="optIndex"
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
import {
  getQuestionnaires,
  getQuestionnaireDetail,
  getQuestionnaireQuestions,
  submitAssessment,
  type Questionnaire,
  type Question,
} from '@/api/questionnaire'

type QuestionnaireWithQuestions = Questionnaire & { questions: Question[] }

const questionnaires = ref<Questionnaire[]>([])
const currentQuestionnaire = ref<QuestionnaireWithQuestions | null>(null)
const answers = ref<Record<number, number>>({})

onMounted(async () => {
  try {
    const res = await getQuestionnaires()
    questionnaires.value = res
  } catch (error) {
    console.error('加载问卷列表失败', error)
  }
})

const selectQuestionnaire = async (q: Questionnaire) => {
  // 如果需要完整题目，可调用详情接口
  try {
    const [detail, questions] = await Promise.all([
      getQuestionnaireDetail(q.id),
      getQuestionnaireQuestions(q.id),
    ])
    currentQuestionnaire.value = { ...detail, questions }
    answers.value = {} // 重置答案
  } catch (error) {
    console.error('加载问卷详情失败', error)
  }
}

const submitSurvey = async () => {
  if (!currentQuestionnaire.value || !currentQuestionnaire.value.questions) return
  // 简单验证：所有问题都需回答（可根据需要加强）
  const allQuestions = currentQuestionnaire.value.questions
  const missing = allQuestions.some((q) => answers.value[q.id] === undefined)
  if (missing) {
    ElMessage.warning('请回答所有问题')
    return
  }
  try {
    const submitData = {
      questionnaire_id: currentQuestionnaire.value.id,
      answers: allQuestions.map((question) => ({ itemId: question.id, score: answers.value[question.id] })),
    }
    await submitAssessment(submitData)
    ElMessage.success('筛查结果已保存')
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
  .screening-note {
    color: $text-light-color;
    line-height: 1.6;
  }
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
