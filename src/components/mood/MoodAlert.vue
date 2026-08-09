<template>
  <div class="mood-alert" v-if="alerts.length > 0">
    <div
      v-for="alert in visibleAlerts"
      :key="alert.id"
      class="alert-card"
      :class="alert.type"
    >
      <div class="alert-icon">
        <span v-if="alert.type === 'continuous_low'">🌧️</span>
        <span v-else>🌊</span>
      </div>
      <div class="alert-body">
        <p class="alert-message">{{ alert.message }}</p>
        <span class="alert-time">{{ formatTime(alert.createdAt) }}</span>
      </div>
      <button class="alert-close" @click="dismiss(alert.id)" title="关闭">
        ✕
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import request from '@/utils/request'

interface MoodAlert {
  id: number
  type: string
  message: string
  triggerRecords: number[]
  isRead: boolean
  createdAt: string
}

const alerts = ref<MoodAlert[]>([])

const visibleAlerts = ref<MoodAlert[]>([])

async function loadAlerts() {
  try {
    const data = await request<MoodAlert[]>({
      url: '/api/moods/alerts',
      method: 'get',
    })
    alerts.value = data
    visibleAlerts.value = data.filter((a) => !a.isRead)
  } catch {
    // 静默处理，不阻断页面
  }
}

async function dismiss(alertId: number) {
  try {
    await request({
      url: `/api/moods/alerts/${alertId}/read`,
      method: 'put',
    })
    visibleAlerts.value = visibleAlerts.value.filter((a) => a.id !== alertId)
  } catch {
    // 静默处理
  }
}

function formatTime(dateStr: string) {
  const d = new Date(dateStr)
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  const hours = Math.floor(diff / 3600000)
  if (hours < 1) return '刚刚'
  if (hours < 24) return `${hours}小时前`
  const days = Math.floor(hours / 24)
  return `${days}天前`
}

onMounted(() => {
  loadAlerts()
})
</script>

<style scoped>
.mood-alert {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.alert-card {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 14px 16px;
  border-radius: 10px;
  background: #fff;
  border-left: 4px solid #e6a23c;
  box-shadow: 0 1px 8px rgba(0, 0, 0, 0.06);
  position: relative;
}

.alert-card.continuous_low {
  border-left-color: #67c23a;
  background: #f0f9eb;
}

.alert-card.high_fluctuation {
  border-left-color: #e6a23c;
  background: #fdf6ec;
}

.alert-icon {
  font-size: 22px;
  flex-shrink: 0;
  line-height: 1;
  margin-top: 2px;
}

.alert-body {
  flex: 1;
  min-width: 0;
}

.alert-message {
  margin: 0 0 4px 0;
  font-size: 13px;
  color: #303133;
  line-height: 1.6;
}

.alert-time {
  font-size: 11px;
  color: #909399;
}

.alert-close {
  flex-shrink: 0;
  background: none;
  border: none;
  color: #c0c4cc;
  cursor: pointer;
  font-size: 14px;
  padding: 2px 4px;
  border-radius: 4px;
  line-height: 1;
}

.alert-close:hover {
  color: #909399;
  background: rgba(0, 0, 0, 0.05);
}
</style>