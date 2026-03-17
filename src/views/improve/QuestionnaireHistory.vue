<template>
  <div class="questionnaire-history">
    <div class="container">
      <h2>测评历史记录</h2>
      <p class="description">
        查看您过往的心理测评记录，追踪自己的情绪变化趋势
      </p>

      <!-- 历史记录列表 -->
      <div class="history-list" v-if="history.length > 0">
        <div
          v-for="item in history"
          :key="item.id"
          class="history-item card"
          @click="viewResult(item)"
        >
          <div class="history-header">
            <h3>{{ item.title }}</h3>
            <span class="history-type">{{ getTypeName(item.type) }}</span>
          </div>
          <div class="history-content">
            <div class="score-info">
              <span class="score-label">得分：</span>
              <span class="score-value">{{ item.score }}</span>
            </div>
            <div class="result-preview">
              {{ item.result_text }}
            </div>
            <div class="history-date">
              {{ formatDate(item.created_at) }}
            </div>
          </div>
        </div>
      </div>

      <!-- 空状态 -->
      <div v-else class="empty-state">
        <div class="empty-icon">📋</div>
        <p>暂无测评记录</p>
        <button class="btn primary" @click="goToList">去测评</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useRouter } from "vue-router";
import { getAssessmentHistory, AssessmentHistory } from "@/api/questionnaire";

const router = useRouter();
const history = ref<AssessmentHistory[]>([]);

// 获取测评历史记录
const fetchHistory = async () => {
  try {
    const res = await getAssessmentHistory();
    history.value = (res as { data: AssessmentHistory[] }).data;
  } catch (error) {
    console.error("获取历史记录失败", error);
  }
};

// 格式化日期
const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

// 获取类型名称
const getTypeName = (type: string) => {
  const typeMap: Record<string, string> = {
    SDS: "抑郁自评量表",
    SAS: "焦虑自评量表",
    SCL90: "症状自评量表",
    EPQ: "艾森克人格问卷",
  };
  return typeMap[type] || type;
};

// 查看结果详情
const viewResult = (item: AssessmentHistory) => {
  router.push({
    path: "/improve/questionnaire/result",
    query: {
      title: encodeURIComponent(item.title),
      score: item.score.toString(),
      result: encodeURIComponent(item.result_text),
      date: item.created_at,
    },
  });
};

// 前往量表列表
const goToList = () => {
  router.push("/improve/questionnaire");
};

onMounted(() => {
  fetchHistory();
});
</script>

<style scoped lang="scss">
@use "@/assets/styles/theme.scss" as *;

.questionnaire-history {
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

  .history-list {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .history-item {
    cursor: pointer;
    transition: all 0.3s ease;
    padding: 20px;

    &:hover {
      transform: translateY(-3px);
      box-shadow: $shadow-md;
    }

    .history-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 15px;

      h3 {
        margin: 0;
        color: $text-color;
        font-size: $font-size-lg;
      }

      .history-type {
        background: $primary-light;
        color: $primary-color;
        padding: 4px 12px;
        border-radius: 15px;
        font-size: $font-size-sm;
      }
    }

    .history-content {
      .score-info {
        margin-bottom: 10px;

        .score-label {
          color: $text-light-color;
          font-size: $font-size-md;
        }

        .score-value {
          color: $primary-color;
          font-size: $font-size-xl;
          font-weight: bold;
        }
      }

      .result-preview {
        color: $text-light-color;
        font-size: $font-size-sm;
        line-height: 1.6;
        margin-bottom: 10px;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }

      .history-date {
        color: $text-light-color;
        font-size: $font-size-xs;
        text-align: right;
      }
    }
  }

  .empty-state {
    text-align: center;
    padding: 60px 20px;

    .empty-icon {
      font-size: 64px;
      margin-bottom: 20px;
    }

    p {
      color: $text-light-color;
      font-size: $font-size-lg;
      margin-bottom: 30px;
    }

    .btn {
      padding: 12px 40px;
    }
  }
}
</style>
