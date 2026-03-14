<template>
  <div class="questionnaire-list">
    <div class="container">
      <h2>心理测评量表</h2>
      <p class="description">
        以下是常用的心理测评量表，通过完成这些量表，您可以了解自己的情绪状态，获取专业的建议。
      </p>

      <!-- 历史记录入口 -->
      <div class="history-link" @click="goToHistory">
        <span class="history-icon">📋</span>
        <span>查看测评历史</span>
      </div>

      <div class="questionnaire-cards">
        <div
          v-for="questionnaire in questionnaires"
          :key="questionnaire.id"
          class="questionnaire-card card"
          :class="{ completed: completedIds.includes(questionnaire.id) }"
          @click="startAssessment(questionnaire.id)"
        >
          <div class="card-header">
            <h3>{{ questionnaire.title }}</h3>
            <span
              v-if="completedIds.includes(questionnaire.id)"
              class="completed-badge"
            >
              ✓ 已填写
            </span>
          </div>
          <p>{{ questionnaire.description }}</p>
          <button class="btn primary">
            {{
              completedIds.includes(questionnaire.id) ? "重新测试" : "开始测试"
            }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useRouter } from "vue-router";

import {
  getQuestionnaires,
  getAssessmentHistory,
  Questionnaire,
} from "@/api/questionnaire";

const router = useRouter();
const questionnaires = ref<Questionnaire[]>([]);
const completedIds = ref<number[]>([]);

// 获取量表列表
const fetchQuestionnaires = async () => {
  try {
    const res = await getQuestionnaires();
    questionnaires.value = (res as { data: Questionnaire[] }).data;
  } catch (error) {
    console.error("获取量表列表失败", error);
  }
};

// 获取已完成的量表 ID 列表
const fetchCompletedIds = async () => {
  try {
    const res = await getAssessmentHistory();
    const ids = (res as { data: any[] }).data.map(
      (item: any) => item.questionnaireId,
    );
    completedIds.value = Array.from(new Set(ids));
  } catch (error) {
    console.error("获取历史记录失败", error);
  }
};

// 开始测评
const startAssessment = (questionnaireId: number) => {
  router.push(`/improve/questionnaire/${questionnaireId}`);
};

// 前往历史记录页面
const goToHistory = () => {
  router.push("/improve/questionnaire/history");
};

onMounted(() => {
  fetchQuestionnaires();
  fetchCompletedIds();
});
</script>

<style scoped lang="scss">
@import "@/assets/styles/theme.scss";

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
  .questionnaire-cards {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 20px;
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
