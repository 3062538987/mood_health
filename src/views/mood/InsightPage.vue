<template>
  <div class="insight-page">
    <div class="page-header">
      <h2>情绪洞察</h2>
      <p class="subtitle">AI 分析你的情绪变化，帮助你更好地了解自己</p>
    </div>

    <!-- 时间范围选择 -->
    <div class="time-range-selector">
      <button
        v-for="range in timeRanges"
        :key="range.value"
        :class="['range-btn', { active: selectedRange === range.value }]"
        @click="selectRange(range.value)"
      >
        {{ range.label }}
      </button>
    </div>

    <!-- 加载状态 -->
    <div class="insight-loading" v-if="loading">
      <div class="skeleton-card">
        <div class="skeleton-line"></div>
        <div class="skeleton-line short"></div>
        <div class="skeleton-line medium"></div>
      </div>
    </div>

    <!-- 空状态 -->
    <div class="insight-empty" v-else-if="!insight && !error">
      <div class="empty-icon">📊</div>
      <p class="empty-title">你还没有开始记录情绪哦</p>
      <p class="empty-desc">记录几天的情绪后，AI 将为你生成专属洞察</p>
      <router-link to="/mood/record" class="go-record-btn">去记录</router-link>
    </div>

    <!-- 错误状态 -->
    <div class="insight-error" v-else-if="error">
      <p>{{ error }}</p>
      <button @click="fetchInsight" class="retry-btn">重新加载</button>
    </div>

    <!-- 洞察内容 -->
    <div class="insight-content" v-else-if="insight">
      <div class="insight-card">
        <div class="card-header">
          <span class="ai-badge">AI 洞察</span>
          <span class="card-time">{{ selectedRangeLabel }}</span>
        </div>
        <div class="card-body">
          <p class="insight-text">{{ insight.content }}</p>
        </div>
      </div>

      <!-- 情绪趋势简图 -->
      <div class="trend-section" v-if="insight.trend">
        <h3>情绪趋势</h3>
        <div class="trend-chart">
          <div class="trend-bar" v-for="(item, idx) in insight.trend" :key="idx"
            :style="{ height: item.level + '%', background: getTrendColor(item.level) }">
            <span class="trend-label">{{ item.label }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { getMoodInsight } from '@/api/moodAnalysis'

interface TrendItem {
  label: string
  level: number
}

interface InsightData {
  content: string
  trend?: TrendItem[]
}

const selectedRange = ref('week')
const timeRanges = [
  { label: '今日', value: 'day' },
  { label: '本周', value: 'week' },
  { label: '本月', value: 'month' },
  { label: '今年', value: 'year' },
]

const insight = ref<InsightData | null>(null)
const loading = ref(false)
const error = ref('')

const selectedRangeLabel = computed(() => {
  const range = timeRanges.find(r => r.value === selectedRange.value)
  return range ? range.label : '本周'
})

const fetchInsight = async () => {
  loading.value = true
  error.value = ''
  insight.value = null
  try {
    const res = await getMoodInsight({ period: selectedRange.value })
    insight.value = res.data || res
  } catch {
    error.value = '获取洞察失败，请稍后重试'
  } finally {
    loading.value = false
  }
}

const selectRange = (range: string) => {
  if (selectedRange.value === range) return
  selectedRange.value = range
  fetchInsight()
}

const getTrendColor = (level: number) => {
  if (level > 60) return 'linear-gradient(to top, #667eea, #764ba2)'
  if (level > 30) return 'linear-gradient(to top, #f093fb, #f5576c)'
  return 'linear-gradient(to top, #a8edea, #fed6e3)'
}

onMounted(() => {
  fetchInsight()
})
</script>

<style scoped>
.insight-page {
  max-width: 800px;
  margin: 0 auto;
  padding: 24px 20px;
}

.page-header {
  margin-bottom: 24px;
}

.page-header h2 {
  font-size: 24px;
  font-weight: 600;
  color: #1a1a2e;
  margin: 0 0 8px 0;
}

.subtitle {
  font-size: 14px;
  color: #888;
  margin: 0;
}

.time-range-selector {
  display: flex;
  gap: 8px;
  margin-bottom: 24px;
  background: #f5f5f5;
  border-radius: 12px;
  padding: 4px;
}

.range-btn {
  flex: 1;
  padding: 8px 16px;
  border: none;
  border-radius: 10px;
  background: transparent;
  font-size: 14px;
  color: #666;
  cursor: pointer;
  transition: all 0.2s;
}

.range-btn.active {
  background: #fff;
  color: #667eea;
  font-weight: 600;
  box-shadow: 0 2px 8px rgba(0,0,0,0.08);
}

.range-btn:hover:not(.active) {
  color: #333;
}

/* 加载骨架 */
.skeleton-card {
  padding: 24px;
  background: #fff;
  border-radius: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.skeleton-line {
  height: 14px;
  background: linear-gradient(90deg, #e0e0e0 25%, #f0f0f0 50%, #e0e0e0 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
  border-radius: 4px;
  width: 100%;
}

.skeleton-line.short { width: 60%; }
.skeleton-line.medium { width: 80%; }

@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

/* 空状态 */
.insight-empty {
  text-align: center;
  padding: 60px 20px;
}

.empty-icon {
  font-size: 48px;
  margin-bottom: 16px;
}

.empty-title {
  font-size: 18px;
  color: #333;
  margin: 0 0 8px 0;
}

.empty-desc {
  font-size: 14px;
  color: #999;
  margin: 0 0 24px 0;
}

.go-record-btn {
  display: inline-block;
  padding: 10px 32px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #fff;
  border-radius: 24px;
  text-decoration: none;
  font-size: 14px;
  font-weight: 500;
}

/* 错误状态 */
.insight-error {
  text-align: center;
  padding: 40px 20px;
  color: #e74c3c;
}

.retry-btn {
  margin-top: 12px;
  padding: 8px 24px;
  border: 1px solid #667eea;
  background: #fff;
  color: #667eea;
  border-radius: 20px;
  cursor: pointer;
  font-size: 14px;
}

/* 洞察卡片 */
.insight-card {
  background: #fff;
  border-radius: 16px;
  padding: 24px;
  box-shadow: 0 2px 16px rgba(0,0,0,0.06);
  margin-bottom: 20px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.ai-badge {
  display: inline-block;
  padding: 3px 12px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #fff;
  font-size: 12px;
  border-radius: 10px;
  font-weight: 500;
}

.card-time {
  font-size: 13px;
  color: #999;
}

.insight-text {
  font-size: 15px;
  line-height: 1.8;
  color: #333;
  white-space: pre-wrap;
  margin: 0;
}

/* 趋势图 */
.trend-section {
  background: #fff;
  border-radius: 16px;
  padding: 24px;
  box-shadow: 0 2px 16px rgba(0,0,0,0.06);
}

.trend-section h3 {
  font-size: 16px;
  font-weight: 600;
  color: #1a1a2e;
  margin: 0 0 20px 0;
}

.trend-chart {
  display: flex;
  align-items: flex-end;
  gap: 12px;
  height: 160px;
  padding: 0 4px;
}

.trend-bar {
  flex: 1;
  min-height: 20px;
  border-radius: 8px 8px 0 0;
  position: relative;
  transition: height 0.5s ease;
}

.trend-label {
  position: absolute;
  bottom: -24px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 11px;
  color: #999;
  white-space: nowrap;
}
</style>