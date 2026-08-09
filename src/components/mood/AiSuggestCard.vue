<template>
  <section class="ai-suggest-card">
    <div class="card-head">
      <div>
        <p class="eyebrow">智能情绪建议</p>
        <h3>让建议更像是陪你一起梳理</h3>
      </div>
      <button
        type="button"
        class="primary-btn"
        :class="{ loading }"
        :disabled="loading || serviceUnavailable"
        @click="emit('generate')"
      >
        {{
          loading
            ? '生成中...'
            : serviceUnavailable
              ? `服务恢复中 (${disabledSeconds}s)`
              : '获取建议'
        }}
      </button>
    </div>

    <p v-if="serviceMessage" class="service-notice">{{ serviceMessage }}</p>

    <div v-if="autoRecommendations.length > 0" class="auto-guide">
      <span class="guide-label">自动推荐</span>
      <ul>
        <li v-for="item in autoRecommendations" :key="item">{{ item }}</li>
      </ul>
    </div>

    <SoftLoadingState
      v-if="loading"
      variant="panel"
      :item-count="3"
      title="正在整理你的心情线索"
      description="它会结合文字、情绪类型和触发因素，生成更贴近当下的建议。"
    />

    <!-- 四段式结构化分析 -->
    <div
      v-else-if="fourSection"
      class="result-panel"
      :class="{ 'high-risk': fourSection.whenToSeekHelp && fourSection.whenToSeekHelp.includes('立刻') }"
    >
      <div class="result-head">
        <div class="mood-pill" :style="{ '--pill-color': moodMeta?.color || '#6366f1' }">
          <span>{{ moodMeta?.emoji }}</span>
          <strong>{{ moodMeta?.label || '当前情绪' }}</strong>
        </div>
        <div class="head-actions">
          <button type="button" class="ghost-btn" @click="emit('copy')">复制建议</button>
        </div>
      </div>

      <!-- 数据范围提示 -->
      <p v-if="dataScope" class="data-scope">
        <span class="scope-icon">📊</span>
        基于近 {{ dataScope.dateRange }} 的 {{ dataScope.moodRecordCount }} 条情绪记录
        <template v-if="dataScope.hasAssessment">和最近一次测评结果</template>
        生成
      </p>

      <section class="four-section">
        <!-- 现状概括 -->
        <div class="section-block summary">
          <h4 class="section-title">
            <span class="section-icon">📝</span>现状概括
          </h4>
          <p>{{ fourSection.summary }}</p>
        </div>

        <!-- 可能原因 -->
        <div class="section-block causes">
          <h4 class="section-title">
            <span class="section-icon">🔍</span>可能原因
          </h4>
          <p>{{ fourSection.possibleCauses }}</p>
        </div>

        <!-- 今日行动 -->
        <div class="section-block actions">
          <h4 class="section-title">
            <span class="section-icon">✨</span>今日行动
          </h4>
          <ul>
            <li v-for="(action, idx) in fourSection.todayActions" :key="idx">
              <span class="action-index">{{ idx + 1 }}</span>
              {{ action }}
            </li>
          </ul>
        </div>

        <!-- 何时求助 -->
        <div class="section-block seek-help">
          <h4 class="section-title">
            <span class="section-icon">💡</span>何时求助
          </h4>
          <p>{{ fourSection.whenToSeekHelp }}</p>
        </div>
      </section>

      <AiDisclaimer />
    </div>

    <div v-else-if="result" class="result-panel">
      <div class="result-head">
        <div class="mood-pill" :style="{ '--pill-color': moodMeta?.color || '#6366f1' }">
          <span>{{ moodMeta?.emoji }}</span>
          <strong>{{ moodMeta?.label || '当前情绪' }}</strong>
        </div>
        <div class="head-actions">
          <button type="button" class="ghost-btn" @click="emit('copy')">复制建议</button>
          <button type="button" class="ghost-btn primary" @click="emit('applyAll')">
            填入触发因素
          </button>
        </div>
      </div>

      <p class="analysis">{{ result.analysis }}</p>

      <div class="suggestion-list">
        <article v-for="(item, index) in result.suggestions" :key="item" class="suggestion-item">
          <div>
            <span class="index">{{ index + 1 }}</span>
            <p>{{ item }}</p>
          </div>
          <button type="button" class="mini-btn" @click="emit('applyOne', index)">
            用作触发因素
          </button>
        </article>
      </div>

      <div v-if="analysisHistoryId" class="feedback-row">
        <template v-if="feedbackSubmitted">
          <span class="feedback-thanks">感谢反馈</span>
        </template>
        <template v-else>
          <span class="feedback-label">这个建议对你有帮助吗？</span>
          <button class="feedback-btn helpful" :disabled="feedbackLoading" @click="submitFeedback('helpful')">
            👍 有帮助
          </button>
          <button class="feedback-btn not-helpful" :disabled="feedbackLoading" @click="submitFeedback('not_helpful')">
            👎 没帮助
          </button>
        </template>
      </div>

      <AiDisclaimer />
    </div>

    <SoftEmptyState
      v-else
      compact
      title="先写一点心情，建议模块再跟上"
      description="你可以先描述发生了什么，或者点几枚情绪类型，系统会更容易读懂你。"
      :action-text="
        serviceUnavailable
          ? `服务恢复中 (${disabledSeconds}s)`
          : canGenerate
            ? '立即生成建议'
            : '先补充描述'
      "
      @action="emit('generate')"
    />

    <div class="history-panel">
      <div class="history-head">
        <h4>最近的建议</h4>
        <span>{{ history.length }} 条</span>
      </div>

      <div v-if="historyLoading" class="history-loading">正在加载历史建议...</div>

      <div v-else-if="history.length > 0" class="history-list">
        <button
          v-for="item in history"
          :key="item.id"
          type="button"
          class="history-item"
          @click="emit('useHistory', item)"
        >
          <span class="time">{{ formatTime(item.createdAt) }}</span>
          <strong>{{ item.analysis }}</strong>
          <small>{{ item.suggestions[0] || '查看详情' }}</small>
        </button>
      </div>

      <p v-else class="history-empty">还没有保存过建议，生成后会自动出现在这里。</p>
    </div>
  </section>
</template>

<script setup lang="ts">
import SoftEmptyState from '@/components/shared/SoftEmptyState.vue'
import SoftLoadingState from '@/components/shared/SoftLoadingState.vue'
import AiDisclaimer from '@/components/mood/AiDisclaimer.vue'
import type { AnalyzeMoodResponse, MoodAdviceHistoryItem } from '@/api/mood'
import { ref } from 'vue'
import { submitAiFeedback } from '@/api/feedback'

const props = defineProps<{
  loading: boolean
  historyLoading: boolean
  canGenerate: boolean
  serviceUnavailable: boolean
  disabledSeconds: number
  serviceMessage: string
  result: AnalyzeMoodResponse | null
  fourSection: {
    summary: string
    possibleCauses: string
    todayActions: string[]
    whenToSeekHelp: string
  } | null
  dataScope: {
    dateRange: string
    moodRecordCount: number
    hasAssessment: boolean
  } | null
  autoRecommendations: string[]
  history: MoodAdviceHistoryItem[]
  moodMeta: { label: string; emoji: string; color: string } | null
  analysisHistoryId: number | null
}>()

const emit = defineEmits<{
  generate: []
  copy: []
  applyAll: []
  applyOne: [index: number]
  useHistory: [item: MoodAdviceHistoryItem]
}>()

const feedbackSubmitted = ref(false)
const feedbackLoading = ref(false)

const submitFeedback = async (type: 'helpful' | 'not_helpful') => {
  if (!props.analysisHistoryId || feedbackLoading.value) return
  feedbackLoading.value = true
  try {
    await submitAiFeedback({
      analysisHistoryId: props.analysisHistoryId,
      feedbackType: type,
    })
    feedbackSubmitted.value = true
  } catch {
    // 静默处理
  } finally {
    feedbackLoading.value = false
  }
}

const formatTime = (value: string) => {
  return new Date(value).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}
</script>

<style scoped lang="scss">
.ai-suggest-card {
  display: grid;
  gap: 1rem;
  padding: 1.5rem;
  border-radius: 22px;
  background: #fff;
  border: 1px solid #e8e2d8;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.04);
}

.card-head,
.history-head,
.result-head {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
}

.card-head {
  align-items: start;
}

.eyebrow {
  margin: 0 0 0.35rem;
  color: #9c8f7d;
  font-size: 0.84rem;
  font-weight: 700;
}

h3,
h4 {
  margin: 0;
  color: #5c5c5c;
}

.primary-btn,
.ghost-btn,
.mini-btn {
  border: none;
  cursor: pointer;
  transition:
    transform 0.2s ease,
    box-shadow 0.2s ease,
    opacity 0.2s ease;
}

.primary-btn {
  min-width: 136px;
  padding: 0.82rem 1rem;
  border-radius: 40px;
  background: linear-gradient(135deg, #8b9dc3, #c49a6c);
  color: #fff;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.04);
}

.primary-btn:hover,
.ghost-btn:hover,
.mini-btn:hover {
  transform: translateY(-1px);
}

.primary-btn.loading {
  opacity: 0.78;
}

.auto-guide {
  padding: 1rem;
  border-radius: 20px;
  background: #fbf4ea;
}

.service-notice {
  margin: 0;
  padding: 0.72rem 0.88rem;
  border-radius: 20px;
  background: #fff6ec;
  border: 1px solid #f0d3ad;
  color: #8a6a47;
  font-size: 0.9rem;
}

.guide-label {
  display: inline-flex;
  margin-bottom: 0.7rem;
  color: #8a6a47;
  font-size: 0.82rem;
  font-weight: 700;
}

.auto-guide ul {
  margin: 0;
  padding-left: 1.15rem;
  color: #5c5c5c;
  line-height: 1.7;
}

.result-panel {
  display: grid;
  gap: 1rem;
}

.mood-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.58rem 0.85rem;
  border-radius: 999px;
  color: #5c5c5c;
  background: #f6ead9;
}

.head-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.6rem;
  justify-content: end;
}

.ghost-btn,
.mini-btn {
  padding: 0.68rem 0.92rem;
  border-radius: 40px;
  background: #fbf4ea;
  color: #5c5c5c;
}

.ghost-btn.primary {
  color: #fff;
  background: linear-gradient(135deg, #8b9dc3, #c49a6c);
}

.analysis {
  margin: 0;
  padding: 1rem;
  border-radius: 20px;
  background: #fcf7f1;
  color: #5c5c5c;
  line-height: 1.8;
}

.suggestion-list {
  display: grid;
  gap: 0.8rem;
}

.suggestion-item {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  align-items: center;
  padding: 0.95rem 1rem;
  border-radius: 20px;
  background: #fcf7f1;
}

.suggestion-item p {
  margin: 0.35rem 0 0;
  color: #5c5c5c;
  line-height: 1.7;
}

.index {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.6rem;
  height: 1.6rem;
  border-radius: 999px;
  background: #f6ead9;
  color: #8a6a47;
  font-size: 0.84rem;
  font-weight: 700;
}

.history-panel {
  padding-top: 0.4rem;
  border-top: 1px solid #eee5d8;
}

.history-head span,
.history-loading,
.history-empty,
.history-item small,
.time {
  color: #7a746b;
}

.history-list {
  display: grid;
  gap: 0.7rem;
  margin-top: 0.8rem;
}

.history-item {
  display: grid;
  gap: 0.3rem;
  text-align: left;
  padding: 0.9rem 1rem;
  border-radius: 20px;
  border: 1px solid #e8e2d8;
  background: #fff;
  cursor: pointer;
  transition:
    transform 0.2s ease,
    border-color 0.2s ease,
    box-shadow 0.2s ease;
}

.history-item:hover {
  transform: translateY(-1px);
  border-color: #dbcbb5;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.04);
}

@media (max-width: 768px) {
  .card-head,
  .history-head,
  .result-head,
  .suggestion-item {
    flex-direction: column;
    align-items: stretch;
  }

  .head-actions {
    justify-content: start;
  }
}

/* 四段式结构化分析 */
.data-scope {
  margin: 0;
  padding: 0.6rem 0.8rem;
  border-radius: 12px;
  background: #f0f4ff;
  color: #6b7280;
  font-size: 0.82rem;
  text-align: center;
}

.scope-icon {
  margin-right: 0.3rem;
}

.four-section {
  display: grid;
  gap: 0.8rem;
}

.section-block {
  padding: 1rem;
  border-radius: 16px;
  background: #fcf7f1;
  border: 1px solid #f0e8d8;
}

.section-title {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  margin: 0 0 0.5rem;
  font-size: 0.9rem;
  color: #5c5c5c;
}

.section-icon {
  font-size: 1rem;
}

.section-block p {
  margin: 0;
  color: #5c5c5c;
  line-height: 1.7;
}

.section-block ul {
  margin: 0;
  padding: 0;
  list-style: none;
  display: grid;
  gap: 0.5rem;
}

.section-block li {
  display: flex;
  align-items: start;
  gap: 0.5rem;
  color: #5c5c5c;
  line-height: 1.6;
}

.action-index {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 1.5rem;
  height: 1.5rem;
  border-radius: 999px;
  background: #e8e0d0;
  color: #8a6a47;
  font-size: 0.78rem;
  font-weight: 700;
  flex-shrink: 0;
}

/* 高风险视觉区分 */
.result-panel.high-risk {
  border: 2px solid #ef4444;
  border-radius: 20px;
  padding: 1rem;
  background: #fef2f2;
}

.result-panel.high-risk .section-block {
  background: #fff;
  border-color: #fecaca;
}

.feedback-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 0;
  border-top: 1px solid #f0f0f0;
  margin-top: 4px;
}

.feedback-label {
  font-size: 13px;
  color: #909399;
}

.feedback-btn {
  font-size: 12px;
  padding: 4px 12px;
  border: 1px solid #e0e0e0;
  border-radius: 16px;
  background: #fff;
  cursor: pointer;
  transition: all 0.2s;
}

.feedback-btn:hover:not(:disabled) {
  border-color: #667eea;
  background: #f0f4ff;
}

.feedback-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.feedback-thanks {
  font-size: 13px;
  color: #67c23a;
}
</style>
