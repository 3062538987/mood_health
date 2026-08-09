<template>
  <div ref="chartRef" class="polarity-bar-chart"></div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch, onUnmounted } from 'vue'
import * as echarts from 'echarts'
import type { Polarity } from '@/types/moodInsight'

const props = defineProps<{
  data: Polarity
}>()

const chartRef = ref<HTMLElement | null>(null)
let chartInstance: echarts.ECharts | null = null

const renderChart = () => {
  if (!chartRef.value) return

  if (!chartInstance) {
    chartInstance = echarts.init(chartRef.value)
  }

  const option: echarts.EChartsOption = {
    tooltip: {
      trigger: 'axis',
      formatter: (params: unknown) => {
        const raw = Array.isArray(params) ? params[0] : params
        const p = raw as { name?: string; value?: number | string }
        return `${p.name}: ${p.value}%`
      },
    },
    grid: {
      top: 20,
      right: 20,
      bottom: 30,
      left: 45,
    },
    xAxis: {
      type: 'category',
      data: ['正面', '中性', '负面'],
      axisLabel: { color: '#94a3b8', fontSize: 12 },
      axisLine: { lineStyle: { color: '#e2e8f0' } },
      axisTick: { show: false },
    },
    yAxis: {
      type: 'value',
      max: 100,
      axisLabel: { color: '#94a3b8', fontSize: 11, formatter: '{value}%' },
      splitLine: { lineStyle: { color: '#f1f5f9', type: 'dashed' } },
    },
    series: [
      {
        type: 'bar',
        data: [
          { value: props.data.positive, itemStyle: { color: '#22c55e', borderRadius: [6, 6, 0, 0] } },
          { value: props.data.neutral, itemStyle: { color: '#3b82f6', borderRadius: [6, 6, 0, 0] } },
          { value: props.data.negative, itemStyle: { color: '#f97316', borderRadius: [6, 6, 0, 0] } },
        ],
        barWidth: 40,
        label: {
          show: true,
          position: 'top',
          formatter: '{c}%',
          color: '#64748b',
          fontSize: 11,
          fontWeight: 600,
        },
      },
    ],
  }

  chartInstance.setOption(option, true)
}

const handleResize = () => {
  chartInstance?.resize()
}

onMounted(() => {
  renderChart()
  window.addEventListener('resize', handleResize)
})

watch(() => props.data, () => {
  renderChart()
}, { deep: true })

onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
  chartInstance?.dispose()
})
</script>

<style scoped>
.polarity-bar-chart {
  width: 100%;
  height: 280px;
}
</style>