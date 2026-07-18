<template>
  <div class="analysis-history">
    <div class="history-header">
      <h3>
        <i class="fas fa-history"></i> 分析历史
      </h3>
      <button
        v-if="loading"
        type="button"
        class="refresh-btn loading"
      >
        <i class="fas fa-spinner fa-spin"></i>
      </button>
      <button
        v-else
        type="button"
        class="refresh-btn"
        @click="$emit('refresh')"
      >
        <i class="fas fa-sync-alt"></i>
      </button>
    </div>

    <div v-if="loading" class="loading-state">
      <div class="loading-spinner"></div>
      <p>加载分析历史中...</p>
    </div>

    <div v-else-if="history.length === 0" class="empty-state">
      <i class="fas fa-clock"></i>
      <p>还没有分析记录</p>
      <p class="empty-desc">记录更多情绪后，系统会自动生成分析报告</p>
    </div>

    <div v-else class="history-list">
      <div
        v-for="item in history"
        :key="item.id"
        class="history-item"
        :class="{ active: item.isLatest, expired: item.status === 'superseded' }"
        @click="$emit('select', item)"
      >
        <div class="item-left">
          <div class="period-badge">{{ getPeriodLabel(item.period) }}</div>
          <div class="item-info">
            <span class="item-date">{{ formatDate(item.createdAt) }}</span>
            <span class="item-status" :class="`status-${item.status}`">
              {{ getStatusLabel(item.status) }}
            </span>
          </div>
        </div>
        <div class="item-right">
          <span v-if="item.isLatest" class="latest-badge">最新</span>
          <i class="fas fa-chevron-right"></i>
        </div>
      </div>
    </div>

    <div v-if="hasMore && !loading" class="load-more">
      <button type="button" class="load-more-btn" @click="$emit('loadMore')">
        <span>加载更多</span>
        <i class="fas fa-chevron-down"></i>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { AnalysisHistoryItem, AnalysisPeriod, AnalysisStatus } from '@/types/moodAnalysis'

defineProps<{
  history: AnalysisHistoryItem[]
  loading?: boolean
  hasMore?: boolean
}>()

defineEmits<{
  select: [item: AnalysisHistoryItem]
  refresh: []
  loadMore: []
}>()

const getPeriodLabel = (period: AnalysisPeriod): string => {
  const map: Record<AnalysisPeriod, string> = {
    '7d': '7天',
    '1m': '1个月',
    '3m': '3个月',
    '6m': '6个月',
    '1y': '1年',
  }
  return map[period] || period
}

const getStatusLabel = (status: AnalysisStatus): string => {
  const map: Record<AnalysisStatus, string> = {
    pending: '等待中',
    processing: '分析中',
    succeeded: '已完成',
    retryable_failed: '可重试',
    failed_final: '失败',
    superseded: '已过期',
  }
  return map[status] || status
}

const formatDate = (dateStr: string): string => {
  const date = new Date(dateStr)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${year}-${month}-${day} ${hours}:${minutes}`
}
</script>

<style scoped>
.analysis-history {
  background: #fff;
  border-radius: 16px;
  padding: 24px;
  border: 1px solid #e2e8f0;
}

.history-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
}

.history-header h3 {
  font-size: 16px;
  font-weight: 600;
  color: #1e293b;
  margin: 0;
  display: flex;
  align-items: center;
  gap: 8px;
}

.history-header h3 i {
  color: #7c3aed;
}

.refresh-btn {
  width: 36px;
  height: 36px;
  border: none;
  border-radius: 8px;
  background: #f1f5f9;
  color: #64748b;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s;
}

.refresh-btn:hover:not(.loading) {
  background: #e2e8f0;
}

.refresh-btn.loading {
  cursor: not-allowed;
}

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  gap: 12px;
}

.loading-spinner {
  width: 32px;
  height: 32px;
  border: 3px solid #e2e8f0;
  border-top-color: #7c3aed;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.loading-state p {
  font-size: 14px;
  color: #64748b;
  margin: 0;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  gap: 8px;
}

.empty-state i {
  font-size: 48px;
  color: #cbd5e1;
  margin-bottom: 8px;
}

.empty-state p {
  font-size: 15px;
  color: #64748b;
  margin: 0;
}

.empty-state .empty-desc {
  font-size: 13px;
  color: #94a3b8;
}

.history-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.history-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  background: #f8fafc;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s;
  border: 2px solid transparent;
}

.history-item:hover {
  background: #f1f5f9;
}

.history-item.active {
  border-color: #7c3aed;
  background: rgba(139, 92, 246, 0.05);
}

.history-item.expired {
  opacity: 0.6;
}

.item-left {
  display: flex;
  align-items: center;
  gap: 14px;
}

.period-badge {
  font-size: 12px;
  font-weight: 600;
  color: #7c3aed;
  background: rgba(139, 92, 246, 0.1);
  padding: 6px 12px;
  border-radius: 8px;
}

.item-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.item-date {
  font-size: 14px;
  color: #334155;
}

.item-status {
  font-size: 12px;
  font-weight: 500;
}

.item-status.status-pending {
  color: #ca8a04;
}

.item-status.status-processing {
  color: #3b82f6;
}

.item-status.status-succeeded {
  color: #22c55e;
}

.item-status.status-retryable_failed {
  color: #f97316;
}

.item-status.status-failed_final {
  color: #ef4444;
}

.item-status.status-superseded {
  color: #64748b;
}

.item-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.latest-badge {
  font-size: 11px;
  font-weight: 600;
  color: #fff;
  background: #7c3aed;
  padding: 2px 8px;
  border-radius: 4px;
}

.item-right i {
  font-size: 14px;
  color: #94a3b8;
}

.load-more {
  margin-top: 20px;
  display: flex;
  justify-content: center;
}

.load-more-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 20px;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  background: #fff;
  color: #64748b;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
}

.load-more-btn:hover {
  border-color: #7c3aed;
  color: #7c3aed;
}

@media (max-width: 640px) {
  .analysis-history {
    padding: 18px;
  }
}
</style>