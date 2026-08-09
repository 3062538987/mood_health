<template>
  <div class="mood-comparison">
    <div class="comparison-header">
      <h3 class="title">周期对比</h3>
      <el-radio-group v-model="period" size="small" @change="loadData">
        <el-radio-button value="week">本周 vs 上周</el-radio-button>
        <el-radio-button value="month">本月 vs 上月</el-radio-button>
      </el-radio-group>
    </div>

    <div v-if="loading" class="loading-state">
      <el-icon class="is-loading"><Loading /></el-icon>
      <span>加载中...</span>
    </div>

    <div v-else-if="error" class="error-state">
      <p>{{ error }}</p>
      <el-button size="small" @click="loadData">重试</el-button>
    </div>

    <div v-else-if="isEmpty" class="empty-state">
      <p>{{ data?.changeDescription || '暂无对比数据' }}</p>
    </div>

    <div v-else class="comparison-content">
      <div ref="chartRef" class="chart-container"></div>
      <p class="change-text">{{ data?.changeDescription }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, nextTick, watch } from 'vue'
import { Loading } from '@element-plus/icons-vue'
import * as echarts from 'echarts'
import { fetchMoodComparison, type MoodComparison } from '@/api/moodComparison'

const period = ref<'week' | 'month'>('week')
const loading = ref(false)
const error = ref('')
const data = ref<MoodComparison | null>(null)
const chartRef = ref<HTMLElement | null>(null)
let chartInstance: echarts.ECharts | null = null

const isEmpty = ref(false)

const periodLabels: Record<string, { current: string; previous: string }> = {
  week: { current: '本周', previous: '上周' },
  month: { current: '本月', previous: '上月' },
}

async function loadData() {
  loading.value = true
  error.value = ''
  data.value = null
  isEmpty.value = false

  try {
    const result = await fetchMoodComparison(period.value)
    data.value = result
    if (result.thisPeriod.count === 0 && result.lastPeriod.count === 0) {
      isEmpty.value = true
    }
    await nextTick()
    renderChart()
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : '加载失败'
  } finally {
    loading.value = false
  }
}

function renderChart() {
  if (!chartRef.value || !data.value) return

  if (chartInstance) {
    chartInstance.dispose()
  }

  const labels = periodLabels[period.value]
  const d = data.value

  chartInstance = echarts.init(chartRef.value)
  chartInstance.setOption({
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
    },
    legend: {
      data: ['记录次数', '平均强度'],
      bottom: 0,
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '12%',
      top: '10%',
      containLabel: true,
    },
    xAxis: {
      type: 'category',
      data: [labels.previous, labels.current],
    },
    yAxis: [
      {
        type: 'value',
        name: '记录次数',
        minInterval: 1,
      },
      {
        type: 'value',
        name: '平均强度',
        min: 0,
        max: 10,
      },
    ],
    series: [
      {
        name: '记录次数',
        type: 'bar',
        data: [d.lastPeriod.count, d.thisPeriod.count],
        itemStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: '#667eea' },
            { offset: 1, color: '#764ba2' },
          ]),
          borderRadius: [4, 4, 0, 0],
        },
        barWidth: '40%',
      },
      {
        name: '平均强度',
        type: 'bar',
        yAxisIndex: 1,
        data: [d.lastPeriod.avgIntensity, d.thisPeriod.avgIntensity],
        itemStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: '#f093fb' },
            { offset: 1, color: '#f5576c' },
          ]),
          borderRadius: [4, 4, 0, 0],
        },
        barWidth: '40%',
      },
    ],
  })
}

function handleResize() {
  chartInstance?.resize()
}

onMounted(() => {
  loadData()
  window.addEventListener('resize', handleResize)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize)
  chartInstance?.dispose()
})
</script>

<style scoped>
.mood-comparison {
  background: #fff;
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
}

.comparison-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: #303133;
}

.chart-container {
  width: 100%;
  height: 260px;
}

.loading-state,
.error-state,
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  color: #909399;
  gap: 8px;
  min-height: 200px;
}

.error-state p {
  color: #f56c6c;
  margin: 0 0 8px 0;
}

.change-text {
  text-align: center;
  color: #606266;
  font-size: 13px;
  margin: 12px 0 0 0;
  line-height: 1.6;
}
</style>