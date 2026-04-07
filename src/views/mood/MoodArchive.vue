<template>
  <div class="mood-archive">
    <div class="container">
      <header class="archive-header">
        <div>
          <p class="eyebrow">Mood Archive</p>
          <h2>情绪档案</h2>
          <p class="archive-copy">按时间回看自己的情绪变化，把每一次记录变得更清楚。</p>
        </div>

        <div class="summary-strip">
          <article class="summary-card">
            <span>本月记录</span>
            <strong>{{ monthRecordCount }}</strong>
            <small>条</small>
          </article>
          <article class="summary-card accent">
            <span>主要情绪</span>
            <strong>{{ mainMoodLabel }}</strong>
            <small>{{ monthMoodHint }}</small>
          </article>
        </div>
      </header>

      <section class="filter-section">
        <div class="filter-group">
          <label>时间范围</label>
          <div class="time-filters">
            <button
              v-for="filter in timeFilters"
              :key="filter.key"
              type="button"
              :class="{ active: selectedTimeFilter === filter.key }"
              @click="setTimeFilter(filter.key)"
            >
              {{ filter.label }}
            </button>
          </div>

          <div v-if="selectedTimeFilter === 'custom'" class="custom-time">
            <input v-model="customStartDate" type="date" @change="handleCustomDateChange" />
            <span class="date-separator">至</span>
            <input v-model="customEndDate" type="date" @change="handleCustomDateChange" />
          </div>
        </div>

        <div class="filter-group mood-filter-group">
          <label>情绪类型</label>
          <div class="mood-filters">
            <button
              type="button"
              class="mood-filter all"
              :class="{ active: selectedMoodFilters.length === 0 }"
              @click="clearMoodFilters"
            >
              全部
            </button>
            <button
              v-for="mood in moodTypes"
              :key="mood.type"
              type="button"
              class="mood-filter"
              :class="{ active: selectedMoodFilters.includes(mood.type) }"
              @click="toggleMoodFilter(mood.type)"
            >
              <span class="mood-dot" :style="getMoodChipStyle(mood.type)"></span>
              {{ mood.name }}
            </button>
          </div>
        </div>

        <button class="reset-btn" type="button" @click="resetFilters">重置筛选</button>
      </section>

      <transition name="archive-state" mode="out-in">
        <SoftLoadingState
          v-if="showInitialLoading"
          key="loading"
          variant="cards"
          :item-count="6"
          title="情绪档案正在整理中"
          description="正在为你铺开最近的情绪轨迹，马上就能看到更完整的记录。"
        />

        <div v-else-if="showEmptyState" key="empty" class="empty-state-shell">
          <SoftEmptyState
            :title="emptyStateTitle"
            :description="emptyStateDescription"
            action-text="去记录情绪"
            @action="goToMoodRecord"
          />
        </div>

        <div v-else key="content" class="records-shell">
          <div class="records-grid">
            <article
              v-for="record in filteredRecords"
              :key="record.id"
              class="record-card"
              @click="showDetail(record)"
            >
              <div class="record-top">
                <div class="record-date-block">
                  <div class="record-date">{{ formatArchiveDate(record.createTime) }}</div>
                  <div class="record-meta">{{ formatArchiveDateMeta(record.createTime) }}</div>
                </div>

                <div class="record-actions">
                  <button
                    class="action-btn edit-btn"
                    type="button"
                    @click.stop="editRecord(record)"
                  >
                    编辑
                  </button>
                  <button
                    class="action-btn delete-btn"
                    type="button"
                    @click.stop="confirmDeleteRecord(record)"
                  >
                    删除
                  </button>
                </div>
              </div>

              <div class="mood-tags">
                <span
                  v-for="type in record.moodType"
                  :key="type"
                  class="mood-tag"
                  :style="getMoodTagStyle(type)"
                >
                  {{ getMoodName(type) }}
                </span>
              </div>

              <div class="intensity-block">
                <div class="intensity-head">
                  <span>强度</span>
                  <strong>{{ getDisplayIntensity(record) }}/10</strong>
                </div>
                <div class="intensity-dots" :aria-label="`情绪强度 ${getDisplayIntensity(record)} / 10`">
                  <span
                    v-for="level in 10"
                    :key="level"
                    class="intensity-dot"
                    :class="{ active: level <= getDisplayIntensity(record) }"
                  ></span>
                </div>
              </div>

              <p v-if="record.event" class="record-note">{{ record.event }}</p>

              <div v-if="getTags(record).length > 0" class="trigger-tags">
                <span v-for="tag in getTags(record)" :key="tag" class="trigger-tag">
                  {{ tag }}
                </span>
              </div>
            </article>
          </div>

          <div v-if="hasMore" class="load-more">
            <el-button type="primary" :loading="isLoading" @click="loadMore"> 加载更多 </el-button>
          </div>
        </div>
      </transition>
    </div>

    <el-dialog
      v-model="showDetailDialog"
      :title="`情绪详情 - ${formatDateDetail(selectedRecord?.createTime)}`"
      width="500px"
      class="detail-dialog"
    >
      <div v-if="selectedRecord" class="detail-content">
        <div class="detail-section">
          <h4>情绪类型</h4>
          <div class="detail-emotions">
            <div
              v-for="(type, idx) in selectedRecord.moodType"
              :key="idx"
              class="detail-emotion-item"
            >
              <div class="emotion-dot-large" :style="getMoodDotStyle(type)"></div>
              <div class="emotion-info">
                <span class="emotion-name">{{ getMoodName(type) }}</span>
                <span class="emotion-ratio">{{ selectedRecord.moodRatio[idx] || 50 }}%</span>
              </div>
            </div>
          </div>
        </div>

        <div class="detail-section">
          <h4>触发因素</h4>
          <div class="detail-triggers">
            <span v-for="tag in getTags(selectedRecord)" :key="tag" class="trigger-tag">
              {{ tag }}
            </span>
          </div>
        </div>

        <div class="detail-section">
          <h4>情绪描述</h4>
          <p class="detail-note">{{ selectedRecord.event }}</p>
        </div>

        <div v-if="selectedRecord && getDisplayIntensity(selectedRecord) > 0" class="detail-section">
          <h4>情绪强度</h4>
          <div class="intensity-bar">
            <div
              class="intensity-fill"
              :style="{
                width: `${getDisplayIntensity(selectedRecord) * 10}%`,
                background: getIntensityColor(getDisplayIntensity(selectedRecord)),
              }"
            ></div>
            <span class="intensity-value">{{ getDisplayIntensity(selectedRecord) }}/10</span>
          </div>
        </div>
      </div>

      <template #footer>
        <el-button @click="showDetailDialog = false">关闭</el-button>
        <el-button type="primary" @click="editRecord(selectedRecord!)"> 编辑 </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useRouter } from 'vue-router'
import SoftEmptyState from '@/components/shared/SoftEmptyState.vue'
import SoftLoadingState from '@/components/shared/SoftLoadingState.vue'

import { getMoodRecordList } from '@/api/mood'
import { EMOTION_MAP, EMOTION_OPTIONS } from '@/constants/emotions'
import { MoodRecord } from '@/types/mood'

const router = useRouter()

const emotionVisualMap: Record<
  string,
  { color: string; softColor: string; textColor: string; borderColor: string }
> = {
  happy: {
    color: '#ffd166',
    softColor: 'rgba(255, 209, 102, 0.18)',
    textColor: '#8c6500',
    borderColor: 'rgba(255, 209, 102, 0.45)',
  },
  delight: {
    color: '#d7aefb',
    softColor: 'rgba(215, 174, 251, 0.18)',
    textColor: '#7a41a8',
    borderColor: 'rgba(215, 174, 251, 0.45)',
  },
  neutral: {
    color: '#9ca3af',
    softColor: 'rgba(156, 163, 175, 0.18)',
    textColor: '#4b5563',
    borderColor: 'rgba(156, 163, 175, 0.45)',
  },
  anxious: {
    color: '#f3a683',
    softColor: 'rgba(243, 166, 131, 0.18)',
    textColor: '#a4572d',
    borderColor: 'rgba(243, 166, 131, 0.45)',
  },
  sad: {
    color: '#4d96ff',
    softColor: 'rgba(77, 150, 255, 0.16)',
    textColor: '#1f5fbf',
    borderColor: 'rgba(77, 150, 255, 0.45)',
  },
  excited: {
    color: '#fb7185',
    softColor: 'rgba(251, 113, 133, 0.16)',
    textColor: '#be123c',
    borderColor: 'rgba(251, 113, 133, 0.45)',
  },
  calm: {
    color: '#6ab0a5',
    softColor: 'rgba(106, 176, 165, 0.18)',
    textColor: '#32665f',
    borderColor: 'rgba(106, 176, 165, 0.45)',
  },
  angry: {
    color: '#ef476f',
    softColor: 'rgba(239, 71, 111, 0.16)',
    textColor: '#b42f4c',
    borderColor: 'rgba(239, 71, 111, 0.45)',
  },
  irritable: {
    color: '#8d99ae',
    softColor: 'rgba(141, 153, 174, 0.18)',
    textColor: '#5f6a78',
    borderColor: 'rgba(141, 153, 174, 0.45)',
  },
  tired: {
    color: '#94a3b8',
    softColor: 'rgba(148, 163, 184, 0.18)',
    textColor: '#475569',
    borderColor: 'rgba(148, 163, 184, 0.45)',
  },
  grateful: {
    color: '#f59e0b',
    softColor: 'rgba(245, 158, 11, 0.18)',
    textColor: '#92400e',
    borderColor: 'rgba(245, 158, 11, 0.45)',
  },
}

const defaultMoodVisual = {
  color: '#8d99ae',
  softColor: 'rgba(141, 153, 174, 0.16)',
  textColor: '#5f6a78',
  borderColor: 'rgba(141, 153, 174, 0.35)',
}

// 情绪类型筛选项来源统一到共享常量
const moodTypes = EMOTION_OPTIONS.map((option) => {
  const visual = emotionVisualMap[option.value] || defaultMoodVisual
  return {
    type: option.value,
    name: option.label,
    ...visual,
  }
})

// 时间筛选选项
const timeFilters = [
  { key: 'today', label: '今日' },
  { key: 'thisWeek', label: '本周' },
  { key: 'thisMonth', label: '本月' },
  { key: 'custom', label: '自定义' },
]

// 状态管理
const moodRecords = ref<MoodRecord[]>([])
const selectedTimeFilter = ref('thisMonth')
const customStartDate = ref('')
const customEndDate = ref('')
const selectedMoodFilters = ref<string[]>([])
const currentPage = ref(1)
const pageSize = ref(20)
const totalRecords = ref(0)
const isLoading = ref(false)
const showDetailDialog = ref(false)
const selectedRecord = ref<MoodRecord | null>(null)
const hasFetchedRecords = ref(false)

const showInitialLoading = computed(
  () => !hasFetchedRecords.value || (isLoading.value && moodRecords.value.length === 0)
)

const showEmptyState = computed(
  () => hasFetchedRecords.value && !isLoading.value && filteredRecords.value.length === 0
)

// 计算属性：是否有更多数据
const hasMore = computed(() => {
  return moodRecords.value.length < totalRecords.value
})

const currentMonthRecords = computed(() => {
  const now = new Date()
  return moodRecords.value.filter((record) => {
    const recordDate = new Date(record.createTime)
    return (
      recordDate.getFullYear() === now.getFullYear() && recordDate.getMonth() === now.getMonth()
    )
  })
})

const monthRecordCount = computed(() => currentMonthRecords.value.length)

const mainMoodLabel = computed(() => {
  if (currentMonthRecords.value.length === 0) {
    return '暂无'
  }

  const moodCounts = new Map<string, number>()
  currentMonthRecords.value.forEach((record) => {
    record.moodType.forEach((type) => {
      moodCounts.set(type, (moodCounts.get(type) || 0) + 1)
    })
  })

  let dominantMood = ''
  let highestCount = 0

  moodCounts.forEach((count, type) => {
    if (count > highestCount) {
      highestCount = count
      dominantMood = type
    }
  })

  return dominantMood ? getMoodName(dominantMood) : '暂无'
})

const monthMoodHint = computed(() => {
  if (currentMonthRecords.value.length === 0) {
    return '先记录一条情绪'
  }

  return `${currentMonthRecords.value.length} 条记录`
})

const emptyStateTitle = computed(() => {
  return moodRecords.value.length === 0 ? '还没有记录，去记录第一条情绪' : '没有符合当前筛选的记录'
})

const emptyStateDescription = computed(() => {
  return moodRecords.value.length === 0
    ? '先记录今天的心情、触发因素和强度，档案页就会逐渐变得更完整。'
    : '尝试切换时间范围或情绪类型，找回你想查看的那一段情绪轨迹。'
})

// 计算属性：筛选后的记录
const filteredRecords = computed(() => {
  let records = [...moodRecords.value]

  // 时间筛选
  const now = new Date()
  let startDate = new Date(0)
  let endDate = new Date()

  switch (selectedTimeFilter.value) {
    case 'today':
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
      break
    case 'thisWeek':
      const dayOfWeek = now.getDay() || 7
      startDate = new Date(now)
      startDate.setDate(now.getDate() - dayOfWeek + 1)
      startDate.setHours(0, 0, 0, 0)
      endDate = new Date(startDate)
      endDate.setDate(startDate.getDate() + 7)
      break
    case 'thisMonth':
      startDate = new Date(now.getFullYear(), now.getMonth(), 1)
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 1)
      break
    case 'custom':
      if (customStartDate.value && customEndDate.value) {
        startDate = new Date(customStartDate.value)
        endDate = new Date(customEndDate.value)
        endDate.setHours(23, 59, 59, 999)
      }
      break
  }

  records = records.filter((record) => {
    const recordDate = new Date(record.createTime)
    return recordDate >= startDate && recordDate < endDate
  })

  // 情绪类型筛选
  if (selectedMoodFilters.value.length > 0) {
    records = records.filter((record) =>
      record.moodType.some((type) => selectedMoodFilters.value.includes(type))
    )
  }

  // 按时间倒序排序
  return records.sort((a, b) => new Date(b.createTime).getTime() - new Date(a.createTime).getTime())
})

// 获取情绪记录列表
const fetchMoodRecords = async () => {
  try {
    isLoading.value = true
    const response = await getMoodRecordList({
      page: currentPage.value,
      size: pageSize.value,
    })
    if (currentPage.value === 1) {
      moodRecords.value = response.list
    } else {
      moodRecords.value = [...moodRecords.value, ...response.list]
    }
    totalRecords.value = response.total
  } catch (error) {
    console.error('获取情绪记录失败', error)
    ElMessage.error('获取情绪记录失败，请稍后再试')
  } finally {
    hasFetchedRecords.value = true
    isLoading.value = false
  }
}

// 加载更多
const loadMore = async () => {
  if (!isLoading.value && hasMore.value) {
    currentPage.value++
    await fetchMoodRecords()
  }
}

// 设置时间筛选
const setTimeFilter = (filterKey: string) => {
  selectedTimeFilter.value = filterKey
  if (filterKey !== 'custom') {
    customStartDate.value = ''
    customEndDate.value = ''
  }
}

// 处理自定义日期变化
const handleCustomDateChange = () => {
  if (customStartDate.value && customEndDate.value) {
    const start = new Date(customStartDate.value)
    const end = new Date(customEndDate.value)
    if (start > end) {
      customEndDate.value = customStartDate.value
    }
  }
}

// 切换情绪类型筛选
const toggleMoodFilter = (moodType: string) => {
  const index = selectedMoodFilters.value.indexOf(moodType)
  if (index > -1) {
    selectedMoodFilters.value.splice(index, 1)
  } else {
    selectedMoodFilters.value.push(moodType)
  }
}

// 清除情绪类型筛选
const clearMoodFilters = () => {
  selectedMoodFilters.value = []
}

// 重置筛选
const resetFilters = () => {
  selectedTimeFilter.value = 'thisMonth'
  customStartDate.value = ''
  customEndDate.value = ''
  selectedMoodFilters.value = []
  currentPage.value = 1
  fetchMoodRecords()
}

// 获取标签
const getTags = (record: MoodRecord) => {
  const tags: string[] = []
  if (record.trigger) {
    tags.push(...record.trigger.split(',').map((t) => t.trim()))
  }
  if (record.tags && Array.isArray(record.tags)) {
    tags.push(...record.tags)
  }
  return tags.filter((tag) => tag).slice(0, 3)
}

// 截断文本
const truncateText = (text: string, maxLength: number) => {
  if (!text) return ''
  return text.length > maxLength ? text.substring(0, maxLength) + '...' : text
}

const toLocalDateTime = (dateString?: string) => {
  if (!dateString) return ''

  const date = new Date(dateString)
  if (Number.isNaN(date.getTime())) return ''

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

const formatDateDetail = (dateString?: string) => {
  return toLocalDateTime(dateString)
}

const formatArchiveDate = (dateString: string) => {
  const localDateTime = toLocalDateTime(dateString)
  if (!localDateTime) return ''
  return localDateTime.split(' ')[0] || ''
}

const formatArchiveDateMeta = (dateString: string) => {
  const localDateTime = toLocalDateTime(dateString)
  if (!localDateTime) return ''
  return localDateTime.split(' ')[1] || ''
}

const normalizeIntensity = (value: unknown) => {
  const numeric = Number(value)
  if (!Number.isFinite(numeric) || numeric <= 0) return 0
  return Math.max(1, Math.min(10, Math.round(numeric)))
}

const getDisplayIntensity = (record?: MoodRecord | null) => {
  if (!record) return 0

  const directIntensity = normalizeIntensity(record.intensity)
  if (directIntensity > 0) {
    return directIntensity
  }

  if (Array.isArray(record.moodRatio) && record.moodRatio.length > 0) {
    const firstRatio = Number(record.moodRatio[0])
    if (Number.isFinite(firstRatio) && firstRatio > 0) {
      const derived = firstRatio <= 10 ? firstRatio : firstRatio / 10
      return normalizeIntensity(derived)
    }
  }

  return 0
}

// 获取情绪颜色
const getMoodColor = (moodType: string) => {
  const mood = moodTypes.find((m) => m.type === moodType)
  return mood ? mood.color : '#999'
}

const getMoodChipStyle = (moodType: string) => {
  const mood = moodTypes.find((m) => m.type === moodType)
  if (!mood) {
    return {
      backgroundColor: 'rgba(141, 153, 174, 0.16)',
      color: '#5f6a78',
      borderColor: 'rgba(141, 153, 174, 0.35)',
    }
  }

  return {
    backgroundColor: mood.softColor,
    color: mood.textColor,
    borderColor: mood.borderColor,
  }
}

const getMoodTagStyle = (moodType: string) => getMoodChipStyle(moodType)

const getMoodDotStyle = (moodType: string) => {
  const mood = moodTypes.find((m) => m.type === moodType)
  return mood ? { backgroundColor: mood.color } : { backgroundColor: '#999' }
}

// 获取情绪名称
const getMoodName = (moodType: string) => {
  return EMOTION_MAP[moodType] || moodType
}

// 获取强度颜色
const getIntensityColor = (intensity: number) => {
  if (intensity <= 3) return '#4d96ff'
  if (intensity <= 6) return '#ffd166'
  return '#ef476f'
}

// 显示详情
const showDetail = (record: MoodRecord) => {
  selectedRecord.value = record
  showDetailDialog.value = true
}

// 编辑记录
const editRecord = (record: MoodRecord) => {
  showDetailDialog.value = false
  router.push({
    path: '/mood/record',
    query: { edit: 'true', id: record.id },
  })
}

const goToMoodRecord = () => {
  router.push('/mood/record')
}

// 确认删除记录
const confirmDeleteRecord = (record: MoodRecord) => {
  ElMessageBox.confirm('确定要删除这条情绪记录吗？', '删除确认', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning',
  })
    .then(async () => {
      try {
        const index = moodRecords.value.findIndex((r) => r.id === record.id)
        if (index > -1) {
          moodRecords.value.splice(index, 1)
        }
        ElMessage.success('记录删除成功！')
      } catch (error) {
        console.error('删除失败', error)
        ElMessage.error('删除失败，请稍后再试')
      }
    })
    .catch(() => {
      // 取消删除
    })
}

// 组件挂载时获取数据
onMounted(() => {
  fetchMoodRecords()
})
</script>

<style scoped lang="scss">
@use '@/assets/styles/theme.scss' as *;

.mood-archive {
  padding: 24px 20px 28px;
  background:
    radial-gradient(circle at top left, rgba(255, 209, 102, 0.15), transparent 28%),
    radial-gradient(circle at top right, rgba(106, 176, 165, 0.14), transparent 30%),
    linear-gradient(180deg, rgba(255, 255, 255, 0.65), rgba(248, 245, 242, 0.92));

  .container {
    max-width: 1200px;
    margin: 0 auto;
  }

  .archive-header {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 24px;
    margin-bottom: 22px;
    padding: 4px 2px 8px;
  }

  .eyebrow {
    margin: 0 0 10px;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    font-size: 12px;
    font-weight: 700;
    color: var(--primary-color);
  }

  h2 {
    margin: 0;
    font-size: 28px;
    font-weight: 800;
    color: var(--text-color);
  }

  .archive-copy {
    margin: 10px 0 0;
    color: var(--text-light-color);
    line-height: 1.7;
  }

  .summary-strip {
    display: flex;
    gap: 12px;
    flex-wrap: wrap;
    justify-content: flex-end;
  }

  .summary-card {
    min-width: 160px;
    padding: 16px 18px;
    border-radius: 18px;
    background: rgba(255, 255, 255, 0.82);
    border: 1px solid rgba(255, 255, 255, 0.75);
    box-shadow: 0 12px 28px rgba(106, 176, 165, 0.1);
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .summary-card span {
    font-size: 12px;
    color: var(--text-light-color);
    font-weight: 600;
  }

  .summary-card strong {
    font-size: 24px;
    line-height: 1.1;
    color: var(--text-color);
  }

  .summary-card small {
    color: var(--text-light-color);
    font-size: 12px;
  }

  .summary-card.accent {
    background: linear-gradient(135deg, rgba(255, 209, 102, 0.22), rgba(106, 176, 165, 0.16));
  }

  .filter-section {
    background: rgba(255, 255, 255, 0.76);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border: 1px solid rgba(255, 255, 255, 0.65);
    border-radius: 24px;
    box-shadow: 0 16px 40px rgba(31, 38, 135, 0.08);
    padding: 20px;
    margin-bottom: 28px;
    display: flex;
    flex-wrap: wrap;
    gap: 18px;
    align-items: flex-start;
  }

  .filter-group {
    display: flex;
    flex-direction: column;
    gap: 10px;
    min-width: 280px;
    flex: 1 1 360px;
  }

  label {
    font-weight: 700;
    color: var(--text-color);
    font-size: $font-size-sm;
  }

  .time-filters {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
  }

  .time-filters button,
  .mood-filters button {
    border: 1px solid var(--border-color);
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.82);
    backdrop-filter: blur(8px);
    cursor: pointer;
    transition:
      transform 0.25s ease,
      border-color 0.25s ease,
      background 0.25s ease,
      color 0.25s ease;
    font-size: $font-size-sm;
    font-weight: 600;

    &:hover {
      transform: translateY(-1px);
      border-color: var(--primary-color);
    }

    &.active {
      background: linear-gradient(135deg, var(--primary-color), var(--secondary-color));
      color: var(--white);
      border-color: transparent;
      box-shadow: 0 10px 20px rgba(106, 176, 165, 0.2);
    }
  }

  .time-filters button {
    padding: 9px 16px;
  }

  .custom-time {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;

    input {
      padding: 9px 12px;
      border: 1px solid var(--border-color);
      border-radius: 12px;
      background: rgba(255, 255, 255, 0.88);
      font-size: $font-size-sm;
    }

    .date-separator {
      color: var(--text-light-color);
    }
  }

  .mood-filters {
    display: flex;
    gap: 10px;
    flex-wrap: nowrap;
    overflow-x: auto;
    padding-bottom: 2px;
    scrollbar-width: thin;
  }

  .mood-filter {
    padding: 9px 14px;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    white-space: nowrap;
    flex: 0 0 auto;
  }

  .mood-filter.all {
    min-width: 72px;
    justify-content: center;
  }

  .mood-dot {
    width: 10px;
    height: 10px;
    border-radius: 999px;
    border: 1px solid rgba(255, 255, 255, 0.6);
    box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.18);
  }

  .reset-btn {
    align-self: center;
    margin-left: auto;
    padding: 10px 16px;
    border: 1px solid var(--border-color);
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.85);
    cursor: pointer;
    transition:
      transform 0.25s ease,
      color 0.25s ease,
      border-color 0.25s ease;

    &:hover {
      color: var(--primary-color);
      border-color: var(--primary-color);
      transform: translateY(-1px);
    }
  }

  .empty-state-shell {
    min-height: 420px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .records-shell {
    min-height: 420px;
  }

  .records-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 18px;
  }

  .record-card {
    background: rgba(255, 255, 255, 0.82);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border: 1px solid rgba(255, 255, 255, 0.75);
    border-radius: 22px;
    box-shadow: 0 14px 30px rgba(31, 38, 135, 0.08);
    padding: 18px;
    cursor: pointer;
    display: flex;
    flex-direction: column;
    gap: 16px;
    transition:
      transform 0.28s ease,
      box-shadow 0.28s ease,
      border-color 0.28s ease;
    position: relative;
    overflow: hidden;

    &::before {
      content: '';
      position: absolute;
      inset: 0 auto auto 0;
      width: 100%;
      height: 4px;
      background: linear-gradient(90deg, rgba(255, 209, 102, 0.95), rgba(106, 176, 165, 0.85));
      opacity: 0.9;
    }

    &:hover {
      transform: translateY(-4px);
      box-shadow: 0 20px 40px rgba(31, 38, 135, 0.12);
      border-color: rgba(106, 176, 165, 0.28);
    }
  }

  .record-top {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 14px;
    margin-top: 2px;
  }

  .record-date {
    font-size: 24px;
    line-height: 1.1;
    font-weight: 800;
    color: var(--text-color);
  }

  .record-meta {
    margin-top: 6px;
    font-size: 12px;
    color: var(--text-light-color);
  }

  .record-actions {
    display: flex;
    gap: 8px;
    flex-shrink: 0;
  }

  .action-btn {
    border: none;
    border-radius: 999px;
    padding: 8px 12px;
    font-size: 12px;
    font-weight: 700;
    cursor: pointer;
    transition:
      transform 0.25s ease,
      opacity 0.25s ease,
      box-shadow 0.25s ease;

    &:hover {
      transform: translateY(-1px);
      opacity: 0.96;
    }
  }

  .edit-btn {
    background: rgba(106, 176, 165, 0.14);
    color: var(--primary-color);
  }

  .delete-btn {
    background: rgba(239, 71, 111, 0.12);
    color: var(--mood-angry);
  }

  .mood-tags {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }

  .mood-tag {
    display: inline-flex;
    align-items: center;
    padding: 6px 12px;
    border-radius: 999px;
    border: 1px solid transparent;
    font-size: 12px;
    font-weight: 700;
    line-height: 1;
  }

  .intensity-block {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 14px;
    border-radius: 18px;
    background: rgba(248, 245, 242, 0.86);
  }

  .intensity-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    font-size: 12px;
    color: var(--text-light-color);

    strong {
      color: var(--text-color);
      font-size: 14px;
    }
  }

  .intensity-dots {
    display: grid;
    grid-template-columns: repeat(10, minmax(0, 1fr));
    gap: 6px;
  }

  .intensity-dot {
    height: 10px;
    border-radius: 999px;
    background: rgba(125, 125, 125, 0.18);
    transition:
      transform 0.25s ease,
      background 0.25s ease,
      box-shadow 0.25s ease;

    &.active {
      background: linear-gradient(90deg, #ffd166, #f3a683);
      box-shadow: 0 4px 10px rgba(243, 166, 131, 0.18);
    }
  }

  .record-note {
    margin: 0;
    color: var(--text-light-color);
    font-style: italic;
    line-height: 1.7;
  }

  .trigger-tags {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }

  .trigger-tag {
    display: inline-flex;
    align-items: center;
    padding: 6px 11px;
    border-radius: 999px;
    background: rgba(106, 176, 165, 0.12);
    color: var(--primary-color);
    font-size: 12px;
    font-weight: 600;
  }

  .load-more {
    text-align: center;
    margin-top: 32px;
  }
}

.detail-dialog {
  .detail-content {
    .detail-section {
      margin-bottom: 24px;

      h4 {
        font-size: $font-size-md;
        font-weight: 700;
        color: var(--text-color);
        margin-bottom: 12px;
        font-family: 'Noto Serif SC', serif;
      }

      .detail-emotions {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }

      .detail-emotion-item {
        display: flex;
        align-items: center;
        gap: 16px;
        padding: 12px;
        background: rgba(255, 255, 255, 0.5);
        border-radius: $border-radius-md;
      }

      .emotion-dot-large {
        width: 40px;
        height: 40px;
        border-radius: 50%;
        flex-shrink: 0;
      }

      .emotion-info {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }

      .emotion-name {
        font-weight: 600;
        color: var(--text-color);
      }

      .emotion-ratio {
        font-size: $font-size-sm;
        color: var(--text-light-color);
      }

      .detail-triggers {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }

      .trigger-tag {
        padding: 6px 14px;
        background: rgba(106, 176, 165, 0.15);
        color: var(--primary-color);
        border-radius: $border-radius-full;
        font-size: $font-size-sm;
        font-weight: 500;
      }

      .detail-note {
        color: var(--text-color);
        line-height: 1.6;
        font-size: $font-size-md;
      }

      .intensity-bar {
        display: flex;
        align-items: center;
        gap: 12px;
      }

      .intensity-fill {
        height: 12px;
        border-radius: 6px;
        transition: width 0.5s ease;
      }

      .intensity-value {
        font-weight: 600;
        color: var(--text-color);
        min-width: 40px;
      }
    }
  }
}

.archive-state-enter-active,
.archive-state-leave-active {
  transition:
    opacity 0.3s ease,
    transform 0.3s ease;
}

.archive-state-enter-from,
.archive-state-leave-to {
  opacity: 0;
  transform: translateY(10px);
}

@media (max-width: 768px) {
  .mood-archive {
    padding: 18px 14px 22px;

    .archive-header {
      flex-direction: column;
      align-items: flex-start;
      margin-bottom: 18px;
    }

    h2 {
      font-size: 24px;
    }

    .summary-strip {
      width: 100%;
      justify-content: stretch;
    }

    .summary-card {
      flex: 1 1 0;
      min-width: 0;
    }

    .filter-section {
      flex-direction: column;
      align-items: stretch;
      padding: 16px;
    }

    .filter-group {
      min-width: 0;
      flex-basis: auto;
    }

    .reset-btn {
      margin-left: 0;
      align-self: flex-start;
    }

    .records-grid {
      grid-template-columns: 1fr;
    }

    .record-card {
      padding: 16px;
    }

    .record-top {
      flex-direction: column;
    }

    .record-actions {
      width: 100%;
    }

    .action-btn {
      min-height: 44px;
      flex: 1;
    }

    .record-date {
      font-size: 22px;
    }
  }
}
</style>
