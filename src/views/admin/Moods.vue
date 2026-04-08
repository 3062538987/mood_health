<template>
  <div class="admin-moods-page">
    <div class="page-header">
      <h2>Mood Records</h2>
      <button class="refresh-btn" :disabled="loading" @click="refreshList">Refresh</button>
    </div>

    <div class="filter-panel">
      <div class="filter-item">
        <label>Username</label>
        <input v-model.trim="filters.username" type="text" placeholder="Input username" />
      </div>

      <div class="filter-item">
        <label>Mood Type</label>
        <input v-model.trim="filters.moodType" type="text" placeholder="happy / anxious" />
      </div>

      <div class="filter-item">
        <label>Start Date</label>
        <input v-model="filters.startDate" type="date" />
      </div>

      <div class="filter-item">
        <label>End Date</label>
        <input v-model="filters.endDate" type="date" />
      </div>

      <div class="actions">
        <button class="primary-btn" :disabled="loading" @click="applyFilters">Filter</button>
        <button class="ghost-btn" :disabled="loading" @click="resetFilters">Reset</button>
      </div>
    </div>

    <div v-if="loading" class="state-block">Loading...</div>
    <div v-else-if="records.length === 0" class="state-block">No mood records</div>

    <div v-else class="table-wrap">
      <table class="records-table">
        <thead>
          <tr>
            <th>Username</th>
            <th>Mood Type</th>
            <th>Intensity</th>
            <th>Note</th>
            <th>Created At</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in records" :key="item.id">
            <td>{{ item.username || '-' }}</td>
            <td>{{ formatMoodTypes(item.moodType) }}</td>
            <td>{{ item.intensity || '-' }}</td>
            <td class="note-cell">{{ item.note || '-' }}</td>
            <td>{{ formatDate(item.createdAt) }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="pagination">
      <button class="ghost-btn" :disabled="loading || page <= 1" @click="changePage(page - 1)">
        Prev
      </button>
      <span>Page {{ page }} / {{ totalPages }} (Total {{ total }})</span>
      <button
        class="ghost-btn"
        :disabled="loading || page >= totalPages"
        @click="changePage(page + 1)"
      >
        Next
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
    ElMessage.error('Failed to load mood records')
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
  return moodTypes.join(' / ')
}

const formatDate = (value: string) => {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleString('zh-CN')
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

.note-cell {
  max-width: 420px;
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
