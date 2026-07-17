<template>
  <div class="ai-history-page">
    <header class="page-header">
      <h1>AI 分析历史</h1>
      <p class="subtitle">查看你过往的所有 AI 情绪分析记录</p>
    </header>

    <!-- 加载状态 -->
    <div v-if="loading" class="state-container">
      <div class="loading-spinner"></div>
      <p>正在加载历史记录...</p>
    </div>

    <!-- 错误状态 -->
    <div v-else-if="error" class="state-container error-state">
      <p class="error-text">{{ error }}</p>
      <button class="retry-btn" @click="loadHistory">重新加载</button>
    </div>

    <!-- 空状态 -->
    <div v-else-if="list.length === 0" class="state-container empty-state">
      <div class="empty-icon">📋</div>
      <p class="empty-title">暂无 AI 分析记录</p>
      <p class="empty-desc">去情绪记录页面生成你的第一条 AI 分析吧</p>
      <router-link to="/mood" class="go-btn">去记录情绪</router-link>
    </div>

    <!-- 历史列表 -->
    <ul v-else class="history-list">
      <li v-for="item in list" :key="item.id" class="history-item">
        <div class="item-main">
          <div class="item-header">
            <span class="item-type">{{ typeLabel(item.analysisType) }}</span>
            <span class="item-risk" :class="'risk-' + item.riskLevel">{{ riskLabel(item.riskLevel) }}</span>
          </div>
          <p class="item-summary">{{ item.analysisSummary || '暂无摘要' }}</p>
          <span class="item-time">{{ formatTime(item.createdAt) }}</span>
        </div>
      </li>
    </ul>

    <!-- 分页 -->
    <div v-if="total > pageSize" class="pagination">
      <button
        :disabled="page <= 1"
        class="page-btn"
        @click="goPage(page - 1)"
      >
        上一页
      </button>
      <span class="page-info">{{ page }} / {{ totalPages }}</span>
      <button
        :disabled="page >= totalPages"
        class="page-btn"
        @click="goPage(page + 1)"
      >
        下一页
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { fetchAiHistoryList } from '@/api/aiHistory'
import type { AiHistoryItem } from '@/api/aiHistory'

const list = ref<AiHistoryItem[]>([])
const loading = ref(true)
const error = ref('')
const page = ref(1)
const pageSize = 20
const total = ref(0)

const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize)))

const typeLabel = (type: string) => {
  const map: Record<string, string> = {
    mood_analysis: '情绪分析',
    suggestion: '建议生成',
    counseling: '咨询对话',
  }
  return map[type] || type
}

const riskLabel = (level: string) => {
  const map: Record<string, string> = {
    low: '低风险',
    medium: '中风险',
    high: '高风险',
  }
  return map[level] || level
}

const formatTime = (value: string) => {
  return new Date(value).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const loadHistory = async () => {
  loading.value = true
  error.value = ''
  try {
    const res = await fetchAiHistoryList(page.value, pageSize)
    list.value = res.list
    total.value = res.total
  } catch (err: any) {
    error.value = err?.message || '加载失败，请稍后重试'
  } finally {
    loading.value = false
  }
}

const goPage = (p: number) => {
  if (p < 1 || p > totalPages.value) return
  page.value = p
  loadHistory()
}

onMounted(() => {
  loadHistory()
})
</script>

<style scoped lang="scss">
.ai-history-page {
  max-width: 720px;
  margin: 0 auto;
  padding: 1.5rem 1rem;
}

.page-header {
  margin-bottom: 1.5rem;

  h1 {
    margin: 0;
    font-size: 1.5rem;
    color: var(--text-color, #1f2937);
  }

  .subtitle {
    margin: 0.3rem 0 0;
    color: var(--muted, #9ca3af);
    font-size: 0.9rem;
  }
}

.state-container {
  text-align: center;
  padding: 3rem 1rem;
}

.loading-spinner {
  width: 2rem;
  height: 2rem;
  border: 3px solid #e5e7eb;
  border-top-color: var(--primary-color, #6366f1);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin: 0 auto 1rem;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.error-state {
  .error-text {
    color: var(--danger, #ef4444);
    margin-bottom: 1rem;
  }
}

.retry-btn {
  padding: 0.5rem 1.5rem;
  border: 1px solid var(--border-color, #d1d5db);
  border-radius: 12px;
  background: #fff;
  color: var(--text-color, #374151);
  cursor: pointer;
  font-size: 0.9rem;
}

.empty-state {
  .empty-icon {
    font-size: 3rem;
    margin-bottom: 0.5rem;
  }

  .empty-title {
    font-size: 1.1rem;
    color: var(--text-color, #374151);
    margin: 0 0 0.3rem;
  }

  .empty-desc {
    color: var(--muted, #9ca3af);
    margin: 0 0 1rem;
    font-size: 0.9rem;
  }
}

.go-btn {
  display: inline-block;
  padding: 0.5rem 1.5rem;
  border-radius: 12px;
  background: var(--primary-color, #6366f1);
  color: #fff;
  text-decoration: none;
  font-size: 0.9rem;
}

.history-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: grid;
  gap: 0.8rem;
}

.history-item {
  background: var(--surface, #fff);
  border: 1px solid var(--border-color, #e5e7eb);
  border-radius: 16px;
  padding: 1rem;
  transition: box-shadow 0.2s;

  &:hover {
    box-shadow: var(--shadow-md, 0 4px 12px rgba(0,0,0,0.06));
  }
}

.item-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.4rem;
}

.item-type {
  font-size: 0.78rem;
  padding: 0.15rem 0.6rem;
  background: #f0f4ff;
  color: #6366f1;
  border-radius: 999px;
}

.item-risk {
  font-size: 0.75rem;
  padding: 0.15rem 0.5rem;
  border-radius: 999px;

  &.risk-low {
    background: #ecfdf5;
    color: #059669;
  }

  &.risk-medium {
    background: #fffbeb;
    color: #d97706;
  }

  &.risk-high {
    background: #fef2f2;
    color: #dc2626;
  }
}

.item-summary {
  margin: 0.4rem 0;
  color: var(--text-color, #374151);
  font-size: 0.9rem;
  line-height: 1.6;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.item-time {
  font-size: 0.78rem;
  color: var(--muted, #9ca3af);
}

.pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  margin-top: 1.5rem;
}

.page-btn {
  padding: 0.4rem 1rem;
  border: 1px solid var(--border-color, #d1d5db);
  border-radius: 10px;
  background: #fff;
  color: var(--text-color, #374151);
  cursor: pointer;
  font-size: 0.85rem;

  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
}

.page-info {
  font-size: 0.85rem;
  color: var(--muted, #6b7280);
}
</style>