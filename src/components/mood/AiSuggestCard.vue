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
import type { AnalyzeMoodResponse, MoodAdviceHistoryItem } from '@/api/mood'

defineProps<{
  loading: boolean
  historyLoading: boolean
  canGenerate: boolean
  serviceUnavailable: boolean
  disabledSeconds: number
  serviceMessage: string
  result: AnalyzeMoodResponse | null
  autoRecommendations: string[]
  history: MoodAdviceHistoryItem[]
  moodMeta: { label: string; emoji: string; color: string } | null
}>()

const emit = defineEmits<{
  generate: []
  copy: []
  applyAll: []
  applyOne: [index: number]
  useHistory: [item: MoodAdviceHistoryItem]
}>()

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
  padding: 1.2rem;
  border-radius: 18px;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.92), rgba(244, 245, 255, 0.96));
  border: 1px solid rgba(99, 102, 241, 0.12);
  box-shadow: 0 24px 60px rgba(99, 102, 241, 0.08);
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
  color: #7c7fb7;
  font-size: 0.84rem;
  font-weight: 700;
}

h3,
h4 {
  margin: 0;
  color: #1f2347;
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
  border-radius: 12px;
  background: linear-gradient(135deg, #6366f1, #818cf8);
  color: #fff;
  box-shadow: 0 14px 26px rgba(99, 102, 241, 0.2);
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
  border-radius: 14px;
  background: rgba(99, 102, 241, 0.07);
}

.service-notice {
  margin: 0;
  padding: 0.72rem 0.88rem;
  border-radius: 12px;
  background: rgba(239, 68, 68, 0.08);
  border: 1px solid rgba(239, 68, 68, 0.18);
  color: #b42318;
  font-size: 0.9rem;
}

.guide-label {
  display: inline-flex;
  margin-bottom: 0.7rem;
  color: #6366f1;
  font-size: 0.82rem;
  font-weight: 700;
}

.auto-guide ul {
  margin: 0;
  padding-left: 1.15rem;
  color: #4d5378;
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
  color: var(--pill-color);
  background: color-mix(in srgb, var(--pill-color) 12%, white);
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
  border-radius: 12px;
  background: rgba(99, 102, 241, 0.08);
  color: #50557c;
}

.ghost-btn.primary {
  color: #fff;
  background: linear-gradient(135deg, #6366f1, #818cf8);
}

.analysis {
  margin: 0;
  padding: 1rem;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.7);
  color: #30365d;
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
  border-radius: 14px;
  background: rgba(99, 102, 241, 0.06);
}

.suggestion-item p {
  margin: 0.35rem 0 0;
  color: #41476d;
  line-height: 1.7;
}

.index {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.6rem;
  height: 1.6rem;
  border-radius: 999px;
  background: rgba(99, 102, 241, 0.12);
  color: #6366f1;
  font-size: 0.84rem;
  font-weight: 700;
}

.history-panel {
  padding-top: 0.4rem;
  border-top: 1px solid rgba(99, 102, 241, 0.1);
}

.history-head span,
.history-loading,
.history-empty,
.history-item small,
.time {
  color: #787e9f;
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
  border-radius: 14px;
  border: 1px solid rgba(99, 102, 241, 0.1);
  background: rgba(255, 255, 255, 0.78);
  cursor: pointer;
  transition:
    transform 0.2s ease,
    border-color 0.2s ease,
    box-shadow 0.2s ease;
}

.history-item:hover {
  transform: translateY(-1px);
  border-color: rgba(99, 102, 241, 0.22);
  box-shadow: 0 14px 28px rgba(99, 102, 241, 0.1);
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
</style>
