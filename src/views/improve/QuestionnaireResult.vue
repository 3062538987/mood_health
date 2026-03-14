<template>
  <div class="questionnaire-result">
    <div class="container">
      <h2>测评结果</h2>

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
          <h4>结果解读</h4>
          <p class="result-text">{{ result }}</p>
        </div>

        <div class="recommendation-section">
          <h4>建议</h4>
          <ul class="recommendations">
            <li>保持规律的作息时间，保证充足的睡眠</li>
            <li>适当进行体育锻炼，如散步、瑜伽等</li>
            <li>多与朋友和家人交流，分享自己的感受</li>
            <li>学习一些放松技巧，如深呼吸、冥想等</li>
            <li>如果症状持续或加重，建议寻求专业心理咨询师的帮助</li>
          </ul>
        </div>

        <div class="action-buttons">
          <button class="btn secondary" @click="backToList">
            返回量表列表
          </button>
          <button class="btn primary" @click="retryAssessment">重新测试</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useRouter, useRoute } from "vue-router";

const router = useRouter();
const route = useRoute();

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

const title = ref(
  route.query.title
    ? decodeURIComponent(route.query.title as string)
    : "心理测评",
);
const score = ref(route.query.score ? (route.query.score as string) : "0");
const result = ref(
  route.query.result ? decodeURIComponent(route.query.result as string) : "",
);
const testDate = ref(
  route.query.date ? formatDate(route.query.date as string) : "",
);

// 返回量表列表
const backToList = () => {
  router.push("/improve/questionnaire");
};

// 重新测试
const retryAssessment = () => {
  // 这里应该根据实际情况跳转到对应的量表页面
  // 暂时返回列表页
  router.push("/improve/questionnaire");
};

onMounted(() => {
  // 如果没有结果数据，跳回列表页
  if (!result.value) {
    router.push("/improve/questionnaire");
  }
});
</script>

<style scoped lang="scss">
@import "@/assets/styles/theme.scss";

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
            content: "•";
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
</style>
