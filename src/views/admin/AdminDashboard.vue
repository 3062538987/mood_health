<template>
  <div class="admin-dashboard">
    <div class="dashboard-header">
      <h2>管理驾驶舱</h2>
      <div class="time-filter">
        <input
          type="date"
          v-model="startDate"
          class="date-input"
          @change="loadAllData"
        />
        <span class="date-sep">~</span>
        <input
          type="date"
          v-model="endDate"
          class="date-input"
          @change="loadAllData"
        />
      </div>
    </div>

    <!-- 加载状态 -->
    <div v-if="loading" class="loading-state">
      <div class="spinner"></div>
      <p>正在整理数据，请稍候...</p>
    </div>

    <!-- 错误状态 -->
    <div v-else-if="error" class="error-state">
      <p>数据加载出现问题，请再试一次</p>
      <button class="retry-btn" @click="loadAllData">再试一次</button>
    </div>

    <!-- 数据面板 -->
    <template v-else>
      <!-- KPI 卡片 -->
      <section class="kpi-section">
        <h3 class="section-title">关键指标</h3>
        <div class="kpi-grid">
          <div class="kpi-card">
            <span class="kpi-label">用户总数</span>
            <span class="kpi-value">{{ kpi?.totalUsers ?? 0 }}</span>
          </div>
          <div class="kpi-card">
            <span class="kpi-label">情绪记录</span>
            <span class="kpi-value">{{ kpi?.totalMoodRecords ?? 0 }}</span>
          </div>
          <div class="kpi-card">
            <span class="kpi-label">测评次数</span>
            <span class="kpi-value">{{ kpi?.totalAssessments ?? 0 }}</span>
          </div>
          <div class="kpi-card">
            <span class="kpi-label">社区内容</span>
            <span class="kpi-value">{{ kpi?.totalPosts ?? 0 }}</span>
            <span class="kpi-sub">待审核 {{ kpi?.pendingPosts ?? 0 }}</span>
          </div>
          <div class="kpi-card">
            <span class="kpi-label">活动数</span>
            <span class="kpi-value">{{ kpi?.totalActivities ?? 0 }}</span>
          </div>
          <div class="kpi-card">
            <span class="kpi-label">AI 调用</span>
            <span class="kpi-value">{{ kpi?.totalAiCalls ?? 0 }}</span>
          </div>
          <div class="kpi-card">
            <span class="kpi-label">放松练习</span>
            <span class="kpi-value">{{ kpi?.totalRelaxSessions ?? 0 }}</span>
          </div>
          <div class="kpi-card">
            <span class="kpi-label">参与用户</span>
            <span class="kpi-value">{{ kpi?.moodRecordUsers ?? 0 }}</span>
            <span class="kpi-sub">情绪记录用户</span>
          </div>
        </div>
      </section>

      <!-- 图表区域 -->
      <section class="chart-section">
        <h3 class="section-title">情绪趋势</h3>
        <div class="chart-controls">
          <button
            :class="{ active: granularity === 'day' }"
            @click="granularity = 'day'; loadMoodTrend()"
          >按日</button>
          <button
            :class="{ active: granularity === 'week' }"
            @click="granularity = 'week'; loadMoodTrend()"
          >按周</button>
        </div>
        <div v-if="moodTrend.length === 0" class="empty-chart">还没有情绪趋势数据</div>
        <div v-else ref="trendChartRef" class="chart-box"></div>
      </section>

      <div class="chart-row">
        <section class="chart-section half">
          <h3 class="section-title">情绪分布</h3>
          <div v-if="moodDistribution.length === 0" class="empty-chart">还没有情绪分布数据</div>
          <div v-else ref="distributionChartRef" class="chart-box"></div>
        </section>

        <section class="chart-section half">
          <h3 class="section-title">模块使用</h3>
          <div v-if="moduleUsage.length === 0" class="empty-chart">还没有模块使用数据</div>
          <div v-else ref="moduleChartRef" class="chart-box"></div>
        </section>
      </div>

      <section class="chart-section">
        <h3 class="section-title">测评分布</h3>
        <div v-if="!assessmentDist || assessmentDist.instruments.length === 0" class="empty-chart">还没有测评数据</div>
        <div v-else ref="assessmentChartRef" class="chart-box"></div>
      </section>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, nextTick } from 'vue'
import * as echarts from 'echarts'
import {
  fetchKpiStats,
  fetchMoodTrend,
  fetchMoodDistribution,
  fetchAssessmentDistribution,
  fetchModuleUsage,
} from '@/api/adminAnalytics'
import type { KpiStats, MoodTrendItem, MoodDistributionItem, AssessmentDistribution, ModuleUsageItem } from '@/api/adminAnalytics'

const loading = ref(true)
const error = ref('')

const today = new Date().toISOString().split('T')[0]
const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
const startDate = ref(weekAgo)
const endDate = ref(today)
const granularity = ref<'day' | 'week'>('day')

const kpi = ref<KpiStats | null>(null)
const moodTrend = ref<MoodTrendItem[]>([])
const moodDistribution = ref<MoodDistributionItem[]>([])
const assessmentDist = ref<AssessmentDistribution | null>(null)
const moduleUsage = ref<ModuleUsageItem[]>([])

const trendChartRef = ref<HTMLDivElement>()
const distributionChartRef = ref<HTMLDivElement>()
const moduleChartRef = ref<HTMLDivElement>()
const assessmentChartRef = ref<HTMLDivElement>()

let trendChart: echarts.ECharts | null = null
let distributionChart: echarts.ECharts | null = null
let moduleChart: echarts.ECharts | null = null
let assessmentChart: echarts.ECharts | null = null

const loadAllData = async () => {
  loading.value = true
  error.value = ''
  try {
    await Promise.all([
      loadKpi(),
      loadMoodTrend(),
      loadMoodDistribution(),
      loadAssessmentDist(),
      loadModuleUsage(),
    ])
  } catch (err: any) {
    error.value = err?.message || '加载失败'
  } finally {
    loading.value = false
  }
}

const loadKpi = async () => {
  try {
    kpi.value = await fetchKpiStats(startDate.value, endDate.value)
  } catch { /* handled by loadAllData */ }
}

const loadMoodTrend = async () => {
  try {
    moodTrend.value = await fetchMoodTrend(startDate.value, endDate.value, granularity.value)
    await nextTick()
    renderTrendChart()
  } catch { /* handled by loadAllData */ }
}

const loadMoodDistribution = async () => {
  try {
    moodDistribution.value = await fetchMoodDistribution(startDate.value, endDate.value)
    await nextTick()
    renderDistributionChart()
  } catch { /* handled by loadAllData */ }
}

const loadAssessmentDist = async () => {
  try {
    assessmentDist.value = await fetchAssessmentDistribution(startDate.value, endDate.value)
    await nextTick()
    renderAssessmentChart()
  } catch { /* handled by loadAllData */ }
}

const loadModuleUsage = async () => {
  try {
    moduleUsage.value = await fetchModuleUsage(startDate.value, endDate.value)
    await nextTick()
    renderModuleChart()
  } catch { /* handled by loadAllData */ }
}

const renderTrendChart = () => {
  if (!trendChartRef.value) return
  if (!trendChart) {
    trendChart = echarts.init(trendChartRef.value)
  }
  trendChart.setOption({
    tooltip: { trigger: 'axis' },
    legend: { data: ['记录数', '平均强度'], bottom: 0 },
    grid: { left: 50, right: 50, top: 20, bottom: 40 },
    xAxis: { type: 'category', data: moodTrend.value.map((item) => item.date) },
    yAxis: [
      { type: 'value', name: '记录数' },
      { type: 'value', name: '强度', min: 0, max: 10 },
    ],
    series: [
      {
        name: '记录数',
        type: 'line',
        data: moodTrend.value.map((item) => item.count),
        smooth: true,
        itemStyle: { color: '#e8834a' },
      },
      {
        name: '平均强度',
        type: 'line',
        yAxisIndex: 1,
        data: moodTrend.value.map((item) => item.avgIntensity),
        smooth: true,
        itemStyle: { color: '#f0b860' },
      },
    ],
  })
}

const renderDistributionChart = () => {
  if (!distributionChartRef.value) return
  if (!distributionChart) {
    distributionChart = echarts.init(distributionChartRef.value)
  }
  distributionChart.setOption({
    tooltip: { trigger: 'item' },
    series: [
      {
        type: 'pie',
        radius: ['40%', '70%'],
        data: moodDistribution.value.map((item) => ({ name: item.type, value: item.count })),
        label: { show: true, formatter: '{b}\n{d}%' },
      },
    ],
  })
}

const renderModuleChart = () => {
  if (!moduleChartRef.value) return
  if (!moduleChart) {
    moduleChart = echarts.init(moduleChartRef.value)
  }
  moduleChart.setOption({
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    grid: { left: 100, right: 60, top: 20, bottom: 20 },
    xAxis: { type: 'value' },
    yAxis: {
      type: 'category',
      data: moduleUsage.value.map((item) => item.name),
    },
    series: [
      {
        type: 'bar',
        data: moduleUsage.value.map((item) => ({
          value: item.count,
          name: item.description,
        })),
        itemStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
            { offset: 0, color: '#e8834a' },
            { offset: 1, color: '#f0b860' },
          ]),
          borderRadius: [0, 4, 4, 0],
        },
      },
    ],
  })
}

const renderAssessmentChart = () => {
  if (!assessmentChartRef.value || !assessmentDist.value) return
  if (!assessmentChart) {
    assessmentChart = echarts.init(assessmentChartRef.value)
  }
  assessmentChart.setOption({
    tooltip: { trigger: 'axis' },
    legend: { data: ['量表分布', '得分区间', '风险等级'], bottom: 0 },
    grid: { left: 50, right: 50, top: 20, bottom: 40 },
    xAxis: { type: 'category', data: assessmentDist.value.instruments.map((item) => item.name) },
    yAxis: { type: 'value' },
    series: [
      {
        name: '量表分布',
        type: 'bar',
        data: assessmentDist.value.instruments.map((item) => item.count),
        itemStyle: { color: '#e8834a', borderRadius: [4, 4, 0, 0] },
      },
    ],
  })
}

// 图表响应式处理
const resizeCharts = () => {
  trendChart?.resize()
  distributionChart?.resize()
  moduleChart?.resize()
  assessmentChart?.resize()
}

onMounted(() => {
  loadAllData()
  window.addEventListener('resize', resizeCharts)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', resizeCharts)
  trendChart?.dispose()
  distributionChart?.dispose()
  moduleChart?.dispose()
  assessmentChart?.dispose()
})
</script>

<style scoped lang="scss">
.admin-dashboard {
  max-width: 1200px;
  margin: 0 auto;
  padding: 24px;
}

.dashboard-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
  flex-wrap: wrap;
  gap: 12px;

  h2 {
    margin: 0;
    font-size: 1.5rem;
    font-family: var(--font-display);
    color: var(--text-color, #1f2937);
  }
}

.time-filter {
  display: flex;
  align-items: center;
  gap: 8px;
}

.date-input {
  padding: 6px 12px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  font-size: 0.85rem;
  background: var(--surface);
  color: var(--text-color);
}

.date-sep {
  color: var(--muted, #9ca3af);
}

.loading-state {
  text-align: center;
  padding: 3rem;
}

.spinner {
  width: 2rem;
  height: 2rem;
  border: 3px solid var(--primary-soft);
  border-top-color: var(--primary-color);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin: 0 auto 1rem;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.error-state {
  text-align: center;
  padding: 3rem;
  color: var(--danger, #ef4444);
}

.retry-btn {
  margin-top: 1rem;
  padding: 0.5rem 1.5rem;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  background: var(--surface);
  cursor: pointer;
  color: var(--text-color);
  transition: all 0.2s;

  &:hover { background: var(--primary-soft); }
}

.section-title {
  margin: 0 0 12px;
  font-size: 1.1rem;
  color: var(--text-color, #374151);
}

.kpi-section {
  margin-bottom: 24px;
}

.kpi-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 12px;
}

.kpi-card {
  background: var(--surface);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  padding: 16px;
  text-align: center;
  box-shadow: var(--shadow-sm);
  transition: all 0.3s ease;

  &:hover { transform: translateY(-2px); box-shadow: var(--shadow-md); }

  .kpi-label {
    display: block;
    font-size: 0.8rem;
    color: var(--text-light-color);
    margin-bottom: 4px;
  }

  .kpi-value {
    display: block;
    font-size: 1.8rem;
    font-weight: 700;
    font-family: var(--font-display);
    color: var(--primary-color);
  }

  .kpi-sub {
    display: block;
    font-size: 0.75rem;
    color: var(--text-muted);
    margin-top: 2px;
  }
}

.chart-section {
  background: var(--surface);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  padding: 16px;
  margin-bottom: 16px;
  box-shadow: var(--shadow-sm);

  &.half {
    flex: 1;
    min-width: 300px;
  }
}

.chart-row {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
}

.chart-controls {
  display: flex;
  gap: 4px;
  margin-bottom: 12px;

  button {
    padding: 4px 12px;
    border: 1px solid var(--border-color);
    border-radius: 8px;
    background: var(--surface);
    font-size: 0.82rem;
    cursor: pointer;
    color: var(--text-color);
    transition: all 0.2s;

    &:hover { background: var(--primary-soft); }
    &.active {
      background: var(--primary-color);
      color: #fff;
      border-color: var(--primary-color);
    }
  }
}

.chart-box {
  width: 100%;
  height: 300px;
}

.empty-chart {
  height: 200px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #9ca3af;
  font-size: 0.9rem;
}
</style>