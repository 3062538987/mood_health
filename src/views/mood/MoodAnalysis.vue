<template>
  <div class="mood-analysis">
    <div class="container">
      <h2>情绪趋势分析</h2>

      <!-- 选项卡切换 -->
      <el-tabs v-model="activeTab" class="analysis-tabs">
        <el-tab-pane label="情绪趋势" name="trend">
          <!-- 时间范围切换 -->
          <div class="range-selector">
            <button
              v-for="range in timeRanges"
              :key="range.value"
              :class="{ active: selectedRange === range.value }"
              @click="selectRange(range.value)"
            >
              {{ range.label }}
            </button>
          </div>

          <transition name="analysis-state" mode="out-in">
            <SoftLoadingState
              v-if="showTrendLoading"
              key="trend-loading"
              variant="panel"
              :item-count="4"
              title="正在整理情绪趋势"
              description="会把你的记录转成图表和洞察，先给界面一点时间。"
            />

            <div
              v-else-if="showTrendEmpty"
              key="trend-empty"
              class="analysis-state-shell"
            >
              <SoftEmptyState
                title="还没有足够的情绪记录可供分析"
                description="先去记录几次心情，趋势图和 AI 洞察会在这里逐步长出来。"
                action-text="去记录情绪"
                @action="goToMoodRecord"
              />
            </div>

            <div v-else key="trend-content" class="trend-content">
              <!-- 沉浸式叙事图表 -->
              <div class="narrative-chart">
                <div class="chart-container" ref="chartContainer">
                  <MoodChart
                    :chart-data="chartData"
                    :loading="isLoading"
                    @hover-point="handleHoverPoint"
                    @leave-point="handleLeavePoint"
                  />

                  <!-- 悬浮信息卡片 -->
                  <div
                    v-if="hoveredPoint"
                    class="hover-card"
                    :style="hoverCardStyle"
                  >
                    <div class="hover-date">
                      {{ formatDate(hoveredPoint.date) }}
                    </div>
                    <div class="hover-intensity">
                      <span class="intensity-label">情绪强度</span>
                      <span
                        class="intensity-value"
                        :style="{
                          color: getIntensityColor(hoveredPoint.intensity),
                        }"
                      >
                        {{ hoveredPoint.intensity }}/10
                      </span>
                    </div>
                    <div v-if="hoveredPoint.note" class="hover-note">
                      <span class="note-icon">📝</span>
                      {{ truncateText(hoveredPoint.note, 50) }}
                    </div>
                    <div
                      v-if="
                        hoveredPoint.triggers &&
                        hoveredPoint.triggers.length > 0
                      "
                      class="hover-triggers"
                    >
                      <span class="trigger-icon">🎯</span>
                      <span class="trigger-text">
                        {{ hoveredPoint.triggers.join(", ") }}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <!-- AI洞察卡片 -->
              <div class="insight-cards">
                <div
                  v-for="(insight, index) in insights"
                  :key="index"
                  class="insight-card"
                  :class="`insight-${insight.type}`"
                  :style="{ animationDelay: `${index * 0.2}s` }"
                >
                  <div class="insight-icon">{{ insight.emoji }}</div>
                  <div class="insight-content">
                    <h4 class="insight-title">{{ insight.title }}</h4>
                    <p class="insight-description">{{ insight.description }}</p>
                    <div class="insight-action">
                      <button
                        class="action-btn"
                        @click="applySuggestion(insight.suggestion)"
                      >
                        {{ insight.actionText }}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </transition>
        </el-tab-pane>

        <el-tab-pane label="AI 建议历史" name="history">
          <div class="advice-history-container">
            <transition name="analysis-state" mode="out-in">
              <SoftLoadingState
                v-if="showHistoryLoading"
                key="history-loading"
                variant="panel"
                :item-count="3"
                title="正在整理 AI 建议历史"
                description="会把之前保存的建议按时间串起来，方便你回看。"
              />

              <el-timeline
                v-else-if="adviceHistory.length > 0"
                key="history-list"
              >
                <el-timeline-item
                  v-for="item in adviceHistory"
                  :key="item.id"
                  :timestamp="formatDate(item.createdAt)"
                  placement="top"
                >
                  <div class="advice-item">
                    <h4 class="advice-analysis">{{ item.analysis }}</h4>
                    <div class="advice-suggestions">
                      <p
                        v-for="(s, idx) in item.suggestions"
                        :key="idx"
                        class="suggestion-item"
                      >
                        💡 {{ s }}
                      </p>
                    </div>
                  </div>
                </el-timeline-item>
              </el-timeline>

              <SoftEmptyState
                v-else
                key="history-empty"
                compact
                title="这里还没有 AI 建议历史"
                description="先在记录页生成几次建议，之后就能在这里回看自己的情绪陪伴轨迹。"
                action-text="去生成建议"
                @action="goToMoodRecord"
              />
            </transition>
          </div>
        </el-tab-pane>
      </el-tabs>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from "vue";
import { useRouter } from "vue-router";
import { ElMessage } from "element-plus";
import { getMoodTrend, getMoodWeeklyReport } from "@/api/mood";
import { getAdviceHistory, type AdviceHistoryItem } from "@/api/advice";
import { MoodTrendResponse, MoodWeeklyReport } from "@/types/mood";
import MoodChart from "@/components/mood/MoodChart.vue";
import SoftEmptyState from "@/components/shared/SoftEmptyState.vue";
import SoftLoadingState from "@/components/shared/SoftLoadingState.vue";
import { formatDate as formatDateUtil } from "@/utils/dateUtil";

const router = useRouter();
const activeTab = ref("trend");
const adviceHistory = ref<AdviceHistoryItem[]>([]);
const adviceLoading = ref(false);
const hasFetchedAdvice = ref(false);

// 时间范围选项
const timeRanges: { label: string; value: "week" | "month" | "quarter" }[] = [
  { label: "近一周", value: "week" },
  { label: "近一月", value: "month" },
  { label: "近一季度", value: "quarter" },
];

interface ChartPoint {
  date: string;
  intensity: number;
  x: number;
  y: number;
  note?: string;
  triggers?: string[];
}

interface Insight {
  type: "pattern" | "warning" | "positive";
  emoji: string;
  title: string;
  description: string;
  suggestion: string;
  actionText: string;
}

const selectedRange = ref<"week" | "month" | "quarter">("week");
const isLoading = ref(false);
const hasFetchedTrend = ref(false);
const chartData = ref<MoodTrendResponse | null>(null);
const weeklyData = ref<MoodWeeklyReport | null>(null);
const hoveredPoint = ref<ChartPoint | null>(null);
const chartContainer = ref<HTMLElement>();
const insights = ref<Insight[]>([]);

const hasTrendData = computed(() => {
  return Boolean(chartData.value?.data?.length);
});

const showTrendLoading = computed(() => {
  return !hasFetchedTrend.value || (isLoading.value && !hasTrendData.value);
});

const showTrendEmpty = computed(() => {
  return hasFetchedTrend.value && !isLoading.value && !hasTrendData.value;
});

const showHistoryLoading = computed(() => {
  return (
    !hasFetchedAdvice.value ||
    (adviceLoading.value && adviceHistory.value.length === 0)
  );
});

// 计算属性：平均情绪强度
const averageIntensity = computed(() => {
  if (!chartData.value || !chartData.value.data) return 0;
  const values = chartData.value.data.map((d) => d.intensity || 0);
  return values.length > 0
    ? values.reduce((a, b) => a + b, 0) / values.length
    : 0;
});

// 计算属性：情绪稳定性
const moodStability = computed(() => {
  if (!chartData.value || !chartData.value.data) return 0;
  const values = chartData.value.data.map((d) => d.intensity || 0);
  if (values.length === 0) return 0;

  const avg = averageIntensity.value;
  const variance =
    values.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) /
    values.length;
  const stdDev = Math.sqrt(variance);

  // 标准差越小，稳定性越高
  const stability = Math.max(0, 100 - (stdDev / 5) * 100);
  return Math.round(stability);
});

// 计算属性：最常见情绪
const mostFrequentMood = computed(() => {
  if (!chartData.value || !chartData.value.data) return "无数据";

  const moodCounts: Record<string, number> = {};
  chartData.value.data.forEach((d) => {
    if (d.moodType && d.moodType.length > 0) {
      d.moodType.forEach((type: string) => {
        moodCounts[type] = (moodCounts[type] || 0) + 1;
      });
    }
  });

  let maxCount = 0;
  let mostFrequent = "无数据";

  const moodNames: Record<string, string> = {
    happy: "快乐",
    sad: "悲伤",
    angry: "愤怒",
    anxious: "焦虑",
    calm: "平静",
    irritable: "烦躁",
  };

  Object.entries(moodCounts).forEach(([type, count]) => {
    if (count > maxCount) {
      maxCount = count;
      mostFrequent = moodNames[type] || type;
    }
  });

  return mostFrequent;
});

// 计算属性：悬浮卡片样式
const hoverCardStyle = computed(() => {
  if (!hoveredPoint.value || !chartContainer.value) return {};

  return {
    top: `${hoveredPoint.value.y}px`,
    left: `${hoveredPoint.value.x}px`,
  };
});

// 选择时间范围
const selectRange = (range: "week" | "month" | "quarter") => {
  selectedRange.value = range;
  fetchMoodData(range);
};

// 获取情绪数据
const fetchMoodData = async (range: "week" | "month" | "quarter") => {
  try {
    isLoading.value = true;

    // 获取趋势数据
    const trendData = await getMoodTrend(range);
    chartData.value = trendData;

    // 获取周报数据（用于生成洞察）
    const weeklyReport = await getMoodWeeklyReport();
    weeklyData.value = weeklyReport;

    // 生成AI洞察
    insights.value = generateInsights(weeklyReport, trendData);
  } catch (error) {
    ElMessage.error("获取情绪数据失败，请稍后重试");
    console.error("获取情绪数据失败", error);
  } finally {
    isLoading.value = false;
    hasFetchedTrend.value = true;
  }
};

// 获取 AI 建议历史
const fetchAdviceHistory = async () => {
  try {
    adviceLoading.value = true;
    const res = await getAdviceHistory({ page: 1, pageSize: 20 });
    adviceHistory.value = res.list;
  } catch (error) {
    ElMessage.error("获取建议历史失败，请稍后重试");
    console.error("获取建议历史失败", error);
  } finally {
    adviceLoading.value = false;
    hasFetchedAdvice.value = true;
  }
};

// 生成AI洞察
const generateInsights = (
  weeklyData: MoodWeeklyReport | null,
  trendData: MoodTrendResponse | null,
): Insight[] => {
  const insights: Insight[] = [];

  if (
    !weeklyData ||
    !weeklyData.dailyData ||
    weeklyData.dailyData.length === 0
  ) {
    return [
      {
        type: "pattern",
        emoji: "📊",
        title: "开始记录情绪",
        description: "记录更多情绪数据，我们将为您提供个性化的情绪分析和建议。",
        suggestion: "record",
        actionText: "开始记录",
      },
    ];
  }

  const dailyData = weeklyData.dailyData;

  // 分析1：周中情绪低谷
  const dayAverages: Record<number, number> = {};
  dailyData.forEach((item) => {
    const day = new Date(item.date).getDay();
    dayAverages[day] = (dayAverages[day] || 0) + (item.averageIntensity || 0);
  });

  const dayCounts: Record<number, number> = {};
  dailyData.forEach((item) => {
    const day = new Date(item.date).getDay();
    dayCounts[day] = (dayCounts[day] || 0) + 1;
  });

  const dayNames = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
  let lowestDay = 0;
  let lowestAvg = Infinity;

  Object.entries(dayAverages).forEach(([dayStr, total]) => {
    const day = parseInt(dayStr);
    const avg = total / dayCounts[day];
    if (avg < lowestAvg) {
      lowestAvg = avg;
      lowestDay = day;
    }
  });

  if (lowestAvg < 4) {
    insights.push({
      type: "warning",
      emoji: "😌",
      title: `每周${dayNames[lowestDay]}情绪最低落`,
      description: `过去4周，${dayNames[lowestDay]}平均情绪值比其他天低${Math.round(((4 - lowestAvg) / 4) * 100)}%。可能与当天的课程压力或工作安排有关。`,
      suggestion: "relax",
      actionText: "试试${dayNames[lowestDay]}下午安排放松活动",
    });
  }

  // 分析2：情绪波动
  const intensities = dailyData.map((d) => d.averageIntensity || 0);
  const avg = intensities.reduce((a, b) => a + b, 0) / intensities.length;
  const variance =
    intensities.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) /
    intensities.length;
  const stdDev = Math.sqrt(variance);

  if (stdDev > 1.5) {
    insights.push({
      type: "warning",
      emoji: "📊",
      title: "情绪波动较大",
      description: `最近一周情绪标准差为${stdDev.toFixed(1)}，表明情绪波动较为明显。建议关注情绪变化规律，寻找稳定的情绪调节方式。`,
      suggestion: "meditation",
      actionText: "尝试冥想练习",
    });
  }

  // 分析3：考试前焦虑
  const examKeywords = ["考试", "测试", "测验", "复习"];
  let examAnxietyCount = 0;
  let examAnxietyIncrease = 0;

  dailyData.forEach((item) => {
    const hasExamTrigger = item.triggers?.some((t: string) =>
      examKeywords.some((keyword) => t.includes(keyword)),
    );

    if (hasExamTrigger && item.anxiousRatio && item.anxiousRatio > 30) {
      examAnxietyCount++;
      examAnxietyIncrease += item.anxiousRatio;
    }
  });

  if (examAnxietyCount >= 2) {
    const avgAnxiety = examAnxietyIncrease / examAnxietyCount;
    insights.push({
      type: "warning",
      emoji: "🔍",
      title: "考试前焦虑上升",
      description: `检测到你在考试前3天焦虑情绪显著增加，平均焦虑水平为${avgAnxiety.toFixed(0)}%。这是正常的反应，但可以提前准备。`,
      suggestion: "exam",
      actionText: "查看考前放松指南",
    });
  }

  // 分析4：积极情绪
  const positiveDays = dailyData.filter(
    (d) => (d.happyRatio || 0) > 40 || (d.calmRatio || 0) > 40,
  ).length;

  const positiveRatio = (positiveDays / dailyData.length) * 100;

  if (positiveRatio > 60) {
    insights.push({
      type: "positive",
      emoji: "🌟",
      title: "情绪状态良好",
      description: `最近一周有${positiveRatio.toFixed(0)}%的时间情绪积极，这是一个很好的状态！继续保持积极的生活态度。`,
      suggestion: "share",
      actionText: "分享你的快乐",
    });
  }

  // 分析5：睡眠与情绪
  const sleepKeywords = ["熬夜", "失眠", "睡眠"];
  let sleepMoodImpact = 0;
  let sleepRecords = 0;

  dailyData.forEach((item) => {
    const hasSleepTrigger = item.triggers?.some((t: string) =>
      sleepKeywords.some((keyword) => t.includes(keyword)),
    );

    if (hasSleepTrigger) {
      sleepRecords++;
      if (item.averageIntensity && item.averageIntensity < 4) {
        sleepMoodImpact++;
      }
    }
  });

  if (sleepRecords > 0 && sleepMoodImpact / sleepRecords > 0.5) {
    insights.push({
      type: "warning",
      emoji: "😴",
      title: "睡眠影响情绪",
      description: `检测到睡眠问题与低情绪状态相关联。改善睡眠质量可能有助于提升整体情绪。`,
      suggestion: "sleep",
      actionText: "查看睡眠建议",
    });
  }

  // 如果没有足够的洞察，添加默认洞察
  if (insights.length === 0) {
    insights.push({
      type: "pattern",
      emoji: "📊",
      title: "持续记录情绪",
      description: "继续记录情绪数据，我们将为您提供更准确的个性化分析和建议。",
      suggestion: "record",
      actionText: "继续记录",
    });
  }

  return insights.slice(0, 3);
};

// 处理图表悬浮
const handleHoverPoint = (point: ChartPoint) => {
  hoveredPoint.value = point;
};

// 处理离开图表点
const handleLeavePoint = () => {
  hoveredPoint.value = null;
};

// 应用建议
const applySuggestion = (suggestion: string) => {
  switch (suggestion) {
    case "record":
      router.push("/mood/record");
      break;
    case "relax":
      // 跳转到放松中心
      window.location.href = "/relax";
      break;
    case "meditation":
      // 跳转到冥想练习
      window.location.href = "/relax?tab=breathing";
      break;
    case "exam":
      ElMessage({
        message:
          "考前放松指南：\n1. 提前3天开始调整作息\n2. 适当运动释放压力\n3. 尝试深呼吸练习\n4. 保持积极心态",
        type: "info",
        duration: 5000,
      });
      break;
    case "share":
      ElMessage({
        message:
          "分享你的快乐：\n与朋友分享积极的情绪可以增强幸福感，也可以激励他人！",
        type: "success",
        duration: 3000,
      });
      break;
    case "sleep":
      ElMessage({
        message:
          "睡眠建议：\n1. 保持规律作息\n2. 睡前避免使用电子设备\n3. 创造舒适的睡眠环境\n4. 避免咖啡因和重餐",
        type: "info",
        duration: 5000,
      });
      break;
    default:
      console.log("Unknown suggestion:", suggestion);
  }
};

const goToMoodRecord = () => {
  router.push("/mood/record");
};

// 格式化日期
const formatDate = (dateString: string) => {
  return formatDateUtil(dateString);
};

// 截断文本
const truncateText = (text: string, maxLength: number) => {
  if (!text) return "";
  return text.length > maxLength ? text.substring(0, maxLength) + "..." : text;
};

// 获取强度颜色
const getIntensityColor = (intensity: number) => {
  if (intensity <= 3) return "var(--mood-angry)";
  if (intensity <= 6) return "var(--mood-happy)";
  return "var(--mood-calm)";
};

// 生命周期钩子
onMounted(() => {
  fetchMoodData(selectedRange.value);
  fetchAdviceHistory();
});
</script>

<style scoped lang="scss">
@use "@/assets/styles/theme.scss" as *;

.mood-analysis {
  padding: 20px;

  .container {
    max-width: 1200px;
    margin: 0 auto;
  }

  h2 {
    margin-bottom: 24px;
    text-align: center;
    color: var(--primary-color);
    font-family: "Noto Serif SC", serif;
    font-weight: 700;
  }

  .analysis-tabs {
    margin-bottom: 24px;
  }

  .analysis-state-shell {
    min-height: 520px;
    display: flex;
    align-items: center;
  }

  .trend-content {
    display: grid;
    gap: 24px;
  }

  .analysis-state-enter-active,
  .analysis-state-leave-active {
    transition:
      opacity 0.24s ease,
      transform 0.24s ease;
  }

  .analysis-state-enter-from,
  .analysis-state-leave-to {
    opacity: 0;
    transform: translateY(10px);
  }

  .range-selector {
    display: flex;
    justify-content: center;
    gap: 12px;
    margin-bottom: 32px;

    button {
      padding: 12px 24px;
      border: 1px solid var(--border-color);
      border-radius: $border-radius-full;
      background: rgba(255, 255, 255, 0.8);
      backdrop-filter: blur(8px);
      cursor: pointer;
      transition: all 0.3s ease;
      font-size: $font-size-md;
      font-weight: 500;

      &:hover {
        border-color: var(--primary-color);
        background-color: rgba(106, 176, 165, 0.1);
        transform: translateY(-2px);
      }

      &.active {
        background: var(--primary-color);
        color: var(--white);
        border-color: var(--primary-color);
        box-shadow: var(--shadow-sm);
      }
    }
  }

  // 沉浸式叙事图表
  .narrative-chart {
    margin-bottom: 32px;
  }

  .chart-container {
    position: relative;
    background: rgba(255, 255, 255, 0.7);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    border: 1px solid rgba(255, 255, 255, 0.3);
    border-radius: $border-radius-lg;
    box-shadow: 0 8px 32px rgba(31, 38, 135, 0.1);
    transition: all 0.3s ease;
    position: relative;
    overflow: hidden;
    padding: 24px;
    border-radius: $border-radius-lg;
    margin-bottom: 32px;
    min-height: 450px;

    // 悬浮信息卡片
    .hover-card {
      position: absolute;
      background: rgba(255, 255, 255, 0.95);
      backdrop-filter: blur(12px);
      border-radius: $border-radius-lg;
      padding: 16px;
      box-shadow: 0 12px 40px rgba(0, 0, 0, 0.2);
      border: 1px solid rgba(255, 255, 255, 0.3);
      min-width: 280px;
      max-width: 320px;
      z-index: 100;
      animation: fadeIn 0.3s ease;

      .hover-date {
        font-size: $font-size-sm;
        color: var(--text-light-color);
        margin-bottom: 8px;
        font-weight: 500;
      }

      .hover-intensity {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 12px;
        padding-bottom: 12px;
        border-bottom: 1px solid var(--border-color);

        .intensity-label {
          font-size: $font-size-sm;
          color: var(--text-light-color);
        }

        .intensity-value {
          font-size: $font-size-xl;
          font-weight: 700;
          font-family: "Noto Serif SC", serif;
        }
      }

      .hover-note {
        display: flex;
        align-items: flex-start;
        gap: 8px;
        margin-bottom: 8px;
        font-size: $font-size-sm;
        color: var(--text-color);
        line-height: 1.5;

        .note-icon {
          font-size: 16px;
        }
      }

      .hover-triggers {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: $font-size-sm;
        color: var(--text-color);

        .trigger-icon {
          font-size: 16px;
        }

        .trigger-text {
          font-weight: 500;
        }
      }
    }
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
      transform: translateY(10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  // AI洞察卡片
  .insight-cards {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
    gap: 20px;
  }

  .insight-card {
    background: rgba(255, 255, 255, 0.7);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    border: 1px solid rgba(255, 255, 255, 0.3);
    border-radius: $border-radius-lg;
    box-shadow: 0 8px 32px rgba(31, 38, 135, 0.1);
    transition: all 0.3s ease;
    position: relative;
    overflow: hidden;
    padding: 24px;
    border-radius: $border-radius-lg;
    display: flex;
    gap: 16px;
    transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
    opacity: 0;
    animation: slideInUp 0.6s ease forwards;
    position: relative;
    overflow: hidden;

    &::before {
      content: "";
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 4px;
      background: linear-gradient(
        90deg,
        var(--primary-color),
        var(--secondary-color)
      );
      opacity: 0;
      transition: opacity 0.3s ease;
    }

    &:hover {
      transform: translateY(-8px);
      box-shadow: 0 20px 50px rgba(0, 0, 0, 0.15);

      &::before {
        opacity: 1;
      }
    }

    &.insight-warning {
      border-left: 4px solid var(--mood-angry);
    }

    &.insight-positive {
      border-left: 4px solid var(--mood-happy);
    }

    &.insight-pattern {
      border-left: 4px solid var(--mood-calm);
    }

    .insight-icon {
      font-size: 48px;
      flex-shrink: 0;
      animation: pulse 2s ease-in-out infinite;
    }

    .insight-content {
      flex-grow: 1;
      display: flex;
      flex-direction: column;
      gap: 12px;

      .insight-title {
        font-size: $font-size-lg;
        font-weight: 600;
        color: var(--text-color);
        margin: 0;
        font-family: "Noto Serif SC", serif;
      }

      .insight-description {
        font-size: $font-size-sm;
        color: var(--text-light-color);
        line-height: 1.6;
        margin: 0;
      }

      .insight-action {
        margin-top: auto;

        .action-btn {
          padding: 10px 20px;
          background: var(--primary-color);
          color: var(--white);
          border: none;
          border-radius: $border-radius-md;
          cursor: pointer;
          font-size: $font-size-sm;
          font-weight: 500;
          transition: all 0.3s ease;
          box-shadow: var(--shadow-sm);

          &:hover {
            background: var(--primary-color);
            opacity: 0.9;
            transform: translateY(-2px);
            box-shadow: var(--shadow-md);
          }
        }
      }
    }
  }

  @keyframes slideInUp {
    from {
      opacity: 0;
      transform: translateY(30px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @keyframes pulse {
    0%,
    100% {
      transform: scale(1);
    }
    50% {
      transform: scale(1.05);
    }
  }

  // 情绪统计
  .stats-container {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 20px;
    margin-top: 32px;
  }

  .stat-card {
    background: rgba(255, 255, 255, 0.7);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    border: 1px solid rgba(255, 255, 255, 0.3);
    border-radius: $border-radius-lg;
    box-shadow: 0 8px 32px rgba(31, 38, 135, 0.1);
    transition: all 0.3s ease;
    position: relative;
    overflow: hidden;
    padding: 20px;
    border-radius: $border-radius-lg;
    display: flex;
    align-items: center;
    gap: 16px;
    transition: all 0.3s ease;

    &:hover {
      transform: translateY(-4px);
      box-shadow: var(--shadow-md);
    }

    .stat-icon {
      font-size: 40px;
      flex-shrink: 0;
    }

    .stat-info {
      .stat-value {
        font-size: $font-size-xxl;
        font-weight: 700;
        color: var(--primary-color);
        font-family: "Noto Serif SC", serif;
        line-height: 1;
        margin-bottom: 4px;
      }

      .stat-label {
        font-size: $font-size-sm;
        color: var(--text-light-color);
        font-weight: 500;
      }
    }
  }

  // 响应式设计
  @media (max-width: 768px) {
    padding: 15px;

    h2 {
      font-size: $font-size-xl;
      margin-bottom: 20px;
    }

    .range-selector {
      gap: 8px;
      margin-bottom: 24px;
      flex-wrap: wrap;

      button {
        padding: 10px 18px;
        font-size: $font-size-sm;
      }
    }

    .chart-container {
      padding: 16px;
      min-height: 350px;

      .hover-card {
        min-width: 240px;
        max-width: 280px;
        padding: 12px;
      }
    }

    .insight-cards {
      grid-template-columns: 1fr;
      gap: 16px;
    }

    .insight-card {
      flex-direction: column;
      text-align: center;

      .insight-icon {
        align-self: center;
      }
    }

    .stats-container {
      grid-template-columns: 1fr;
      gap: 16px;
    }

    .stat-card {
      justify-content: center;
    }
  }

  // AI 建议历史样式
  .advice-history-container {
    background: rgba(255, 255, 255, 0.7);
    backdrop-filter: blur(10px);
    border-radius: $border-radius-lg;
    padding: 24px;
    min-height: 400px;
    display: grid;
    align-items: start;

    .advice-item {
      padding: 16px;
      background: rgba(255, 255, 255, 0.5);
      border-radius: $border-radius-md;
      border-left: 3px solid var(--primary-color);

      .advice-analysis {
        font-size: $font-size-md;
        font-weight: 600;
        color: var(--text-color);
        margin-bottom: 12px;
        line-height: 1.5;
      }

      .advice-suggestions {
        .suggestion-item {
          font-size: $font-size-sm;
          color: var(--text-light-color);
          line-height: 1.6;
          margin: 8px 0;
          padding: 8px 12px;
          background: rgba(106, 176, 165, 0.1);
          border-radius: $border-radius-sm;
          transition: all 0.3s ease;

          &:hover {
            background: rgba(106, 176, 165, 0.2);
            transform: translateX(4px);
          }
        }
      }
    }
  }

  @media (max-width: 768px) {
    padding: 10px;

    .range-selector {
      button {
        flex: 1;
        min-width: 80px;
      }
    }

    .chart-container {
      padding: 12px;
      min-height: 300px;
    }

    .insight-card {
      padding: 16px;

      .insight-icon {
        font-size: 36px;
      }

      .insight-content {
        .insight-title {
          font-size: $font-size-md;
        }

        .insight-description {
          font-size: $font-size-sm;
        }
      }
    }

    .stat-card {
      padding: 16px;

      .stat-icon {
        font-size: 32px;
      }

      .stat-info {
        .stat-value {
          font-size: $font-size-xl;
        }
      }
    }
  }
}
</style>
