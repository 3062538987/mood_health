<template>
  <div class="mood-chart">
    <div v-loading="loading" class="chart-container">
      <div ref="chartRef" class="chart"></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { init, type EChartsType } from '@/utils/echarts'
import { MoodTrendResponse } from '@/types/mood'

interface ChartPoint {
  date: string
  intensity: number
  x: number
  y: number
  note?: string
  triggers?: string[]
}

const props = defineProps<{
  chartData: MoodTrendResponse | null
  loading: boolean
}>()

const emit = defineEmits<{
  (e: 'hover-point', point: ChartPoint): void
  (e: 'leave-point'): void
}>()

const chartRef = ref<HTMLElement | null>(null)
const chart = ref<EChartsType | null>(null)

// 初始化图表
const initChart = () => {
  if (!chartRef.value) return

  if (!chart.value) {
    chart.value = init(chartRef.value)
  }

  updateChart()
}

// 更新图表
const updateChart = () => {
  if (!chart.value || !props.chartData) return

  const data = props.chartData

  const option = {
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        type: 'cross',
        label: {
          backgroundColor: '#6a7985',
        },
      },
    },
    legend: {
      data: data.datasets?.map((dataset) => dataset.name) || [],
      top: 30,
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      containLabel: true,
    },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: data.labels || [],
    },
    yAxis: {
      type: 'value',
      min: 0,
      max: 5,
      interval: 1,
    },
    series:
      data.datasets?.map((dataset) => ({
        name: dataset.name,
        type: 'line',
        stack: 'Total',
        areaStyle: {},
        emphasis: {
          focus: 'series',
        },
        data: dataset.data || [],
      })) || [],
  }

  chart.value.setOption(option)

  chart.value.off('mousemove')
  chart.value.off('mouseout')

  chart.value.on('mousemove', (params: unknown) => {
    const point = params as { dataIndex: number; componentType: string }
    if (point.componentType === 'series' && data.data) {
      const chartData = data.data[point.dataIndex]
      const chartPoint: ChartPoint = {
        date: chartData.date,
        intensity: chartData.intensity,
        x: 0,
        y: 0,
        note: chartData.note,
        triggers: chartData.triggers,
      }
      emit('hover-point', chartPoint)
    }
  })

  chart.value.on('mouseout', () => {
    emit('leave-point')
  })
}

// 监听窗口大小变化
const handleResize = () => {
  chart.value?.resize()
}

// 监听数据变化
watch(
  () => props.chartData,
  () => {
    updateChart()
  },
  { deep: true }
)

// 生命周期钩子
onMounted(() => {
  initChart()
  window.addEventListener('resize', handleResize)
})

// 组件卸载时清理
onUnmounted(() => {
  window.removeEventListener('resize', handleResize)
  chart.value?.dispose()
})
</script>

<style scoped lang="scss">
.mood-chart {
  .chart-container {
    position: relative;
    width: 100%;
    height: 400px;
    background-color: #fff;
    border-radius: 8px;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    padding: 20px;
  }

  .chart {
    width: 100%;
    height: 100%;
  }

  :deep(.el-loading-spinner) {
    font-size: 14px;
  }
}

// 响应式设计
@media (max-width: 768px) {
  .mood-chart {
    .chart-container {
      height: 300px;
      padding: 15px;
    }
  }
}

@media (max-width: 480px) {
  .mood-chart {
    .chart-container {
      height: 250px;
      padding: 10px;
    }
  }
}
</style>
