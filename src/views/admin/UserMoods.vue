<template>
  <div class="admin-moods-page">
    <div class="page-header">
      <h2>用户情绪数据</h2>
      <div class="header-actions">
        <button class="ghost-btn" :disabled="loading || records.length === 0" @click="exportCsv">
          导出 CSV
        </button>
        <button class="refresh-btn" :disabled="loading" @click="refreshList">刷新</button>
      </div>
    </div>

    <div class="filter-panel">
      <div class="filter-item">
        <label>用户名</label>
        <input v-model.trim="filters.username" type="text" placeholder="请输入用户名" />
      </div>

      <div class="filter-item">
        <label>情绪类型</label>
        <input
          v-model.trim="filters.moodType"
          type="text"
          placeholder="如：happy / anxious / calm"
        />
      </div>

      <div class="filter-item">
        <label>开始日期</label>
        <input v-model="filters.startDate" type="date" />
      </div>

      <div class="filter-item">
        <label>结束日期</label>
        <input v-model="filters.endDate" type="date" />
      </div>

      <div class="actions">
        <button class="primary-btn" :disabled="loading" @click="applyFilters">筛选</button>
        <button class="ghost-btn" :disabled="loading" @click="resetFilters">重置</button>
      </div>
    </div>

    <div v-if="loading" class="state-block">加载中...</div>
    <div v-else-if="records.length === 0" class="state-block">暂无情绪记录</div>

    <div v-else class="table-wrap">
      <table class="records-table">
        <thead>
          <tr>
            <th>用户名</th>
            <th>情绪类型</th>
            <th>强度</th>
            <th>备注</th>
            <th>触发因素</th>
            <th>创建时间</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in records" :key="item.id">
            <td>{{ item.username || '-' }}</td>
            <td>{{ formatMoodTypes(item.moodType) }}</td>
            <td>{{ item.intensity || '-' }}</td>
            <td class="note-cell">{{ item.note || '-' }}</td>
            <td class="trigger-cell">{{ item.trigger || '-' }}</td>
            <td>{{ formatDate(item.createdAt) }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="pagination">
      <button class="ghost-btn" :disabled="loading || page <= 1" @click="changePage(page - 1)">
        上一页
      </button>
      <span>第 {{ page }} / {{ totalPages }} 页（共 {{ total }} 条）</span>
      <button
        class="ghost-btn"
        :disabled="loading || page >= totalPages"
        @click="changePage(page + 1)"
      >
        下一页
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { getAdminMoods, type AdminMoodRecord } from '@/api/admin'

const loading = ref(false)
const records = ref<AdminMoodRecord[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(20)

const filters = reactive({
  username: '',
  moodType: '',
  startDate: '',
  endDate: '',
})

const totalPages = computed(() => {
  const pages = Math.ceil(total.value / pageSize.value)
  return pages > 0 ? pages : 1
})

const loadMoods = async () => {
  loading.value = true
  try {
    const res = await getAdminMoods({
      page: page.value,
      pageSize: pageSize.value,
      username: filters.username || undefined,
      moodType: filters.moodType || undefined,
      startDate: filters.startDate || undefined,
      endDate: filters.endDate || undefined,
    })
    records.value = res.list
    total.value = res.total
  } catch (error) {
    ElMessage.error('加载用户情绪数据失败')
  } finally {
    loading.value = false
  }
}

const applyFilters = async () => {
  page.value = 1
  await loadMoods()
}

const resetFilters = async () => {
  filters.username = ''
  filters.moodType = ''
  filters.startDate = ''
  filters.endDate = ''
  page.value = 1
  await loadMoods()
}

const refreshList = async () => {
  await loadMoods()
}

const changePage = async (nextPage: number) => {
  page.value = nextPage
  await loadMoods()
}

const formatMoodTypes = (moodTypes: string[]) => {
  if (!Array.isArray(moodTypes) || moodTypes.length === 0) {
    return '-'
  }
  return moodTypes.join('、')
}

const formatDate = (value: string) => {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleString('zh-CN')
}

const csvEscape = (value: string | number) => {
  const text = String(value ?? '')
  if (text.includes(',') || text.includes('"') || text.includes('\n')) {
    return `"${text.replace(/"/g, '""')}"`
  }
  return text
}

const exportCsv = () => {
  const headers = ['用户名', '情绪类型', '强度', '备注', '触发因素', '创建时间']
  const rows = records.value.map((item) => [
    item.username || '-',
    formatMoodTypes(item.moodType),
    item.intensity || '-',
    item.note || '-',
    item.trigger || '-',
    formatDate(item.createdAt),
  ])

  const lines = [headers, ...rows].map((row) => row.map(csvEscape).join(','))
  const csvText = `\uFEFF${lines.join('\n')}`
  const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)

  const now = new Date()
  const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(
    now.getDate()
  ).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(
    2,
    '0'
  )}`

  const a = document.createElement('a')
  a.href = url
  a.download = `user-moods-${stamp}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

onMounted(loadMoods)
</script>

<style scoped lang="scss">
.admin-moods-page {
  max-width: 1280px;
  margin: 0 auto;
  padding: 24px;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.header-actions {
  display: flex;
  gap: 8px;
}

.filter-panel {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 12px;
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  padding: 12px;
  margin-bottom: 16px;
}

.filter-item {
  display: flex;
  flex-direction: column;
  gap: 6px;

  label {
    color: #4b5563;
    font-size: 13px;
  }

  input {
    border: 1px solid #cbd5e1;
    border-radius: 8px;
    padding: 8px 10px;
    font-size: 14px;
  }
}

.actions {
  display: flex;
  align-items: flex-end;
  gap: 8px;
}

.refresh-btn,
.primary-btn,
.ghost-btn {
  border-radius: 8px;
  padding: 8px 12px;
  cursor: pointer;
}

.refresh-btn,
.primary-btn {
  border: 1px solid #2563eb;
  background: #2563eb;
  color: #fff;
}

.ghost-btn {
  border: 1px solid #cbd5e1;
  background: #fff;
  color: #334155;
}

.refresh-btn:disabled,
.primary-btn:disabled,
.ghost-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.state-block {
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  padding: 20px;
  color: #4b5563;
}

.table-wrap {
  overflow-x: auto;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  background: #fff;
}

.records-table {
  width: 100%;
  border-collapse: collapse;

  th,
  td {
    border-bottom: 1px solid #f1f5f9;
    text-align: left;
    padding: 10px 12px;
    vertical-align: top;
  }

  thead th {
    background: #f8fafc;
    font-weight: 600;
    white-space: nowrap;
  }
}

.note-cell,
.trigger-cell {
  max-width: 320px;
  white-space: pre-wrap;
  word-break: break-word;
}

.pagination {
  margin-top: 14px;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
}
</style>
