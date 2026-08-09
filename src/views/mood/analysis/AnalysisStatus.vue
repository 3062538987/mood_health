<template>
  <div class="analysis-status" :class="statusClass">
    <div class="status-icon">
      <i v-if="status === 'pending'" class="fas fa-clock"></i>
      <i v-else-if="status === 'processing'" class="fas fa-spinner fa-spin"></i>
      <i v-else-if="status === 'succeeded'" class="fas fa-check-circle"></i>
      <i v-else-if="status === 'retryable_failed'" class="fas fa-refresh"></i>
      <i v-else-if="status === 'failed_final'" class="fas fa-times-circle"></i>
      <i v-else-if="status === 'superseded'" class="fas fa-history"></i>
    </div>
    <div class="status-content">
      <span class="status-label">{{ statusLabel }}</span>
      <p v-if="status === 'pending'" class="status-desc">分析任务已创建，正在排队处理</p>
      <p v-else-if="status === 'processing'" class="status-desc">AI 正在分析你的情绪数据，请稍候...</p>
      <p v-else-if="status === 'retryable_failed'" class="status-desc">分析暂时失败，系统会自动重试（已重试 {{ job?.retryCount || 0 }}/{{ job?.maxRetries || 3 }} 次）</p>
      <p v-else-if="status === 'failed_final'" class="status-desc">分析最终失败，情绪记录已保存，可手动重新生成</p>
      <p v-else-if="status === 'superseded'" class="status-desc">基于旧数据的分析结果，已被新版本替代</p>
    </div>
    <button
      v-if="status === 'retryable_failed' || status === 'failed_final'"
      type="button"
      class="retry-btn"
      :disabled="isRetrying"
      @click="$emit('retry')"
    >
      <i :class="isRetrying ? 'fas fa-spinner fa-spin' : 'fas fa-refresh'"></i>
      {{ isRetrying ? '重试中...' : '重新分析' }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { AnalysisStatus, AnalysisJob } from '@/types/moodAnalysis'

const props = defineProps<{
  status: AnalysisStatus
  job?: AnalysisJob
  isRetrying?: boolean
}>()

defineEmits<{
  retry: []
}>()

const statusClass = computed(() => `status-${props.status}`)

const statusLabel = computed(() => {
  const map: Record<AnalysisStatus, string> = {
    pending: '等待中',
    processing: '分析中',
    succeeded: '分析完成',
    retryable_failed: '分析失败（可重试）',
    failed_final: '分析失败',
    superseded: '已过期',
  }
  return map[props.status] || props.status
})
</script>

<style scoped>
.analysis-status {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 20px;
  border-radius: 12px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
}

.status-icon {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  flex-shrink: 0;
}

.status-pending .status-icon {
  background: rgba(234, 179, 8, 0.1);
  color: #ca8a04;
}

.status-processing .status-icon {
  background: rgba(59, 130, 246, 0.1);
  color: #3b82f6;
}

.status-succeeded .status-icon {
  background: rgba(34, 197, 94, 0.1);
  color: #22c55e;
}

.status-retryable_failed .status-icon {
  background: rgba(249, 115, 22, 0.1);
  color: #f97316;
}

.status-failed_final .status-icon {
  background: rgba(239, 68, 68, 0.1);
  color: #ef4444;
}

.status-superseded .status-icon {
  background: rgba(100, 116, 139, 0.1);
  color: #64748b;
}

.status-content {
  flex: 1;
}

.status-label {
  display: block;
  font-weight: 600;
  font-size: 14px;
  color: #1e293b;
  margin-bottom: 2px;
}

.status-desc {
  margin: 0;
  font-size: 12px;
  color: #64748b;
  line-height: 1.5;
}

.retry-btn {
  padding: 8px 16px;
  border: none;
  border-radius: 8px;
  background: #3b82f6;
  color: #fff;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 6px;
  transition: background 0.2s;
}

.retry-btn:hover:not(:disabled) {
  background: #2563eb;
}

.retry-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

@media (max-width: 640px) {
  .analysis-status {
    flex-wrap: wrap;
    padding: 14px;
  }
  
  .retry-btn {
    margin-top: 8px;
  }
}
</style>