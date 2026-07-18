<template>
  <div class="admin-cases-page">
    <div class="page-header">
      <h2>风险个案管理</h2>
      <button class="refresh-btn" :disabled="loading" @click="loadCases">刷新</button>
    </div>

    <div v-if="loading" class="state-block">正在加载个案列表...</div>
    <div v-else-if="cases.length === 0" class="state-block">还没有风险个案记录</div>

    <div v-else class="table-wrap">
      <table class="cases-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>学生ID</th>
            <th>状态</th>
            <th>风险等级</th>
            <th>摘要</th>
            <th>创建时间</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in cases" :key="item.id">
            <td>{{ item.id }}</td>
            <td>{{ item.studentUserId }}</td>
            <td>
              <span :class="['status-tag', statusClass(item.status)]">
                {{ statusLabel(item.status) }}
              </span>
            </td>
            <td>
              <span v-if="item.riskLevel" :class="['risk-tag', riskClass(item.riskLevel)]">
                {{ riskLabel(item.riskLevel) }}
              </span>
              <span v-else class="text-muted">-</span>
            </td>
            <td class="summary-cell">{{ item.summary || '-' }}</td>
            <td>{{ formatDate(item.createdAt) }}</td>
            <td>
              <router-link :to="`/admin/cases/${item.id}`" class="detail-link">
                查看详情
              </router-link>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { getMyCases, type CaseItem, type CaseStatus } from '@/api/case'

const cases = ref<CaseItem[]>([])
const loading = ref(false)

const statusLabels: Record<CaseStatus, string> = {
  open: '待处理',
  assigned: '已分配',
  in_progress: '处理中',
  referred: '已转介',
  closed: '已结案',
}

const statusLabel = (status: CaseStatus) => statusLabels[status] || status

const statusClass = (status: CaseStatus) => {
  const map: Record<CaseStatus, string> = {
    open: 'status-open',
    assigned: 'status-assigned',
    in_progress: 'status-progress',
    referred: 'status-referred',
    closed: 'status-closed',
  }
  return map[status] || ''
}

const riskLabels: Record<string, string> = {
  low: '低风险',
  mild: '轻度',
  moderate: '中度',
  high: '高风险',
}

const riskLabel = (level: string) => riskLabels[level] || level

const riskClass = (level: string) => {
  const map: Record<string, string> = {
    low: 'risk-low',
    mild: 'risk-mild',
    moderate: 'risk-moderate',
    high: 'risk-high',
  }
  return map[level] || ''
}

const formatDate = (dateStr: string) => {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleString('zh-CN')
}

const loadCases = async () => {
  loading.value = true
  try {
    cases.value = await getMyCases()
  } catch (error) {
    ElMessage.error('获取个案列表失败')
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadCases()
})
</script>

<style scoped lang="scss">
@use '@/assets/styles/theme.scss' as *;

.admin-cases-page {
  padding: 20px;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;

  h2 {
    margin: 0;
    color: $text-color;
  }
}

.refresh-btn {
  padding: 8px 16px;
  background-color: $primary-color;
  color: $white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
}

.state-block {
  text-align: center;
  padding: 40px;
  color: $text-light-color;
}

.table-wrap {
  overflow-x: auto;
}

.cases-table {
  width: 100%;
  border-collapse: collapse;
  background: $white;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);

  th,
  td {
    padding: 12px 16px;
    text-align: left;
    border-bottom: 1px solid $border-color;
  }

  th {
    background-color: $bg-warm;
    color: $text-color;
    font-weight: 600;
    white-space: nowrap;
  }

  td {
    color: $text-color;
  }
}

.summary-cell {
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.text-muted {
  color: $text-light-color;
}

.status-tag {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: $font-size-sm;
  font-weight: 500;
}

.status-open {
  background-color: #fff3e0;
  color: #e65100;
}

.status-assigned {
  background-color: #e3f2fd;
  color: #1565c0;
}

.status-progress {
  background-color: #e8f5e9;
  color: #2e7d32;
}

.status-referred {
  background-color: #f3e5f5;
  color: #7b1fa2;
}

.status-closed {
  background-color: #eceff1;
  color: #546e7a;
}

.risk-tag {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: $font-size-sm;
  font-weight: 500;
}

.risk-low {
  background-color: #e8f5e9;
  color: #2e7d32;
}

.risk-mild {
  background-color: #fff8e1;
  color: #f57f17;
}

.risk-moderate {
  background-color: #fff3e0;
  color: #e65100;
}

.risk-high {
  background-color: #ffebee;
  color: #c62828;
}

.detail-link {
  color: $primary-color;
  text-decoration: none;
  &:hover {
    text-decoration: underline;
  }
}
</style>
