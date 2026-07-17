<template>
  <div class="mood-insight">
    <div class="container">
      <header class="insight-header">
        <div>
          <p class="eyebrow">Mood Insight</p>
          <h2>情绪洞察</h2>
          <p class="header-copy">从数据中看见自己的情绪模式，让每一步都走得更清醒。</p>
        </div>
      </header>

      <!-- 时间切换栏 -->
      <section class="period-switcher">
        <button
          v-for="p in periods"
          :key="p.key"
          type="button"
          class="period-btn"
          :class="{ active: currentPeriod === p.key }"
          @click="switchPeriod(p.key)"
        >
          {{ p.label }}
        </button>
      </section>

      <!-- 骨架屏 -->
      <div v-if="pageLoading" class="loading-area">
        <el-skeleton :rows="4" animated />
        <div class="skeleton-charts">
          <el-skeleton :rows="3" animated class="sk-block" />
          <el-skeleton :rows="3" animated class="sk-block" />
        </div>
      </div>

      <!-- 错误状态 -->
      <el-empty
        v-else-if="pageError"
        description="数据加载失败，请稍后重试"
      >
        <el-button type="primary" @click="loadData">重新加载</el-button>
      </el-empty>

      <!-- 无数据 -->
      <div v-else-if="isEmpty" class="empty-state">
        <div class="empty-icon">
          <i class="fas fa-chart-bar"></i>
        </div>
        <h3>暂无{{ periodLabel }}的情绪数据</h3>
        <p>去记录一些情绪，积累数据后这里会生成洞察分析。</p>
        <el-button type="primary" @click="goRecord">去记录情绪</el-button>
      </div>

      <!-- 数据内容 -->
      <template v-else>
        <!-- 概览卡片 -->
        <section class="summary-cards">
          <article class="summary-card">
            <div class="card-icon" style="background: rgba(139, 92, 246, 0.1); color: #8b5cf6;">
              <i class="fas fa-calendar-check"></i>
            </div>
            <div class="card-info">
              <span class="card-label">记录天数</span>
              <strong class="card-value">{{ insightData?.summary.totalDays ?? 0 }}</strong>
              <small class="card-unit">天</small>
            </div>
          </article>
          <article class="summary-card">
            <div class="card-icon" style="background: rgba(59, 130, 246, 0.1); color: #3b82f6;">
              <i class="fas fa-pen-to-square"></i>
            </div>
            <div class="card-info">
              <span class="card-label">记录条数</span>
              <strong class="card-value">{{ insightData?.summary.totalRecords ?? 0 }}</strong>
              <small class="card-unit">条</small>
            </div>
          </article>
          <article class="summary-card">
            <div class="card-icon" style="background: rgba(249, 115, 22, 0.1); color: #f97316;">
              <i class="fas fa-face-smile"></i>
            </div>
            <div class="card-info">
              <span class="card-label">主要情绪</span>
              <strong class="card-value">{{ insightData?.summary.mainEmotion || '--' }}</strong>
              <small class="card-unit">平均强度 {{ (insightData?.summary.avgIntensity ?? 0).toFixed(1) }}</small>
            </div>
          </article>
        </section>

        <!-- 图表区域 -->
        <section class="charts-grid">
          <div class="chart-card">
            <h3 class="chart-title">
              <i class="fas fa-chart-pie"></i> 情绪分布
            </h3>
            <EmotionPieChart :data="insightData?.distribution ?? []" />
          </div>
          <div class="chart-card">
            <h3 class="chart-title">
              <i class="fas fa-chart-line"></i> 情绪强度趋势
            </h3>
            <IntensityTrendChart :data="insightData?.trend ?? []" />
          </div>
          <div class="chart-card chart-card-full">
            <h3 class="chart-title">
              <i class="fas fa-scale-balanced"></i> 正负情绪占比
            </h3>
            <PolarityBarChart :data="polarityData" />
          </div>
        </section>

        <!-- AI 分析卡片 -->
        <section class="ai-section">
          <div class="ai-card">
            <div class="ai-header">
              <div class="ai-title-row">
                <span class="ai-badge">AI 分析</span>
                <h3>{{ periodLabel }}情绪洞察</h3>
              </div>
              <button
                type="button"
                class="refresh-btn"
                :disabled="aiLoading"
                @click="refreshAi"
              >
                <i :class="aiLoading ? 'fas fa-spinner fa-spin' : 'fas fa-rotate-right'"></i>
                重新分析
              </button>
            </div>
            <div class="ai-content">
              <div v-if="aiLoading" class="ai-loading">
                <i class="fas fa-spinner fa-spin"></i>
                <span>AI 正在分析你的情绪数据...</span>
              </div>
              <div v-else-if="aiError" class="ai-error">
                <i class="fas fa-exclamation-circle"></i>
                <span>{{ aiError }}</span>
                <button type="button" class="retry-link" @click="refreshAi">重试</button>
              </div>
              <p v-else class="ai-text">{{ aiAnalysis || '暂无分析结果' }}</p>
            </div>
          </div>
        </section>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { getMoodInsight, getAiInsight } from '@/api/moodInsight'
import type { MoodInsightResponse, InsightPeriod, Polarity } from '@/types/moodInsight'
import EmotionPieChart from './components/EmotionPieChart.vue'
import IntensityTrendChart from './components/IntensityTrendChart.vue'
import PolarityBarChart from './components/PolarityBarChart.vue'

const router = useRouter()

const periods = [
  { key: 'day' as InsightPeriod, label: '日' },
  { key: 'week' as InsightPeriod, label: '周' },
  { key: 'month' as InsightPeriod, label: '月' },
  { key: 'year' as InsightPeriod, label: '年' },
]

const currentPeriod = ref<InsightPeriod>('week')
const periodLabel = computed(() => {
  const map: Record<InsightPeriod, string> = { day: '今日', week: '本周', month: '本月', year: '今年' }
  return map[currentPeriod.value] || '当前'
})

const pageLoading = ref(true)
const pageError = ref(false)
const insightData = ref<MoodInsightResponse | null>(null)
const isEmpty = computed(() => {
  return insightData.value && insightData.value.summary.totalRecords === 0
})

const aiAnalysis = ref('')
const aiLoading = ref(false)
const aiError = ref('')

const polarityData = computed<Polarity>(() => {
  return insightData.value?.polarity ?? { positive: 0, neutral: 0, negative: 0 }
})

const loadData = async () => {
  pageLoading.value = true
  pageError.value = false
  try {
    const data = await getMoodInsight(currentPeriod.value)
    insightData.value = data
    // 加载 AI 分析
    if (data.summary.totalRecords > 0) {
      await loadAiInsight(data)
    }
  } catch {
    pageError.value = true
  } finally {
    pageLoading.value = false
  }
}

const loadAiInsight = async (data?: MoodInsightResponse) => {
  const source = data || insightData.value
  if (!source) return

  aiLoading.value = true
  aiError.value = ''
  try {
    const result = await getAiInsight(currentPeriod.value, source)
    aiAnalysis.value = result.analysis
  } catch {
    aiError.value = 'AI 分析暂时不可用，请稍后重试'
  } finally {
    aiLoading.value = false
  }
}

const switchPeriod = (period: InsightPeriod) => {
  if (currentPeriod.value === period) return
  currentPeriod.value = period
  loadData()
}

const refreshAi = () => {
  loadAiInsight()
}

const goRecord = () => {
  router.push('/mood/record')
}

onMounted(() => {
  loadData()
})
</script>

<style scoped>
.mood-insight {
  min-height: 100vh;
  padding: 32px 0 64px;
}

.container {
  max-width: 960px;
  margin: 0 auto;
  padding: 0 20px;
}

/* Header */
.insight-header {
  margin-bottom: 28px;
}

.eyebrow {
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: #8b5cf6;
  margin: 0 0 4px;
  font-weight: 600;
}

.insight-header h2 {
  font-size: 26px;
  font-weight: 700;
  color: #1e293b;
  margin: 0 0 6px;
}

.header-copy {
  font-size: 14px;
  color: #64748b;
  margin: 0;
}

/* Period Switcher */
.period-switcher {
  display: flex;
  gap: 8px;
  margin-bottom: 28px;
  background: #f1f5f9;
  border-radius: 12px;
  padding: 4px;
  width: fit-content;
}

.period-btn {
  padding: 8px 20px;
  border: none;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 500;
  color: #64748b;
  background: transparent;
  cursor: pointer;
  transition: all 0.2s;
}

.period-btn:hover {
  color: #1e293b;
}

.period-btn.active {
  background: #fff;
  color: #8b5cf6;
  font-weight: 600;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
}

/* Loading */
.loading-area {
  padding: 20px 0;
}

.skeleton-charts {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  margin-top: 16px;
}

.sk-block {
  background: #f8fafc;
  border-radius: 12px;
  padding: 16px;
}

/* Empty */
.empty-state {
  text-align: center;
  padding: 64px 20px;
}

.empty-icon {
  width: 72px;
  height: 72px;
  border-radius: 50%;
  background: #f1f5f9;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 16px;
  font-size: 28px;
  color: #94a3b8;
}

.empty-state h3 {
  font-size: 18px;
  color: #334155;
  margin: 0 0 8px;
}

.empty-state p {
  font-size: 14px;
  color: #94a3b8;
  margin: 0 0 20px;
}

/* Summary Cards */
.summary-cards {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
  margin-bottom: 24px;
}

.summary-card {
  background: #fff;
  border-radius: 14px;
  padding: 20px;
  display: flex;
  align-items: center;
  gap: 14px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.04);
  border: 1px solid #f1f5f9;
}

.card-icon {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  flex-shrink: 0;
}

.card-info {
  display: flex;
  flex-direction: column;
}

.card-label {
  font-size: 12px;
  color: #94a3b8;
  margin-bottom: 2px;
}

.card-value {
  font-size: 22px;
  font-weight: 700;
  color: #1e293b;
  line-height: 1.2;
}

.card-unit {
  font-size: 11px;
  color: #94a3b8;
}

/* Charts Grid */
.charts-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  margin-bottom: 24px;
}

.chart-card {
  background: #fff;
  border-radius: 14px;
  padding: 20px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.04);
  border: 1px solid #f1f5f9;
}

.chart-card-full {
  grid-column: 1 / -1;
}

.chart-title {
  font-size: 15px;
  font-weight: 600;
  color: #334155;
  margin: 0 0 12px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.chart-title i {
  color: #8b5cf6;
  font-size: 14px;
}

/* AI Section */
.ai-section {
  margin-top: 0;
}

.ai-card {
  background: linear-gradient(135deg, #f5f3ff 0%, #faf5ff 100%);
  border-radius: 14px;
  padding: 24px;
  border: 1px solid #ede9fe;
}

.ai-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.ai-title-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.ai-badge {
  font-size: 11px;
  font-weight: 600;
  color: #7c3aed;
  background: rgba(139, 92, 246, 0.12);
  padding: 3px 10px;
  border-radius: 6px;
}

.ai-title-row h3 {
  font-size: 16px;
  font-weight: 600;
  color: #1e293b;
  margin: 0;
}

.refresh-btn {
  padding: 6px 14px;
  border: 1px solid #ddd6fe;
  border-radius: 8px;
  background: #fff;
  color: #7c3aed;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  gap: 6px;
}

.refresh-btn:hover:not(:disabled) {
  background: #f5f3ff;
  border-color: #c4b5fd;
}

.refresh-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.ai-content {
  min-height: 80px;
  display: flex;
  align-items: center;
}

.ai-loading,
.ai-error {
  display: flex;
  align-items: center;
  gap: 10px;
  color: #94a3b8;
  font-size: 14px;
}

.ai-error {
  color: #ef4444;
}

.retry-link {
  background: none;
  border: none;
  color: #8b5cf6;
  cursor: pointer;
  font-size: 13px;
  text-decoration: underline;
}

.ai-text {
  font-size: 15px;
  line-height: 1.8;
  color: #334155;
  margin: 0;
  white-space: pre-wrap;
}

/* Responsive */
@media (max-width: 768px) {
  .summary-cards {
    grid-template-columns: 1fr;
  }
  .charts-grid {
    grid-template-columns: 1fr;
  }
}
</style>