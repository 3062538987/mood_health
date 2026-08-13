<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import {
  getAdminAssessments,
  getAdminAssessmentDetail,
  type AdminAssessmentDetail,
  type AdminAssessmentListItem,
} from '@/api/adminAssessments'
import {
  buildAssessmentCsv,
  downloadCsv,
} from '@/utils/assessmentExport'

const loading = ref(false)
const list = ref<AdminAssessmentListItem[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(20)

// 本地复核标记（后端暂无对应写接口，先在前端记录已复核项）
const reviewedIds = reactive<Set<number>>(new Set())
const isReviewed = (id: number): boolean => reviewedIds.has(id)
const toggleReviewed = (id: number) => {
  if (reviewedIds.has(id)) reviewedIds.delete(id)
  else reviewedIds.add(id)
}

const filters = reactive({
  riskLevel: '' as string,
  startDate: '' as string,
  endDate: '' as string,
})

const riskLevelOptions = [
  { value: 'normal', label: '正常' },
  { value: 'mild', label: '轻度' },
  { value: 'moderate', label: '中度' },
  { value: 'high', label: '重度' },
]

const detailVisible = ref(false)
const detailLoading = ref(false)
const detail = ref<AdminAssessmentDetail | null>(null)

const riskTagType = (level: string): 'success' | 'warning' | 'danger' | 'info' => {
  if (level === 'normal' || level === 'low') return 'success'
  if (level === 'mild' || level === 'moderate') return 'warning'
  if (level === 'high' || level === 'severe') return 'danger'
  return 'info'
}

const formatDateTime = (value: string): string => {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  const pad = (n: number) => `${n}`.padStart(2, '0')
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ` +
    `${pad(date.getHours())}:${pad(date.getMinutes())}`
  )
}

const exportCsv = () => {
  if (!list.value.length) {
    ElMessage.warning('当前没有可导出的测评数据')
    return
  }
  const csv = buildAssessmentCsv(list.value, undefined, reviewedIds)
  downloadCsv(`测评管理_${new Date().toISOString().slice(0, 10)}.csv`, csv)
  ElMessage.success(`已导出 ${list.value.length} 条测评记录`)
}

const loadList = async () => {
  loading.value = true
  try {
    const result = await getAdminAssessments({
      page: page.value,
      pageSize: pageSize.value,
      riskLevel: filters.riskLevel || undefined,
      startDate: filters.startDate || undefined,
      endDate: filters.endDate || undefined,
    })
    list.value = result.list
    total.value = result.total
    page.value = result.page
    pageSize.value = result.pageSize
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '加载测评列表失败')
  } finally {
    loading.value = false
  }
}

const handleDateChange = (value: [Date, Date] | null) => {
  if (value && value.length === 2) {
    filters.startDate = value[0].toISOString().slice(0, 10)
    filters.endDate = value[1].toISOString().slice(0, 10)
  } else {
    filters.startDate = ''
    filters.endDate = ''
  }
}

const resetFilters = () => {
  filters.riskLevel = ''
  filters.startDate = ''
  filters.endDate = ''
  page.value = 1
  void loadList()
}

const handlePageChange = (next: number) => {
  page.value = next
  void loadList()
}

const openDetail = async (id: number) => {
  detailVisible.value = true
  detailLoading.value = true
  detail.value = null
  try {
    detail.value = await getAdminAssessmentDetail(id)
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '加载测评详情失败')
  } finally {
    detailLoading.value = false
  }
}

onMounted(loadList)
</script>

<template>
  <section class="admin-assessments">
    <header class="page-header">
      <h1>测评管理</h1>
      <p class="subtitle">查看用户提交的心理健康测评会话与逐项作答明细。</p>
    </header>

    <div class="filter-bar">
      <el-select v-model="filters.riskLevel" placeholder="风险等级" clearable class="filter-item">
        <el-option
          v-for="opt in riskLevelOptions"
          :key="opt.value"
          :label="opt.label"
          :value="opt.value"
        />
      </el-select>
      <el-date-picker
        type="daterange"
        unlink-panels
        range-separator="至"
        start-placeholder="提交开始日期"
        end-placeholder="提交结束日期"
        class="filter-item"
        @change="handleDateChange"
      />
      <el-button type="primary" :loading="loading" @click="loadList">查询</el-button>
      <el-button @click="resetFilters">重置</el-button>
      <el-button :disabled="!list.length" @click="exportCsv">导出 CSV</el-button>
      <span class="review-hint">复核标记为本地状态（后端暂未提供写接口）</span>
    </div>

    <el-table v-loading="loading" :data="list" border stripe class="assessment-table">
      <el-table-column prop="id" label="ID" width="80" />
      <el-table-column prop="username" label="用户" min-width="120">
        <template #default="{ row }">{{ row.username || `用户#${row.userId}` }}</template>
      </el-table-column>
      <el-table-column prop="instrumentName" label="测评量表" min-width="160" />
      <el-table-column prop="rawScore" label="原始分" width="100" />
      <el-table-column label="筛查等级" width="120">
        <template #default="{ row }">
          <el-tag :type="riskTagType(row.screeningLevel)" effect="light">
            {{ row.screeningLevel || '未知' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="提交时间" min-width="160">
        <template #default="{ row }">{{ formatDateTime(row.submittedAt) }}</template>
      </el-table-column>
      <el-table-column label="复核" width="110">
        <template #default="{ row }">
          <el-button
            :type="isReviewed(row.id) ? 'success' : 'info'"
            link
            @click="toggleReviewed(row.id)"
          >
            {{ isReviewed(row.id) ? '已复核' : '标记复核' }}
          </el-button>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="100" fixed="right">
        <template #default="{ row }">
          <el-button type="primary" link @click="openDetail(row.id)">明细</el-button>
        </template>
      </el-table-column>
      <template #empty>
        <span>暂无测评数据</span>
      </template>
    </el-table>

    <div class="pagination">
      <el-pagination
        :current-page="page"
        :page-size="pageSize"
        :total="total"
        layout="total, prev, pager, next"
        background
        @current-change="handlePageChange"
      />
    </div>

    <el-dialog
      v-model="detailVisible"
      title="测评明细"
      width="720px"
      destroy-on-close
    >
      <div v-loading="detailLoading">
        <template v-if="detail">
          <el-descriptions :column="2" border class="detail-meta">
            <el-descriptions-item label="ID">{{ detail.id }}</el-descriptions-item>
            <el-descriptions-item label="用户">
              {{ detail.username || `用户#${detail.userId}` }}
            </el-descriptions-item>
            <el-descriptions-item label="测评量表">{{ detail.instrumentName }}</el-descriptions-item>
            <el-descriptions-item label="版本">{{ detail.versionLabel }}</el-descriptions-item>
            <el-descriptions-item label="原始分">{{ detail.rawScore }}</el-descriptions-item>
            <el-descriptions-item label="筛查等级">
              <el-tag :type="riskTagType(detail.screeningLevel)" effect="light">
                {{ detail.screeningLevel }}
              </el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="提交时间">
              {{ formatDateTime(detail.submittedAt) }}
            </el-descriptions-item>
          </el-descriptions>

          <h3 class="section-title">结果摘要</h3>
          <pre class="result-summary">{{ JSON.stringify(detail.resultSummary, null, 2) }}</pre>

          <h3 class="section-title">逐项作答</h3>
          <el-table :data="detail.answers" border size="small">
            <el-table-column prop="itemId" label="题号" width="70" />
            <el-table-column prop="itemText" label="题目" min-width="240" />
            <el-table-column prop="answerValue" label="作答" width="120" />
            <el-table-column prop="score" label="得分" width="90" />
          </el-table>
        </template>
      </div>
    </el-dialog>
  </section>
</template>

<style scoped>
.admin-assessments {
  padding: 24px 28px 32px;
  color: var(--text-color, #20322d);
}

.page-header h1 {
  margin: 0 0 4px;
  font-size: 22px;
}

.subtitle {
  margin: 0 0 18px;
  color: var(--text-sub, #667a73);
  font-size: 13px;
}

.filter-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 18px;
}

.filter-item {
  width: 220px;
}

.review-hint {
  align-self: center;
  margin-left: auto;
  color: var(--text-sub, #667a73);
  font-size: 12px;
}

.assessment-table {
  width: 100%;
}

.pagination {
  display: flex;
  justify-content: flex-end;
  margin-top: 18px;
}

.detail-meta {
  margin-bottom: 8px;
}

.section-title {
  margin: 20px 0 10px;
  font-size: 15px;
}

.result-summary {
  margin: 0;
  padding: 12px 14px;
  border-radius: 8px;
  background: var(--bg-color, #f3f8f6);
  font-size: 13px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
}
</style>
