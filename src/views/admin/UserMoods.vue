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

    <div class="summary-panel">
      <article class="summary-item">
        <span>总记录数</span>
        <strong>{{ globalTotal }}</strong>
      </article>
      <article class="summary-item">
        <span>今日新增</span>
        <strong>{{ todayTotal }}</strong>
      </article>
      <article class="summary-item accent">
        <span>筛选结果条数</span>
        <strong>{{ total }}</strong>
      </article>
    </div>

    <div class="filter-panel">
      <div class="filter-row row-main">
        <div class="filter-item username-item">
          <label>用户名</label>
          <input v-model.trim="filters.username" type="text" placeholder="请输入用户名" />
        </div>

        <div ref="emotionDropdownRef" class="filter-item emotion-item">
          <label>情绪类型</label>
          <div class="emotion-select" :class="{ open: isEmotionDropdownOpen }">
            <button
              type="button"
              class="emotion-trigger"
              @click="toggleEmotionDropdown"
              :aria-expanded="isEmotionDropdownOpen"
            >
              <div v-if="filters.emotions.length === 0" class="placeholder">请选择情绪类型</div>
              <div v-else class="selected-tags in-trigger">
                <span v-for="value in filters.emotions" :key="value" class="selected-tag">
                  {{ emotionLabel(value) }}
                  <button
                    type="button"
                    class="remove-tag-btn"
                    @click.stop="removeEmotion(value)"
                  >
                    ×
                  </button>
                </span>
              </div>
              <span class="dropdown-arrow">▾</span>
            </button>

            <div v-if="isEmotionDropdownOpen" class="emotion-options">
              <button
                v-for="option in moodOptions"
                :key="option.value"
                type="button"
                class="emotion-option"
                :class="{ active: filters.emotions.includes(option.value) }"
                @click="toggleEmotion(option.value)"
              >
                <span class="option-text">{{ option.label }}</span>
                <span v-if="filters.emotions.includes(option.value)" class="option-check">✓</span>
              </button>
            </div>
          </div>
        </div>

        <div class="actions">
          <button class="primary-btn" :disabled="loading" @click="applyFilters">筛选</button>
          <button class="ghost-btn" :disabled="loading" @click="resetFilters">重置</button>
        </div>
      </div>

      <div class="filter-row row-date">
        <div class="filter-item date-item">
          <label>开始日期</label>
          <input v-model="filters.startDate" type="date" />
        </div>
        <div class="filter-item date-item">
          <label>结束日期</label>
          <input v-model="filters.endDate" type="date" />
        </div>
      </div>
    </div>

    <div v-if="loading" class="state-block">加载中...</div>
    <div v-else-if="records.length === 0" class="state-block">暂无情绪记录</div>

    <div v-else class="table-wrap">
      <table class="records-table desktop-table">
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
            <td>
              <div class="emotion-cell-list">
                <span v-for="emotion in normalizedMoodTypes(item.moodType)" :key="emotion" class="emotion-chip">
                  <i class="emotion-dot" :style="getEmotionDotStyle(emotion)"></i>
                  {{ emotionLabel(emotion) }}
                </span>
              </div>
            </td>
            <td>{{ item.intensity || '-' }}</td>
            <td class="note-cell">{{ item.note || '-' }}</td>
            <td class="trigger-cell">{{ item.trigger || '-' }}</td>
            <td>{{ formatDate(item.createdAt) }}</td>
          </tr>
        </tbody>
      </table>

      <div class="mobile-cards">
        <article v-for="item in records" :key="`mobile-${item.id}`" class="mood-card">
          <header>
            <h4>{{ item.username || '-' }}</h4>
            <span>{{ formatDate(item.createdAt) }}</span>
          </header>
          <div class="row">
            <label>情绪类型</label>
            <div class="emotion-cell-list">
              <span v-for="emotion in normalizedMoodTypes(item.moodType)" :key="emotion" class="emotion-chip">
                <i class="emotion-dot" :style="getEmotionDotStyle(emotion)"></i>
                {{ emotionLabel(emotion) }}
              </span>
            </div>
          </div>
          <div class="row"><label>强度</label><span>{{ item.intensity || '-' }}</span></div>
          <div class="row"><label>备注</label><p>{{ item.note || '-' }}</p></div>
          <div class="row"><label>触发因素</label><p>{{ item.trigger || '-' }}</p></div>
        </article>
      </div>
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
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { getAdminMoods, type AdminMoodRecord } from '@/api/admin'
import { EMOTION_MAP, EMOTION_OPTIONS } from '@/constants/emotions'

const loading = ref(false)
const records = ref<AdminMoodRecord[]>([])
const total = ref(0)
const globalTotal = ref(0)
const todayTotal = ref(0)
const page = ref(1)
const pageSize = ref(20)
const isEmotionDropdownOpen = ref(false)
const emotionDropdownRef = ref<HTMLElement | null>(null)

const filters = reactive({
  username: '',
  emotions: [] as string[],
  startDate: '',
  endDate: '',
})

const moodLabelMap = EMOTION_MAP
const FILTER_EMOTION_KEYS = [
  'ecstasy',
  'admiration',
  'fear',
  'amazement',
  'grief',
  'disgust',
  'angry',
  'vigilance',
  'delight',
  'trust',
  'terror',
  'surprise',
  'sad',
  'loathing',
  'rage',
  'anticipation',
  'calm',
  'acceptance',
  'apprehension',
  'distraction',
  'pensiveness',
  'boredom',
  'annoyance',
  'interest',
] as const

const moodOptions = EMOTION_OPTIONS.filter((option) =>
  FILTER_EMOTION_KEYS.includes(option.value as (typeof FILTER_EMOTION_KEYS)[number])
)

const emotionColorMap = Object.fromEntries(
  moodOptions.map((option, index) => {
    const hue = (index * 37) % 360
    return [
      option.value,
      {
        dotColor: `hsl(${hue} 60% 52%)`,
        softColor: `hsl(${hue} 70% 95%)`,
        borderColor: `hsl(${hue} 45% 82%)`,
      },
    ]
  })
)

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
      emotions: filters.emotions.length > 0 ? filters.emotions : undefined,
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

const fetchSummary = async () => {
  try {
    const now = new Date()
    const y = now.getFullYear()
    const m = String(now.getMonth() + 1).padStart(2, '0')
    const d = String(now.getDate()).padStart(2, '0')
    const today = `${y}-${m}-${d}`

    const [allRes, todayRes] = await Promise.all([
      getAdminMoods({ page: 1, pageSize: 1 }),
      getAdminMoods({ page: 1, pageSize: 1, startDate: today, endDate: today }),
    ])

    globalTotal.value = allRes.total
    todayTotal.value = todayRes.total
  } catch (error) {
    console.error('加载统计失败', error)
  }
}

const applyFilters = async () => {
  page.value = 1
  isEmotionDropdownOpen.value = false
  await loadMoods()
}

const resetFilters = async () => {
  filters.username = ''
  filters.emotions = []
  filters.startDate = ''
  filters.endDate = ''
  page.value = 1
  isEmotionDropdownOpen.value = false
  await loadMoods()
}

const toggleEmotionDropdown = () => {
  isEmotionDropdownOpen.value = !isEmotionDropdownOpen.value
}

const toggleEmotion = (emotion: string) => {
  const exists = filters.emotions.includes(emotion)
  if (exists) {
    filters.emotions = filters.emotions.filter((item) => item !== emotion)
    return
  }
  filters.emotions = [...filters.emotions, emotion]
}

const removeEmotion = (emotion: string) => {
  filters.emotions = filters.emotions.filter((item) => item !== emotion)
}

const emotionLabel = (emotion: string) => moodLabelMap[emotion] || emotion

const normalizedMoodTypes = (moodTypes?: string[] | string) => {
  if (Array.isArray(moodTypes)) {
    return moodTypes
  }
  if (typeof moodTypes === 'string' && moodTypes.trim()) {
    return moodTypes
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
  }
  return [] as string[]
}

const getEmotionDotStyle = (emotion: string) => {
  const style = emotionColorMap[emotion]
  return {
    backgroundColor: style?.dotColor || '#9ca3af',
  }
}

const handleOutsideClick = (event: MouseEvent) => {
  if (!emotionDropdownRef.value) return
  const target = event.target as Node
  if (!emotionDropdownRef.value.contains(target)) {
    isEmotionDropdownOpen.value = false
  }
}

const refreshList = async () => {
  await Promise.all([loadMoods(), fetchSummary()])
}

const changePage = async (nextPage: number) => {
  page.value = nextPage
  await loadMoods()
}

const formatMoodTypes = (moodTypes: string[]) => {
  const normalized = normalizedMoodTypes(moodTypes)
  if (normalized.length === 0) {
    return '-'
  }
  return normalized.map((item) => emotionLabel(item)).join('、')
}

const formatDate = (value: string) => {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
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

onMounted(async () => {
  document.addEventListener('click', handleOutsideClick)
  await Promise.all([loadMoods(), fetchSummary()])
})

onBeforeUnmount(() => {
  document.removeEventListener('click', handleOutsideClick)
})
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
  margin-bottom: 12px;
}

.header-actions {
  display: flex;
  gap: 8px;
}

.summary-panel {
  display: flex;
  gap: 10px;
  margin-bottom: 14px;
}

.summary-item {
  flex: 1;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  background: #fff;
  padding: 10px 12px;
  display: grid;
  gap: 4px;

  span {
    font-size: 12px;
    color: #64748b;
  }

  strong {
    font-size: 20px;
    color: #0f172a;
  }
}

.summary-item.accent strong {
  color: #2563eb;
}

.filter-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  padding: 12px;
  margin-bottom: 16px;
}

.filter-row {
  display: flex;
  gap: 10px;
  align-items: flex-end;
  flex-wrap: nowrap;
}

.row-main .username-item {
  flex: 1 1 220px;
}

.row-main .emotion-item {
  flex: 2 1 420px;
}

.row-date .date-item {
  flex: 0 0 220px;
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

  .selected-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .selected-tag {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 2px 8px;
    border-radius: 999px;
    background: #eff6ff;
    color: #1d4ed8;
    font-size: 12px;
  }

  .remove-tag-btn {
    border: none;
    background: transparent;
    color: inherit;
    cursor: pointer;
    font-size: 14px;
    line-height: 1;
    min-height: auto;
    padding: 0;
  }
}

.emotion-select {
  position: relative;
}

.emotion-trigger {
  width: 100%;
  min-height: 38px;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  background: #fff;
  padding: 6px 34px 6px 10px;
  text-align: left;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  cursor: pointer;
}

.placeholder {
  color: #94a3b8;
  font-size: 14px;
}

.selected-tags.in-trigger {
  flex: 1;
}

.dropdown-arrow {
  position: absolute;
  right: 10px;
  color: #64748b;
  pointer-events: none;
}

.emotion-options {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  right: 0;
  z-index: 20;
  border: 1px solid #dbe3f0;
  border-radius: 8px;
  background: #fff;
  box-shadow: 0 10px 24px rgba(15, 23, 42, 0.12);
  max-height: 260px;
  overflow-y: auto;
}

.emotion-option {
  width: 100%;
  border: none;
  background: #fff;
  padding: 9px 10px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 14px;
}

.emotion-option:hover {
  background: #f8fafc;
}

.emotion-option.active {
  background: #eff6ff;
  color: #1d4ed8;
}

.option-check {
  font-weight: 700;
}

.actions {
  display: flex;
  align-items: flex-end;
  gap: 8px;
  flex: 0 0 auto;
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
    padding: 12px 8px;
    vertical-align: top;
  }

  thead th {
    background: #f5f5f5;
    font-weight: 600;
    white-space: nowrap;
  }

  tbody tr:nth-child(odd) {
    background: #fefefe;
  }

  tbody tr:hover {
    background: #fafafa;
  }
}

.emotion-cell-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.emotion-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: 1px solid #e2e8f0;
  background: #fff;
  border-radius: 999px;
  padding: 2px 9px;
  font-size: 12px;
  color: #334155;
}

.emotion-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  display: inline-block;
}

.note-cell,
.trigger-cell {
  max-width: 320px;
  white-space: pre-wrap;
  word-break: break-word;
}

.mobile-cards {
  display: none;
}

.mood-card {
  border-bottom: 1px solid #f1f5f9;
  padding: 12px 10px;

  header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
  }

  h4 {
    margin: 0;
    font-size: 15px;
    color: #0f172a;
  }

  header span {
    font-size: 12px;
    color: #64748b;
  }

  .row {
    display: grid;
    gap: 4px;
    margin-bottom: 8px;
  }

  label {
    font-size: 12px;
    color: #64748b;
  }

  p {
    margin: 0;
    font-size: 13px;
    color: #334155;
    white-space: pre-wrap;
    word-break: break-word;
  }
}

.pagination {
  margin-top: 14px;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
}

@media (max-width: 768px) {
  .admin-moods-page {
    padding: 16px;
  }

  .page-header,
  .pagination {
    flex-direction: column;
    align-items: stretch;
  }

  .summary-panel {
    flex-direction: column;
  }

  .header-actions {
    width: 100%;
    flex-wrap: wrap;
  }

  .filter-row {
    flex-direction: column;
    align-items: stretch;
  }

  .row-main .username-item,
  .row-main .emotion-item,
  .row-date .date-item {
    flex: 1 1 auto;
  }

  .actions {
    width: 100%;
  }

  .actions .primary-btn,
  .actions .ghost-btn {
    flex: 1;
  }

  .desktop-table {
    display: none;
  }

  .mobile-cards {
    display: block;
  }

  .table-wrap {
    overflow: hidden;
  }
}
</style>
