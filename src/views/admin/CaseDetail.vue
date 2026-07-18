<template>
  <div class="case-detail-page">
    <div class="page-header">
      <button class="back-btn" @click="$router.push('/admin/cases')">&larr; 返回列表</button>
      <h2>个案详情 #{{ caseData?.case.id }}</h2>
    </div>

    <div v-if="loading" class="state-block">加载中...</div>
    <div v-else-if="!caseData" class="state-block">个案不存在</div>

    <template v-else>
      <!-- 个案基本信息 -->
      <div class="info-card">
        <h3>基本信息</h3>
        <div class="info-grid">
          <div class="info-item">
            <label>学生ID</label>
            <span>{{ caseData.case.studentUserId }}</span>
          </div>
          <div class="info-item">
            <label>状态</label>
            <span :class="['status-tag', statusClass(caseData.case.status)]">
              {{ statusLabel(caseData.case.status) }}
            </span>
          </div>
          <div class="info-item">
            <label>风险等级</label>
            <span
              v-if="caseData.case.riskLevel"
              :class="['risk-tag', riskClass(caseData.case.riskLevel)]"
            >
              {{ riskLabel(caseData.case.riskLevel) }}
            </span>
            <span v-else class="text-muted">-</span>
          </div>
          <div class="info-item">
            <label>咨询师ID</label>
            <span>{{ caseData.case.assignedCounselorId || '未分配' }}</span>
          </div>
          <div class="info-item">
            <label>创建时间</label>
            <span>{{ formatDate(caseData.case.createdAt) }}</span>
          </div>
          <div class="info-item">
            <label>更新时间</label>
            <span>{{ formatDate(caseData.case.updatedAt) }}</span>
          </div>
        </div>
        <div v-if="caseData.case.summary" class="summary-section">
          <label>摘要</label>
          <p>{{ caseData.case.summary }}</p>
        </div>
      </div>

      <!-- 操作区 -->
      <div v-if="canOperate" class="actions-card">
        <h3>个案操作</h3>

        <!-- 分配咨询师 -->
        <div v-if="caseData.case.status === 'open'" class="action-row">
          <label>分配咨询师：</label>
          <input
            v-model="assignForm.counselorId"
            type="number"
            min="1"
            placeholder="咨询师用户ID"
            class="action-input"
          />
          <button class="action-btn primary" :disabled="actionLoading" @click="handleAssign">
            {{ actionLoading ? '分配中...' : '分配' }}
          </button>
        </div>

        <!-- 添加干预 -->
        <div v-if="['assigned', 'in_progress'].includes(caseData.case.status)" class="action-row">
          <label>干预类型：</label>
          <select v-model="interventionForm.type" class="action-select">
            <option value="note">备注</option>
            <option value="interview">访谈</option>
          </select>
          <textarea
            v-model="interventionForm.content"
            placeholder="干预内容..."
            class="action-textarea"
            rows="3"
          ></textarea>
          <button
            class="action-btn primary"
            :disabled="actionLoading"
            @click="handleAddIntervention"
          >
            {{ actionLoading ? '提交中...' : '添加干预' }}
          </button>
        </div>

        <!-- 转介 -->
        <div v-if="['assigned', 'in_progress'].includes(caseData.case.status)" class="action-row">
          <label>转介目标：</label>
          <input
            v-model="referForm.target"
            type="text"
            placeholder="转介目标（如：校外心理咨询中心）"
            class="action-input"
          />
          <label>转介原因：</label>
          <textarea
            v-model="referForm.reason"
            placeholder="转介原因..."
            class="action-textarea"
            rows="2"
          ></textarea>
          <button class="action-btn warning" :disabled="actionLoading" @click="handleRefer">
            {{ actionLoading ? '转介中...' : '转介' }}
          </button>
        </div>

        <!-- 结案 -->
        <div v-if="['assigned', 'in_progress'].includes(caseData.case.status)" class="action-row">
          <label>结案摘要：</label>
          <textarea
            v-model="closeForm.summary"
            placeholder="结案摘要..."
            class="action-textarea"
            rows="3"
          ></textarea>
          <button class="action-btn success" :disabled="actionLoading" @click="handleClose">
            {{ actionLoading ? '结案中...' : '结案' }}
          </button>
        </div>
      </div>

      <div v-else-if="isAdmin" class="state-block text-muted">个案已结案或已转介，无法继续操作</div>

      <!-- 干预记录 -->
      <div class="interventions-card">
        <h3>干预记录（{{ interventions.length }}）</h3>
        <div v-if="interventions.length === 0" class="state-block text-muted">暂无干预记录</div>
        <div v-else class="intervention-list">
          <div v-for="item in interventions" :key="item.id" class="intervention-item">
            <div class="intervention-header">
              <span
                :class="['intervention-type-tag', interventionTypeClass(item.interventionType)]"
              >
                {{ interventionTypeLabel(item.interventionType) }}
              </span>
              <span class="intervention-time">{{ formatDate(item.createdAt) }}</span>
            </div>
            <p class="intervention-content">{{ item.content }}</p>
            <div v-if="item.referralTarget" class="intervention-meta">
              转介目标：{{ item.referralTarget }}
            </div>
            <div v-if="item.referralReason" class="intervention-meta">
              转介原因：{{ item.referralReason }}
            </div>
            <div v-if="item.closureSummary" class="intervention-meta">
              结案摘要：{{ item.closureSummary }}
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  getCaseDetail,
  assignCase,
  addIntervention,
  referCase,
  closeCase,
  type CaseDetail,
  type CaseIntervention,
  type CaseStatus,
  type InterventionType,
} from '@/api/case'
import { useUserStore } from '@/stores/userStore'

const route = useRoute()
const userStore = useUserStore()
const caseData = ref<CaseDetail | null>(null)
const interventions = ref<CaseIntervention[]>([])
const loading = ref(false)
const actionLoading = ref(false)

const isAdmin = computed(() => userStore.isAdmin)
const canOperate = computed(() => {
  if (!caseData.value) return false
  return ['open', 'assigned', 'in_progress'].includes(caseData.value.case.status)
})

const assignForm = reactive({ counselorId: '' })
const interventionForm = reactive({ type: 'note' as InterventionType, content: '' })
const referForm = reactive({ target: '', reason: '' })
const closeForm = reactive({ summary: '' })

const statusLabels: Record<CaseStatus, string> = {
  open: '待处理',
  assigned: '已分配',
  in_progress: '处理中',
  referred: '已转介',
  closed: '已结案',
}

const statusLabel = (s: CaseStatus) => statusLabels[s] || s

const statusClass = (s: CaseStatus) => {
  const map: Record<string, string> = {
    open: 'status-open',
    assigned: 'status-assigned',
    in_progress: 'status-progress',
    referred: 'status-referred',
    closed: 'status-closed',
  }
  return map[s] || ''
}

const riskLabels: Record<string, string> = {
  low: '低风险',
  mild: '轻度',
  moderate: '中度',
  high: '高风险',
}

const riskLabel = (l: string) => riskLabels[l] || l

const riskClass = (l: string) => {
  const map: Record<string, string> = {
    low: 'risk-low',
    mild: 'risk-mild',
    moderate: 'risk-moderate',
    high: 'risk-high',
  }
  return map[l] || ''
}

const interventionTypeLabels: Record<InterventionType, string> = {
  note: '备注',
  interview: '访谈',
  referral: '转介',
  closure: '结案',
}

const interventionTypeLabel = (t: InterventionType) => interventionTypeLabels[t] || t

const interventionTypeClass = (t: InterventionType) => `itype-${t}`

const formatDate = (s: string) => {
  if (!s) return '-'
  return new Date(s).toLocaleString('zh-CN')
}

const loadDetail = async () => {
  const id = Number(route.params.id)
  if (!id) return
  loading.value = true
  try {
    const data = await getCaseDetail(id)
    caseData.value = data
    interventions.value = data.interventions || []
  } catch {
    ElMessage.error('获取个案详情失败')
  } finally {
    loading.value = false
  }
}

const handleAssign = async () => {
  const id = Number(route.params.id)
  const counselorId = Number(assignForm.counselorId)
  if (!counselorId || counselorId <= 0) {
    ElMessage.warning('请输入有效的咨询师ID')
    return
  }
  actionLoading.value = true
  try {
    await assignCase(id, { counselorId })
    ElMessage.success('分配成功')
    await loadDetail()
  } catch {
    ElMessage.error('分配失败')
  } finally {
    actionLoading.value = false
  }
}

const handleAddIntervention = async () => {
  const id = Number(route.params.id)
  if (!interventionForm.content.trim()) {
    ElMessage.warning('请输入干预内容')
    return
  }
  actionLoading.value = true
  try {
    await addIntervention(id, {
      interventionType: interventionForm.type,
      content: interventionForm.content,
    })
    ElMessage.success('干预记录已添加')
    interventionForm.content = ''
    await loadDetail()
  } catch {
    ElMessage.error('添加干预失败')
  } finally {
    actionLoading.value = false
  }
}

const handleRefer = async () => {
  const id = Number(route.params.id)
  if (!referForm.target.trim() || !referForm.reason.trim()) {
    ElMessage.warning('请填写转介目标和原因')
    return
  }
  try {
    await ElMessageBox.confirm('确定转介该个案？', '确认转介', { type: 'warning' })
  } catch {
    return
  }
  actionLoading.value = true
  try {
    await referCase(id, { target: referForm.target, reason: referForm.reason })
    ElMessage.success('转介成功')
    await loadDetail()
  } catch {
    ElMessage.error('转介失败')
  } finally {
    actionLoading.value = false
  }
}

const handleClose = async () => {
  const id = Number(route.params.id)
  if (!closeForm.summary.trim()) {
    ElMessage.warning('请填写结案摘要')
    return
  }
  try {
    await ElMessageBox.confirm('确定结案？结案后不可修改。', '确认结案', { type: 'warning' })
  } catch {
    return
  }
  actionLoading.value = true
  try {
    await closeCase(id, { summary: closeForm.summary })
    ElMessage.success('结案成功')
    await loadDetail()
  } catch {
    ElMessage.error('结案失败')
  } finally {
    actionLoading.value = false
  }
}

onMounted(() => {
  loadDetail()
})
</script>

<style scoped lang="scss">
@use '@/assets/styles/theme.scss' as *;

.case-detail-page {
  max-width: 800px;
  margin: 0 auto;
  padding: 20px;
}

.page-header {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 20px;

  h2 {
    margin: 0;
    color: $text-color;
  }
}

.back-btn {
  padding: 6px 12px;
  background: none;
  border: 1px solid $border-color;
  border-radius: 4px;
  color: $primary-color;
  cursor: pointer;
  &:hover {
    background: $bg-warm;
  }
}

.state-block {
  text-align: center;
  padding: 40px;
  color: $text-light-color;
}

.text-muted {
  color: $text-light-color;
}

.info-card,
.actions-card,
.interventions-card {
  background: $white;
  border-radius: 8px;
  padding: 20px;
  margin-bottom: 16px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);

  h3 {
    margin: 0 0 16px;
    color: $text-color;
    font-size: $font-size-lg;
  }
}

.info-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.info-item {
  label {
    display: block;
    font-size: $font-size-sm;
    color: $text-light-color;
    margin-bottom: 4px;
  }
  span {
    color: $text-color;
  }
}

.summary-section {
  margin-top: 16px;
  label {
    display: block;
    font-size: $font-size-sm;
    color: $text-light-color;
    margin-bottom: 4px;
  }
  p {
    margin: 0;
    color: $text-color;
    line-height: 1.6;
  }
}

.status-tag,
.risk-tag {
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

.action-row {
  margin-bottom: 16px;
  padding-bottom: 16px;
  border-bottom: 1px solid $border-color;

  &:last-child {
    border-bottom: none;
    margin-bottom: 0;
    padding-bottom: 0;
  }

  label {
    display: block;
    font-size: $font-size-md;
    color: $text-color;
    margin-bottom: 8px;
  }
}

.action-input,
.action-select,
.action-textarea {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid $border-color;
  border-radius: 4px;
  font-size: $font-size-md;
  margin-bottom: 8px;
  box-sizing: border-box;

  &:focus {
    outline: 3px solid var(--focus);
    outline-offset: 2px;
    border-color: $primary-color;
  }
}

.action-textarea {
  resize: vertical;
  font-family: inherit;
}

.action-btn {
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  color: $white;
  cursor: pointer;
  font-size: $font-size-md;

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  &.primary {
    background-color: $primary-color;
  }
  &.warning {
    background-color: $warning-color;
    color: $text-color;
  }
  &.success {
    background-color: $success-color;
  }
}

.intervention-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.intervention-item {
  padding: 12px;
  border: 1px solid $border-color;
  border-radius: 6px;
}

.intervention-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.intervention-type-tag {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: $font-size-sm;
  font-weight: 500;
}

.itype-note {
  background-color: #e8f5e9;
  color: #2e7d32;
}
.itype-interview {
  background-color: #e3f2fd;
  color: #1565c0;
}
.itype-referral {
  background-color: #f3e5f5;
  color: #7b1fa2;
}
.itype-closure {
  background-color: #eceff1;
  color: #546e7a;
}

.intervention-time {
  font-size: $font-size-sm;
  color: $text-light-color;
}

.intervention-content {
  margin: 0;
  color: $text-color;
  line-height: 1.6;
}

.intervention-meta {
  font-size: $font-size-sm;
  color: $text-light-color;
  margin-top: 4px;
}
</style>
