<template>
  <div class="mood-analysis">
    <div class="container">
      <header class="analysis-header">
        <div>
          <p class="eyebrow">情绪分析</p>
          <h2>了解自己的情绪模式</h2>
          <p class="header-copy">基于你的情绪记录，生成数据事实和分析建议</p>
        </div>
      </header>

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

      <SoftLoadingState
        v-if="pageLoading"
        title="正在整理你的情绪内容"
        description="界面会以更轻柔的方式出现，请稍等一下。"
        variant="panel"
        :item-count="4"
      />

      <div v-else-if="pageError" class="error-state">
        <div class="error-icon">
          <i class="fas fa-exclamation-circle"></i>
        </div>
        <h3>{{ messages.error.server.title }}</h3>
        <p>{{ messages.error.server.description }}</p>
        <button type="button" class="error-retry" @click="loadData">{{ messages.error.server.action }}</button>
      </div>

      <SoftEmptyState
        v-else-if="isEmpty"
        :title="`还没有${periodLabel}的情绪数据`"
        :description="messages.empty.moodAnalysis.description"
        :action-text="messages.empty.moodAnalysis.action"
        @action="goRecord"
      />

      <template v-else>
        <section v-if="latestAnalysis" class="analysis-status-section">
          <AnalysisStatus
            :status="latestAnalysis.status"
            :job="latestAnalysis.job"
            :is-retrying="isRetrying"
            @retry="retryAnalysis"
          />
        </section>

        <section v-else-if="!isEmpty" class="generate-analysis-section">
          <button type="button" class="generate-btn" :disabled="isRetrying" @click="generateAnalysis">
            <i class="fas fa-wand-magic-sparkles"></i>
            {{ isRetrying ? '正在生成分析…' : `生成${periodLabel}情绪分析` }}
          </button>
          <p class="generate-hint">基于已记录的情绪数据，由 AI 生成本周期的分析与建议</p>
        </section>

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

        <section v-if="aiResult" class="ai-analysis-section">
          <AiAnalysisResultComponent
            :result="aiResult"
            :period="currentPeriod"
            :is-single-record="isSingleRecord"
            :has-enough-data="hasEnoughData"
          />
        </section>

        <section v-else-if="latestAnalysis?.status === 'succeeded'" class="ai-empty-state">
          <div class="ai-empty-icon">
            <i class="fas fa-robot"></i>
          </div>
          <p>AI 分析结果正在加载中</p>
          <button type="button" class="ai-retry-btn" @click="refreshAiAnalysis">刷新分析</button>
        </section>

        <section class="support-resources">
          <h3 class="support-title">
            <i class="fas fa-heart-handshake"></i> 需要支持？
          </h3>
          <div class="support-grid">
            <router-link to="/counseling" class="support-card">
              <div class="support-icon" style="background: rgba(59, 130, 246, 0.1); color: #3b82f6;">
                <i class="fas fa-comments"></i>
              </div>
              <div class="support-info">
                <h4>AI 心理咨询</h4>
                <p>与 AI 对话，获取专业的情绪疏导建议</p>
              </div>
              <i class="fas fa-arrow-right support-arrow"></i>
            </router-link>
            <router-link v-if="featureFlags.nonCoreModules" to="/relax/treehole" class="support-card">
              <div class="support-icon" style="background: rgba(139, 92, 246, 0.1); color: #8b5cf6;">
                <i class="fas fa-tree"></i>
              </div>
              <div class="support-info">
                <h4>树洞倾诉</h4>
                <p>匿名分享心情，获得温暖的回应</p>
              </div>
              <i class="fas fa-arrow-right support-arrow"></i>
            </router-link>
            <router-link to="/improve/courses" class="support-card">
              <div class="support-icon" style="background: rgba(34, 197, 94, 0.1); color: #22c55e;">
                <i class="fas fa-book-open"></i>
              </div>
              <div class="support-info">
                <h4>心理课程</h4>
                <p>学习情绪管理技巧，提升心理韧性</p>
              </div>
              <i class="fas fa-arrow-right support-arrow"></i>
            </router-link>
            <div class="support-card emergency-card">
              <div class="support-icon" style="background: rgba(239, 68, 68, 0.1); color: #ef4444;">
                <i class="fas fa-phone"></i>
              </div>
              <div class="support-info">
                <h4>紧急援助</h4>
                <p>全国心理援助热线：12356</p>
              </div>
              <a href="tel:12356" class="support-arrow"><i class="fas fa-phone"></i></a>
            </div>
          </div>
        </section>

        <section v-if="showHistory" class="history-section">
          <AnalysisHistoryComponent
            :history="historyData"
            :loading="historyLoading"
            @select="selectHistoryItem"
            @refresh="loadHistory"
          />
        </section>

        <section class="privacy-section">
          <AnalysisPrivacy
            :uses-journal="latestAnalysis?.job?.usesJournalExcerpt || false"
            @toggle="toggleJournalUsage"
          />
        </section>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { featureFlags } from '@/config/featureFlags'
import { messages } from '@/constants/messages'
import { getMoodInsight } from '@/api/moodInsight'
import { getLatestAnalysis, retryAnalysis as apiRetryAnalysis, createAnalysis, getAnalysisHistory } from '@/api/moodAnalysis'
import type { MoodInsightResponse, InsightPeriod, Polarity } from '@/types/moodInsight'
import type { AnalysisPeriod, AnalysisHistoryItem, AiAnalysisResult } from '@/types/moodAnalysis'
import type { AnalysisResponse } from '@/api/moodAnalysis'
import EmotionPieChart from './components/EmotionPieChart.vue'
import IntensityTrendChart from './components/IntensityTrendChart.vue'
import PolarityBarChart from './components/PolarityBarChart.vue'
import SoftLoadingState from '@/components/shared/SoftLoadingState.vue'
import SoftEmptyState from '@/components/shared/SoftEmptyState.vue'
import AnalysisStatus from './analysis/AnalysisStatus.vue'
import AiAnalysisResultComponent from './analysis/AiAnalysisResult.vue'
import AnalysisHistoryComponent from './analysis/AnalysisHistory.vue'
import AnalysisPrivacy from './analysis/AnalysisPrivacy.vue'

const router = useRouter()

const periods = [
  { key: '7d' as AnalysisPeriod, label: '7天' },
  { key: '1m' as AnalysisPeriod, label: '1个月' },
  { key: '3m' as AnalysisPeriod, label: '3个月' },
  { key: '6m' as AnalysisPeriod, label: '6个月' },
  { key: '1y' as AnalysisPeriod, label: '1年' },
]

const currentPeriod = ref<AnalysisPeriod>('7d')
const periodLabel = computed(() => {
  const map: Record<AnalysisPeriod, string> = { '7d': '7天', '1m': '1个月', '3m': '3个月', '6m': '6个月', '1y': '1年' }
  return map[currentPeriod.value] || '当前'
})

const pageLoading = ref(true)
const pageError = ref(false)
const insightData = ref<MoodInsightResponse | null>(null)
const isEmpty = computed(() => {
  return insightData.value && insightData.value.summary.totalRecords === 0
})

const latestAnalysis = ref<AnalysisResponse | null>(null)
const aiResult = ref<AiAnalysisResult | null>(null)
const isRetrying = ref(false)
const showHistory = computed(() => {
  return insightData.value?.summary.totalRecords && insightData.value.summary.totalRecords > 3
})

const isSingleRecord = computed(() => {
  return insightData.value?.summary.totalRecords === 1
})

const hasEnoughData = computed(() => {
  const count = insightData.value?.summary.totalRecords ?? 0
  return count >= 7
})

const polarityData = computed<Polarity>(() => {
  return insightData.value?.polarity ?? { positive: 0, neutral: 0, negative: 0 }
})

const historyData = ref<AnalysisHistoryItem[]>([])
const historyLoading = ref(false)

const loadData = async () => {
  pageLoading.value = true
  pageError.value = false
  try {
    const insightPeriod = convertPeriod(currentPeriod.value)
    const data = await getMoodInsight(insightPeriod)
    insightData.value = data
    
    if (data.summary.totalRecords > 0) {
      await Promise.all([loadAnalysis(), loadHistory()])
    }
  } catch {
    pageError.value = true
  } finally {
    pageLoading.value = false
  }
}

const convertPeriod = (period: AnalysisPeriod): InsightPeriod => {
  const map: Record<AnalysisPeriod, InsightPeriod> = {
    '7d': 'week',
    '1m': 'month',
    '3m': 'month',
    '6m': 'month',
    '1y': 'year',
  }
  return map[period] || 'week'
}

const loadAnalysis = async () => {
  try {
    const analysis = await getLatestAnalysis(currentPeriod.value)
    latestAnalysis.value = analysis
    
    if (analysis?.status === 'succeeded' && analysis.result) {
      aiResult.value = analysis.result ?? null
    }
  } catch {
    latestAnalysis.value = null
  }
}

const loadHistory = async () => {
  historyLoading.value = true
  try {
    const result = await getAnalysisHistory({ period: currentPeriod.value, page: 1, pageSize: 10 })
    historyData.value = result.data
  } catch {
    historyData.value = []
  } finally {
    historyLoading.value = false
  }
}

const switchPeriod = (period: AnalysisPeriod) => {
  if (currentPeriod.value === period) return
  currentPeriod.value = period
  aiResult.value = null
  loadData()
}

/**
 * 触发分析后轮询最新版本，直到终态（succeeded / retryable_failed）或超时。
 * 后端 runAnalysis 会同步阻塞等待 AI（最长约 60s）再落库，
 * 因此前端不依赖触发接口立即返回结果，而是轮询 GET /latest 拿到已落库的结果。
 */
const pollUntilDone = async (period: AnalysisPeriod, timeoutMs = 70000): Promise<void> => {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const analysis = await getLatestAnalysis(period)
    latestAnalysis.value = analysis
    if (analysis?.status === 'succeeded' && analysis.result) {
      aiResult.value = analysis.result
      return
    }
    if (analysis?.status === 'retryable_failed') {
      throw new Error('AI 分析失败，请点击重新分析重试')
    }
    await new Promise((resolve) => setTimeout(resolve, 2000))
  }
  throw new Error('分析耗时较长，请稍后刷新查看结果')
}

/** 触发分析（容忍其超时/报错）随后轮询结果，直到拿到已落库的内容 */
const triggerAndPoll = async (id: string): Promise<void> => {
  try {
    await apiRetryAnalysis(id)
  } catch {
    // 触发接口可能超时或被 502 拒绝，但不阻断轮询：后端可能已将结果落库
  }
  await pollUntilDone(currentPeriod.value)
}

const retryAnalysis = async () => {
  const id = latestAnalysis.value?.id
  if (!id) return
  isRetrying.value = true
  try {
    await triggerAndPoll(id)
  } catch (err) {
    ElMessage.error(err instanceof Error ? err.message : '分析失败，请稍后重试')
  } finally {
    isRetrying.value = false
  }
}

/**
 * 生成/重新生成分析：若还没有分析版本则先创建，再触发 AI 分析并轮询结果。
 * 这是前端真正打通「AI 结果落库 → 展示」的入口。
 */
const generateAnalysis = async () => {
  if (isRetrying.value) return
  isRetrying.value = true
  try {
    let id = latestAnalysis.value?.id
    if (!id) {
      const created = await createAnalysis({ period: currentPeriod.value })
      // 后端在「该周期内无情绪记录」时返回 null（HTTP 200 + data:null），
      // 必须守卫，否则 created.id 会 TypeError 崩溃。
      if (!created) {
        ElMessage.warning('该周期内还没有情绪记录，先去记录一下心情吧')
        return
      }
      id = created.id
      latestAnalysis.value = created
    }
    await triggerAndPoll(id)
  } catch (err) {
    ElMessage.error(err instanceof Error ? err.message : '分析失败，请稍后重试')
  } finally {
    isRetrying.value = false
  }
}

const refreshAiAnalysis = () => {
  loadAnalysis()
}

const selectHistoryItem = (item: { id: string }) => {
  loadAnalysis()
}

const toggleJournalUsage = (enabled: boolean) => {
  console.log('Toggle journal usage:', enabled)
}

const goRecord = () => {
  router.push('/mood/record')
}

onMounted(() => {
  loadData()
})
</script>

<style scoped>
.mood-analysis {
  min-height: 100vh;
  padding: 32px 0 64px;
}

.container {
  max-width: 960px;
  margin: 0 auto;
  padding: 0 20px;
}

.analysis-header {
  margin-bottom: 28px;
}

.eyebrow {
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--primary-color);
  margin: 0 0 4px;
  font-weight: 600;
}

.analysis-header h2 {
  font-size: 26px;
  font-weight: 700;
  color: var(--text-color);
  margin: 0 0 6px;
  font-family: var(--font-display);
}

.header-copy {
  font-size: 14px;
  color: var(--text-light-color);
  margin: 0;
}

.period-switcher {
  display: flex;
  gap: 8px;
  margin-bottom: 28px;
  background: var(--surface-muted);
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
  color: var(--text-light-color);
  background: transparent;
  cursor: pointer;
  transition: all 0.2s;
}

.period-btn:hover {
  color: var(--text-color);
}

.period-btn.active {
  background: var(--surface);
  color: var(--primary-color);
  font-weight: 600;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
}

.error-state {
  text-align: center;
  padding: 64px 20px;
}

.error-icon {
  width: 72px;
  height: 72px;
  border-radius: 50%;
  background: rgba(224, 85, 106, 0.1);
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 16px;
  font-size: 28px;
  color: var(--status-danger);
}

.error-state h3 {
  font-size: 18px;
  color: var(--text-color);
  margin: 0 0 8px;
}

.error-state p {
  font-size: 14px;
  color: var(--text-light-color);
  margin: 0 0 20px;
}

.error-retry {
  padding: 10px 24px;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  color: #fff;
  background: var(--primary-color);
  cursor: pointer;
  transition: background 0.2s;
}

.error-retry:hover {
  background: var(--primary-hover);
}

.summary-cards {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
  margin-bottom: 24px;
}

.summary-card {
  background: var(--surface);
  border-radius: 14px;
  padding: 20px;
  display: flex;
  align-items: center;
  gap: 14px;
  box-shadow: var(--shadow-sm);
  border: 1px solid var(--border-color);
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
  color: var(--text-light-color);
  margin-bottom: 2px;
}

.card-value {
  font-size: 22px;
  font-weight: 700;
  color: var(--text-color);
  line-height: 1.2;
}

.card-unit {
  font-size: 11px;
  color: var(--text-light-color);
}

.charts-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  margin-bottom: 24px;
}

.chart-card {
  background: var(--surface);
  border-radius: 14px;
  padding: 20px;
  box-shadow: var(--shadow-sm);
  border: 1px solid var(--border-color);
}

.chart-card-full {
  grid-column: 1 / -1;
}

.chart-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-color);
  margin: 0 0 12px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.chart-title i {
  color: var(--primary-color);
  font-size: 14px;
}

.analysis-status-section {
  margin-bottom: 24px;
}

.generate-analysis-section {
  margin-bottom: 24px;
  padding: 28px 24px;
  text-align: center;
  background: var(--surface);
  border-radius: 16px;
  border: 1px solid var(--border-color);
}

.generate-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 12px 24px;
  font-size: 15px;
  font-weight: 600;
  color: #fff;
  background: linear-gradient(135deg, var(--primary-color), var(--primary-dark, #6d28d9));
  border: none;
  border-radius: 12px;
  cursor: pointer;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
  box-shadow: 0 6px 18px rgba(124, 58, 237, 0.25);
}

.generate-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 10px 24px rgba(124, 58, 237, 0.32);
}

.generate-btn:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.generate-hint {
  margin: 12px 0 0;
  font-size: 13px;
  color: var(--text-light-color);
}

.ai-analysis-section {
  margin-bottom: 24px;
}

.ai-empty-state {
  text-align: center;
  padding: 40px;
  background: var(--surface);
  border-radius: 14px;
  border: 1px dashed var(--border-color);
}

.ai-empty-icon {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: rgba(139, 92, 246, 0.1);
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 12px;
  font-size: 24px;
  color: #8b5cf6;
}

.ai-empty-state p {
  margin: 0 0 16px;
  color: var(--text-light-color);
}

.ai-retry-btn {
  padding: 8px 20px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background: var(--surface);
  color: var(--text-color);
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
}

.ai-retry-btn:hover {
  background: var(--surface-muted);
}

.support-resources {
  margin-bottom: 24px;
}

.support-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-color);
  margin: 0 0 16px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.support-title i {
  color: var(--primary-color);
}

.support-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

.support-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  background: var(--surface);
  border-radius: 14px;
  border: 1px solid var(--border-color);
  text-decoration: none;
  transition: all 0.2s;
}

.support-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-sm);
  border-color: var(--primary-color);
}

.support-icon {
  width: 40px;
  height: 40px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  flex-shrink: 0;
}

.support-info {
  flex: 1;
  min-width: 0;
}

.support-info h4 {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-color);
  margin: 0 0 4px;
}

.support-info p {
  font-size: 12px;
  color: var(--text-light-color);
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.support-arrow {
  font-size: 14px;
  color: var(--text-light-color);
  flex-shrink: 0;
}

.support-card:hover .support-arrow {
  color: var(--primary-color);
}

.emergency-card {
  background: rgba(239, 68, 68, 0.05);
  border-color: rgba(239, 68, 68, 0.2);
}

.emergency-card .support-info h4 {
  color: #ef4444;
}

.emergency-card a.support-arrow {
  color: #ef4444;
}

.history-section {
  margin-bottom: 24px;
}

.privacy-section {
  background: var(--surface-muted);
  border-radius: 12px;
  padding: 16px;
}

@media (max-width: 768px) {
  .summary-cards {
    grid-template-columns: 1fr;
  }
  .charts-grid {
    grid-template-columns: 1fr;
  }
}
</style>