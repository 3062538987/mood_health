<template>
  <div ref="chartRef" class="intensity-trend-chart"></div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch, onUnmounted } from 'vue'
import * as echarts from 'echarts'
import type { TrendItem } from '@/types/moodInsight'

const props = defineProps<{
  data: TrendItem[]
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
        const p = raw as { axisValue?: string; value: number; dataIndex: number }
        return `${p.axisValue}<br/>平均强度: ${p.value.toFixed(1)}<br/>主导情绪: ${props.data[p.dataIndex]?.dominantEmotion || '--'}<br/>记录数: ${props.data[p.dataIndex]?.recordCount || 0}`
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
      data: props.data.map((d) => d.date),
      axisLabel: { color: '#94a3b8', fontSize: 11 },
      axisLine: { lineStyle: { color: '#e2e8f0' } },
      axisTick: { show: false },
    },
    yAxis: {
      type: 'value',
      min: 0,
      max: 10,
      interval: 2,
      axisLabel: { color: '#94a3b8', fontSize: 11 },
      splitLine: { lineStyle: { color: '#f1f5f9', type: 'dashed' } },
    },
    series: [
      {
        type: 'line',
        data: props.data.map((d) => d.avgIntensity),
        smooth: true,
        symbol: 'circle',
        symbolSize: 6,
        lineStyle: {
          color: '#8b5cf6',
          width: 2.5,
        },
        itemStyle: {
          color: '#8b5cf6',
          borderColor: '#fff',
          borderWidth: 2,
        },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(139, 92, 246, 0.25)' },
            { offset: 1, color: 'rgba(139, 92, 246, 0.02)' },
          ]),
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
.intensity-trend-chart {
  width: 100%;
  height: 300px;
}
</style>