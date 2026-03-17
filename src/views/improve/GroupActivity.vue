<template>
  <div class="group-activity-page">
    <section class="hero-panel card-surface">
      <div class="hero-copy">
        <span class="eyebrow">团体辅导</span>
        <h1>和一群愿意认真生活的人，一起慢慢变好。</h1>
        <p>
          从正在进行的支持小组，到即将开始的成长活动，这里会把可以参与的团体辅导整齐地放到你面前。
        </p>
        <div class="hero-actions">
          <el-button
            v-if="isAdmin"
            type="primary"
            size="large"
            class="primary-cta"
            @click="openCreateDialog"
          >
            <el-icon><Plus /></el-icon>
            创建活动
          </el-button>
          <el-button v-else size="large" plain class="secondary-cta" @click="switchToUpcoming">
            <el-icon><Calendar /></el-icon>
            看看即将开始的活动
          </el-button>
          <el-button
            v-if="isLoggedIn && !isAdmin"
            text
            class="secondary-link"
            @click="scrollToJoined"
          >
            查看我的参与记录
          </el-button>
        </div>
      </div>

      <div class="hero-aside">
        <div class="hero-illustration">
          <div class="halo halo-a"></div>
          <div class="halo halo-b"></div>
          <div class="bubble bubble-a"></div>
          <div class="bubble bubble-b"></div>
          <div class="hero-card">
            <span class="hero-card-label">本页速览</span>
            <strong>{{ pagination.total }}</strong>
            <span>场可浏览活动</span>
          </div>
        </div>

        <div class="summary-grid">
          <article v-for="item in summaryCards" :key="item.key" class="summary-card">
            <span class="summary-label">{{ item.label }}</span>
            <strong>{{ item.value }}</strong>
            <span class="summary-hint">{{ item.hint }}</span>
          </article>
        </div>
      </div>
    </section>

    <section class="filter-panel card-surface">
      <div class="filter-head">
        <div>
          <h2>活动列表</h2>
          <p>用顶部状态切换不同节奏的活动，快速找到现在适合参与的场次。</p>
        </div>
        <el-button circle text class="refresh-btn" @click="refreshCurrentPage">
          <el-icon><Refresh /></el-icon>
        </el-button>
      </div>

      <el-tabs v-model="activeStatusTab" class="status-tabs" @tab-change="handleStatusChange">
        <el-tab-pane v-for="tab in statusTabs" :key="tab.name" :name="tab.name">
          <template #label>
            <span class="tab-label">
              <span>{{ tab.label }}</span>
              <em>{{ tab.count }}</em>
            </span>
          </template>
        </el-tab-pane>
      </el-tabs>
    </section>

    <section class="content-panel">
      <transition name="fade-slide" mode="out-in">
        <div v-if="loading" key="loading" class="activity-grid skeleton-grid">
          <div v-for="item in 6" :key="item" class="activity-skeleton card-surface">
            <el-skeleton animated>
              <template #template>
                <el-skeleton-item variant="image" style="width: 100%; height: 180px" />
                <div class="skeleton-body">
                  <el-skeleton-item variant="h3" style="width: 70%" />
                  <el-skeleton-item variant="text" style="width: 90%" />
                  <el-skeleton-item variant="text" style="width: 80%" />
                  <div class="skeleton-tags">
                    <el-skeleton-item variant="button" style="width: 90px; height: 32px" />
                    <el-skeleton-item variant="button" style="width: 110px; height: 32px" />
                  </div>
                </div>
              </template>
            </el-skeleton>
          </div>
        </div>

        <div v-else-if="loadError" key="error" class="state-shell">
          <div class="empty-card card-surface empty-card-error">
            <div class="empty-visual error-visual">
              <span class="empty-icon">☁</span>
            </div>
            <h3>活动列表暂时没有顺利抵达</h3>
            <p>{{ loadError }}</p>
            <div class="empty-actions">
              <el-button type="primary" class="primary-cta" @click="loadActivities"
                >重新加载</el-button
              >
              <el-button plain @click="handleReset">回到全部活动</el-button>
            </div>
          </div>
        </div>

        <div v-else-if="activities.length === 0" key="empty" class="state-shell">
          <div class="empty-card card-surface">
            <div class="empty-visual">
              <span class="empty-icon">🌷</span>
              <div class="empty-ring ring-a"></div>
              <div class="empty-ring ring-b"></div>
            </div>
            <h3>{{ emptyStateTitle }}</h3>
            <p>{{ emptyStateDescription }}</p>
            <div class="empty-actions">
              <el-button
                v-if="isAdmin"
                type="primary"
                class="primary-cta"
                @click="openCreateDialog"
              >
                创建第一场活动
              </el-button>
              <el-button v-else plain @click="switchToUpcoming">去看看即将开始的场次</el-button>
              <el-button text @click="handleReset">查看全部活动</el-button>
            </div>
          </div>
        </div>

        <div v-else key="content" class="activity-section">
          <div class="activity-grid">
            <article
              v-for="activity in activities"
              :key="activity.id"
              class="activity-card card-surface"
            >
              <div class="card-cover" :style="getCoverStyle(activity)">
                <span class="cover-pill">{{ formatStatusLabel(activity).label }}</span>
                <span class="cover-time">{{ formatDateTime(activity.startTime, 'short') }}</span>
              </div>

              <div class="card-body">
                <div class="card-heading-row">
                  <h3>{{ activity.title }}</h3>
                  <el-tag :type="formatStatusLabel(activity).type" effect="light" round>
                    {{ formatStatusLabel(activity).label }}
                  </el-tag>
                </div>

                <p class="card-description">
                  {{ activity.description || '这场活动正在等待更多愿意认真聆听和表达的人加入。' }}
                </p>

                <ul class="meta-list">
                  <li>
                    <el-icon><Calendar /></el-icon>
                    <span
                      >{{ formatDateTime(activity.startTime) }} -
                      {{ formatTimeOnly(activity.endTime) }}</span
                    >
                  </li>
                  <li>
                    <el-icon><Location /></el-icon>
                    <span>{{ activity.location }}</span>
                  </li>
                  <li>
                    <el-icon><User /></el-icon>
                    <span
                      >{{ activity.currentParticipants }} / {{ activity.maxParticipants }} 人</span
                    >
                  </li>
                </ul>

                <div class="progress-row">
                  <span>报名进度</span>
                  <span>{{ getParticipationPercent(activity) }}%</span>
                </div>
                <el-progress
                  :percentage="getParticipationPercent(activity)"
                  :stroke-width="8"
                  :show-text="false"
                  :color="getProgressColor(activity)"
                />

                <div class="card-actions">
                  <el-button plain @click="goToDetail(activity.id)">查看详情</el-button>

                  <template v-if="isAdmin">
                    <el-button type="primary" plain @click="editActivity(activity)">编辑</el-button>
                    <el-button type="danger" plain @click="confirmDelete(activity)">删除</el-button>
                  </template>

                  <template v-else>
                    <el-button v-if="!isLoggedIn" type="primary" @click="goToLogin">
                      登录后报名
                    </el-button>
                    <el-button v-else-if="isJoined(activity.id)" type="success" disabled>
                      已报名
                    </el-button>
                    <el-button v-else-if="isJoinDisabled(activity)" plain disabled>
                      {{ getJoinDisabledText(activity) }}
                    </el-button>
                    <el-button
                      v-else
                      type="primary"
                      :loading="joiningActivityId === activity.id"
                      @click="handleJoin(activity.id)"
                    >
                      立即报名
                    </el-button>
                  </template>
                </div>
              </div>
            </article>
          </div>

          <div class="pagination-wrap card-surface">
            <div class="pagination-copy">
              <span>共 {{ pagination.total }} 场活动</span>
              <p>可以切换顶部状态继续查看不同阶段的团体辅导。</p>
            </div>
            <el-pagination
              background
              layout="prev, pager, next"
              :current-page="pagination.page"
              :page-size="pagination.limit"
              :total="pagination.total"
              @current-change="handlePageChange"
            />
          </div>
        </div>
      </transition>
    </section>

    <section v-if="isLoggedIn && !isAdmin" ref="joinedSectionRef" class="joined-panel card-surface">
      <div class="joined-head">
        <div>
          <h2>我的活动记录</h2>
          <p>把已经参加过或已经报名的活动收在这里，回看时会更有成长感。</p>
        </div>
        <el-tag effect="plain" round>{{ myJoinedActivities.length }} 场</el-tag>
      </div>

      <div v-if="joinedLoading" class="joined-loading">
        <el-skeleton :rows="3" animated />
      </div>

      <div v-else-if="joinedError" class="joined-empty joined-empty-error">
        <span>暂时没能取回你的报名记录</span>
        <el-button text @click="loadMyJoinedActivities">重试</el-button>
      </div>

      <div v-else-if="myJoinedActivities.length === 0" class="joined-empty">
        <span>你还没有参加任何活动，挑一场温和开始也很好。</span>
      </div>

      <div v-else class="joined-list">
        <article v-for="activity in myJoinedActivities" :key="activity.id" class="joined-item">
          <div>
            <h3>{{ activity.title }}</h3>
            <p>{{ formatDateTime(activity.startTime) }} · {{ activity.location }}</p>
          </div>
          <el-tag :type="formatStatusLabel(activity).type" effect="light" round>
            {{ formatStatusLabel(activity).label }}
          </el-tag>
        </article>
      </div>
    </section>

    <el-dialog
      v-model="showModal"
      :title="isEditing ? '编辑活动' : '创建活动'"
      width="680px"
      class="activity-dialog"
      destroy-on-close
    >
      <div class="dialog-intro">
        <h3>
          {{ isEditing ? '调整这场活动的信息' : '发起一场更有陪伴感的活动' }}
        </h3>
        <p>把时间、人数和地点说明清楚，用户会更愿意安心报名。</p>
      </div>

      <el-form
        ref="formRef"
        :model="activityForm"
        :rules="formRules"
        label-position="top"
        class="activity-form"
      >
        <el-form-item label="活动标题" prop="title">
          <el-input
            v-model="activityForm.title"
            placeholder="例如：考试减压支持小组"
            maxlength="100"
            show-word-limit
          />
        </el-form-item>

        <el-form-item label="活动描述" prop="description">
          <el-input
            v-model="activityForm.description"
            type="textarea"
            :rows="4"
            placeholder="告诉参与者这场活动会经历什么、适合谁来参加。"
            maxlength="500"
            show-word-limit
          />
        </el-form-item>

        <div class="form-grid">
          <el-form-item label="开始时间" prop="startTime">
            <el-date-picker
              v-model="activityForm.startTime"
              type="datetime"
              value-format="YYYY-MM-DDTHH:mm:ss"
              placeholder="选择开始时间"
              style="width: 100%"
            />
          </el-form-item>

          <el-form-item label="结束时间" prop="endTime">
            <el-date-picker
              v-model="activityForm.endTime"
              type="datetime"
              value-format="YYYY-MM-DDTHH:mm:ss"
              placeholder="选择结束时间"
              style="width: 100%"
            />
          </el-form-item>

          <el-form-item label="最大名额" prop="maxParticipants">
            <el-input-number
              v-model="activityForm.maxParticipants"
              :min="1"
              :max="300"
              style="width: 100%"
            />
          </el-form-item>

          <el-form-item label="活动地点" prop="location">
            <el-select
              v-model="activityForm.location"
              placeholder="选择活动地点"
              style="width: 100%"
            >
              <el-option v-for="loc in locationOptions" :key="loc" :label="loc" :value="loc" />
            </el-select>
          </el-form-item>
        </div>

        <el-form-item label="图片链接">
          <el-input v-model="activityForm.imageUrl" placeholder="可选，用来增强活动卡片的辨识度" />
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="closeModal">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="submitActivity">
          {{ submitting ? '保存中...' : isEditing ? '保存修改' : '发布活动' }}
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { Calendar, Location, Plus, Refresh, User } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
import { useUserStore } from '@/stores/userStore'
import type {
  Activity,
  ActivityFilter,
  ActivityStatus,
  CreateActivityData,
  PaginationInfo,
} from '@/types/activity'
import {
  createActivity,
  deleteActivity,
  getActivities,
  getMyJoinedActivities,
  joinActivity,
  updateActivity,
} from '@/api/activityApi'
import { getActivityStatus } from '@/utils/activityStatus'

type StatusTabKey = 'all' | ActivityStatus

const router = useRouter()
const userStore = useUserStore()

const isAdmin = computed(() => userStore.isAdmin)
const isLoggedIn = computed(() => userStore.isLoggedIn)

const activities = ref<Activity[]>([])
const myJoinedActivities = ref<Activity[]>([])
const loading = ref(false)
const loadError = ref('')
const joinedLoading = ref(false)
const joinedError = ref('')
const submitting = ref(false)
const joiningActivityId = ref<number | null>(null)

const joinedSectionRef = ref<HTMLElement | null>(null)
const showModal = ref(false)
const isEditing = ref(false)
const editingActivityId = ref<number | null>(null)
const formRef = ref<FormInstance>()

const activeStatusTab = ref<StatusTabKey>('all')
const filter = ref<ActivityFilter>({})
const locationOptions = ['心理咨询中心', '团体辅导室', '线上活动']

const pagination = reactive<PaginationInfo>({
  page: 1,
  limit: 9,
  total: 0,
  totalPages: 0,
})

const activityForm = reactive<CreateActivityData>({
  title: '',
  description: '',
  startTime: '',
  endTime: '',
  maxParticipants: 20,
  location: '',
  imageUrl: '',
})

const formRules: FormRules<CreateActivityData> = {
  title: [{ required: true, message: '请输入活动标题', trigger: 'blur' }],
  description: [{ required: true, message: '请输入活动描述', trigger: 'blur' }],
  startTime: [{ required: true, message: '请选择开始时间', trigger: 'change' }],
  endTime: [{ required: true, message: '请选择结束时间', trigger: 'change' }],
  maxParticipants: [{ required: true, message: '请输入最大名额', trigger: 'change' }],
  location: [{ required: true, message: '请选择活动地点', trigger: 'change' }],
}

const summaryCards = computed(() => {
  const grouped = {
    ongoing: 0,
    upcoming: 0,
    ended: 0,
  }

  activities.value.forEach((activity) => {
    const status = getActivityStatus(activity).status
    if (status === 'ongoing') grouped.ongoing += 1
    if (status === 'upcoming') grouped.upcoming += 1
    if (status === 'ended') grouped.ended += 1
  })

  return [
    {
      key: 'ongoing',
      label: '进行中',
      value: grouped.ongoing,
      hint: '适合立刻加入',
    },
    {
      key: 'upcoming',
      label: '即将开始',
      value: grouped.upcoming,
      hint: '可以提前预留时间',
    },
    {
      key: 'joined',
      label: '我的报名',
      value: myJoinedActivities.value.length,
      hint: '你的陪伴轨迹',
    },
  ]
})

const statusTabs = computed(() => {
  const counts = {
    all: pagination.total,
    ongoing: 0,
    upcoming: 0,
    ended: 0,
    full: 0,
  }

  activities.value.forEach((activity) => {
    counts[getActivityStatus(activity).status] += 1
  })

  return [
    { name: 'all', label: '全部活动', count: counts.all },
    { name: 'ongoing', label: '进行中', count: counts.ongoing },
    { name: 'upcoming', label: '即将开始', count: counts.upcoming },
    { name: 'ended', label: '已结束', count: counts.ended },
    { name: 'full', label: '已满', count: counts.full },
  ] as Array<{ name: StatusTabKey; label: string; count: number }>
})

const emptyStateTitle = computed(() => {
  if (activeStatusTab.value === 'all') {
    return isAdmin.value
      ? '还没有团体辅导活动，先发起一场温柔的相遇吧'
      : '这里暂时还没有活动，稍后再来看看也没关系'
  }

  return `当前没有“${statusTabs.value.find((item) => item.name === activeStatusTab.value)?.label}”活动`
})

const emptyStateDescription = computed(() => {
  if (isAdmin.value) {
    return '把主题、时间和地点整理出来，用户会更清楚这场活动适不适合自己。'
  }

  return '你可以切换顶部状态看看别的阶段，或者稍后回来，新的支持活动会慢慢出现。'
})

const openCreateDialog = () => {
  resetForm()
  isEditing.value = false
  showModal.value = true
}

const switchToUpcoming = () => {
  activeStatusTab.value = 'upcoming'
  handleStatusChange()
}

const scrollToJoined = async () => {
  await nextTick()
  joinedSectionRef.value?.scrollIntoView({
    behavior: 'smooth',
    block: 'start',
  })
}

const goToDetail = (id: number) => {
  router.push(`/improve/group/${id}`)
}

const goToLogin = () => {
  router.push('/login')
}

const getFilterPayload = (): ActivityFilter => {
  if (activeStatusTab.value === 'all') {
    return { ...filter.value, status: undefined }
  }

  return {
    ...filter.value,
    status: [activeStatusTab.value],
  }
}

const loadActivities = async () => {
  loading.value = true
  loadError.value = ''

  try {
    const response = await getActivities(pagination.page, pagination.limit, getFilterPayload())
    activities.value = response.data
    pagination.total = response.pagination.total
    pagination.totalPages = response.pagination.totalPages
  } catch (error) {
    console.error('加载活动列表失败', error)
    activities.value = []
    pagination.total = 0
    pagination.totalPages = 0
    loadError.value = '活动列表暂时不可用，请稍后重试。'
  } finally {
    loading.value = false
  }
}

const loadMyJoinedActivities = async () => {
  if (!isLoggedIn.value || isAdmin.value) {
    myJoinedActivities.value = []
    return
  }

  joinedLoading.value = true
  joinedError.value = ''

  try {
    myJoinedActivities.value = await getMyJoinedActivities()
  } catch (error) {
    console.error('加载我的活动记录失败', error)
    myJoinedActivities.value = []
    joinedError.value = '报名记录暂时加载失败'
  } finally {
    joinedLoading.value = false
  }
}

const refreshCurrentPage = async () => {
  await Promise.allSettled([loadActivities(), loadMyJoinedActivities()])
  if (!loadError.value) {
    ElMessage.success('已刷新活动列表')
  }
}

const handleStatusChange = async () => {
  pagination.page = 1
  await loadActivities()
}

const handleReset = async () => {
  activeStatusTab.value = 'all'
  filter.value = {}
  pagination.page = 1
  await loadActivities()
}

const handlePageChange = async (page: number) => {
  pagination.page = page
  await loadActivities()
}

const editActivity = (activity: Activity) => {
  isEditing.value = true
  editingActivityId.value = activity.id
  Object.assign(activityForm, {
    title: activity.title,
    description: activity.description,
    startTime: normalizeDateTime(activity.startTime),
    endTime: normalizeDateTime(activity.endTime),
    maxParticipants: activity.maxParticipants,
    location: activity.location,
    imageUrl: activity.imageUrl || '',
  })
  showModal.value = true
}

const confirmDelete = async (activity: Activity) => {
  try {
    await ElMessageBox.confirm(`确定删除“${activity.title}”吗？删除后无法恢复。`, '删除活动', {
      confirmButtonText: '确认删除',
      cancelButtonText: '取消',
      type: 'warning',
      confirmButtonClass: 'el-button--danger',
    })

    submitting.value = true
    await deleteActivity(activity.id)
    ElMessage.success('活动已删除')
    await loadActivities()
  } catch (error) {
    if (error !== 'cancel') {
      console.error('删除活动失败', error)
      ElMessage.error('删除失败，请稍后重试')
    }
  } finally {
    submitting.value = false
  }
}

const submitActivity = async () => {
  if (!formRef.value) {
    return
  }

  try {
    const valid = await formRef.value.validate()
    if (!valid) {
      return
    }

    submitting.value = true
    if (isEditing.value && editingActivityId.value) {
      await updateActivity(editingActivityId.value, { ...activityForm })
      ElMessage.success('活动更新成功')
    } else {
      await createActivity({ ...activityForm })
      ElMessage.success('活动创建成功')
    }

    closeModal()
    await loadActivities()
  } catch (error) {
    console.error('提交活动失败', error)
    ElMessage.error(isEditing.value ? '更新失败，请稍后重试' : '创建失败，请稍后重试')
  } finally {
    submitting.value = false
  }
}

const closeModal = () => {
  showModal.value = false
  resetForm()
}

const resetForm = () => {
  isEditing.value = false
  editingActivityId.value = null
  Object.assign(activityForm, {
    title: '',
    description: '',
    startTime: '',
    endTime: '',
    maxParticipants: 20,
    location: '',
    imageUrl: '',
  })
  nextTick(() => formRef.value?.clearValidate())
}

const isJoined = (activityId: number) =>
  myJoinedActivities.value.some((activity) => activity.id === activityId)

const isJoinDisabled = (activity: Activity) => {
  const status = getActivityStatus(activity).status
  return status === 'full' || status === 'ended'
}

const getJoinDisabledText = (activity: Activity) => {
  const status = getActivityStatus(activity).status
  if (status === 'full') {
    return '名额已满'
  }
  if (status === 'ended') {
    return '活动已结束'
  }
  return '暂不可报名'
}

const handleJoin = async (activityId: number) => {
  joiningActivityId.value = activityId
  try {
    await joinActivity(activityId)
    ElMessage.success('报名成功，记得准时来参与')
    await Promise.allSettled([loadActivities(), loadMyJoinedActivities()])
  } catch (error) {
    console.error('报名活动失败', error)
    ElMessage.error('报名失败，请稍后重试')
  } finally {
    joiningActivityId.value = null
  }
}

const formatStatusLabel = (activity: Activity) => getActivityStatus(activity).config

const getParticipationPercent = (activity: Activity) =>
  Math.min(
    100,
    Math.round((activity.currentParticipants / Math.max(activity.maxParticipants, 1)) * 100)
  )

const getProgressColor = (activity: Activity) => {
  const status = getActivityStatus(activity).status
  if (status === 'full') return '#f08ba8'
  if (status === 'ongoing') return '#9a8cf2'
  if (status === 'upcoming') return '#f5b7d2'
  return '#c7c6db'
}

const getCoverStyle = (activity: Activity) => {
  if (activity.imageUrl) {
    return {
      backgroundImage: `linear-gradient(180deg, rgba(87, 65, 126, 0.08), rgba(87, 65, 126, 0.48)), url(${activity.imageUrl})`,
    }
  }

  return {
    backgroundImage:
      'linear-gradient(135deg, rgba(250, 223, 233, 0.95), rgba(216, 210, 248, 0.98))',
  }
}

const formatDateTime = (dateStr: string, mode: 'full' | 'short' = 'full') => {
  const date = new Date(dateStr)
  if (Number.isNaN(date.getTime())) {
    return dateStr
  }

  return date.toLocaleString('zh-CN', {
    month: mode === 'short' ? 'numeric' : 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const formatTimeOnly = (dateStr: string) => {
  const date = new Date(dateStr)
  if (Number.isNaN(date.getTime())) {
    return dateStr
  }
  return date.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

const normalizeDateTime = (value: string) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }

  const pad = (input: number) => String(input).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

watch(
  () => isLoggedIn.value,
  (loggedIn) => {
    if (loggedIn && !isAdmin.value) {
      loadMyJoinedActivities()
    }
  }
)

onMounted(async () => {
  await Promise.allSettled([loadActivities(), loadMyJoinedActivities()])
})
</script>

<style scoped lang="scss">
.group-activity-page {
  min-height: 100vh;
  padding: 28px;
  background:
    radial-gradient(circle at top left, rgba(253, 224, 234, 0.88), transparent 26%),
    radial-gradient(circle at top right, rgba(229, 224, 255, 0.72), transparent 24%),
    linear-gradient(180deg, #fbf8ff 0%, #fff8fb 55%, #fcfbff 100%);
}

.card-surface {
  background: rgba(255, 255, 255, 0.88);
  border: 1px solid rgba(232, 221, 246, 0.78);
  border-radius: 28px;
  box-shadow: 0 18px 40px rgba(187, 171, 224, 0.18);
  backdrop-filter: blur(14px);
}

.hero-panel {
  display: grid;
  grid-template-columns: minmax(0, 1.3fr) minmax(320px, 0.9fr);
  gap: 28px;
  padding: 30px;
  margin-bottom: 24px;
}

.hero-copy h1 {
  margin: 12px 0 14px;
  font-size: 2.2rem;
  line-height: 1.2;
  color: #51406f;
}

.hero-copy p {
  max-width: 700px;
  margin: 0;
  color: #7f738f;
  line-height: 1.8;
}

.eyebrow {
  display: inline-flex;
  padding: 8px 14px;
  border-radius: 999px;
  background: rgba(249, 214, 228, 0.8);
  color: #94627c;
  font-size: 0.85rem;
  letter-spacing: 0.08em;
}

.hero-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 24px;
}

.primary-cta {
  border: none;
  background: linear-gradient(135deg, #f3a4c1, #b69df4);
  box-shadow: 0 14px 24px rgba(222, 165, 201, 0.32);
}

.secondary-cta,
.secondary-link {
  color: #7f67a9;
}

.hero-aside {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.hero-illustration {
  position: relative;
  min-height: 200px;
  overflow: hidden;
  border-radius: 24px;
  background: linear-gradient(140deg, rgba(248, 216, 229, 0.9), rgba(219, 213, 252, 0.95));
}

.halo,
.bubble,
.empty-ring {
  position: absolute;
  border-radius: 999px;
}

.halo-a {
  width: 180px;
  height: 180px;
  left: -32px;
  top: 18px;
  background: rgba(255, 255, 255, 0.34);
}

.halo-b {
  width: 220px;
  height: 220px;
  right: -70px;
  bottom: -80px;
  background: rgba(255, 255, 255, 0.24);
}

.bubble-a {
  width: 14px;
  height: 14px;
  right: 60px;
  top: 32px;
  background: rgba(255, 255, 255, 0.8);
}

.bubble-b {
  width: 18px;
  height: 18px;
  left: 45%;
  top: 56px;
  background: rgba(255, 255, 255, 0.65);
}

.hero-card {
  position: absolute;
  left: 28px;
  bottom: 24px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 18px 20px;
  border-radius: 22px;
  background: rgba(255, 255, 255, 0.72);
  color: #655580;
}

.hero-card strong {
  font-size: 2rem;
  color: #4f4170;
}

.hero-card-label,
.summary-label,
.summary-hint,
.pagination-copy p,
.joined-head p,
.dialog-intro p,
.filter-head p {
  color: #857a98;
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 14px;
}

.summary-card {
  padding: 16px;
  border-radius: 22px;
  background: rgba(255, 255, 255, 0.78);
}

.summary-card strong {
  display: block;
  margin: 8px 0 4px;
  font-size: 1.5rem;
  color: #5c4d79;
}

.filter-panel {
  padding: 22px 24px 10px;
  margin-bottom: 24px;
}

.filter-head {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: flex-start;
}

.filter-head h2,
.joined-head h2 {
  margin: 0 0 6px;
  color: #4f416d;
}

.refresh-btn {
  width: 42px;
  height: 42px;
  border-radius: 50%;
  background: rgba(243, 237, 252, 0.88);
}

.status-tabs :deep(.el-tabs__nav-wrap::after) {
  background-color: rgba(231, 222, 244, 0.8);
}

.status-tabs :deep(.el-tabs__item) {
  height: 56px;
  font-size: 0.96rem;
}

.status-tabs :deep(.el-tabs__active-bar) {
  background: linear-gradient(90deg, #f2a5c3, #ad96f0);
  height: 3px;
  border-radius: 999px;
}

.tab-label {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.tab-label em {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 24px;
  height: 24px;
  padding: 0 8px;
  border-radius: 999px;
  background: rgba(242, 236, 251, 0.95);
  color: #8263a5;
  font-style: normal;
  font-size: 0.8rem;
}

.content-panel,
.joined-panel {
  margin-bottom: 24px;
}

.activity-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: 20px;
}

.activity-card {
  overflow: hidden;
  transition:
    transform 0.24s ease,
    box-shadow 0.24s ease;
}

.activity-card:hover {
  transform: translateY(-6px);
  box-shadow: 0 24px 42px rgba(184, 170, 220, 0.26);
}

.card-cover {
  position: relative;
  min-height: 180px;
  padding: 18px;
  background-size: cover;
  background-position: center;
}

.cover-pill,
.cover-time {
  display: inline-flex;
  padding: 7px 12px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.85);
  color: #694f8e;
  font-size: 0.85rem;
}

.cover-time {
  position: absolute;
  left: 18px;
  bottom: 18px;
}

.card-body {
  padding: 20px;
}

.card-heading-row {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  justify-content: space-between;
}

.card-heading-row h3 {
  margin: 0;
  color: #51416d;
  font-size: 1.1rem;
}

.card-description {
  min-height: 52px;
  margin: 14px 0;
  color: #7a6f89;
  line-height: 1.7;
}

.meta-list {
  display: grid;
  gap: 10px;
  margin: 0 0 16px;
  padding: 0;
  list-style: none;
}

.meta-list li,
.progress-row,
.joined-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.meta-list li {
  justify-content: flex-start;
  color: #706482;
}

.meta-list .el-icon {
  color: #9e89c0;
}

.progress-row {
  margin-bottom: 10px;
  color: #806f99;
  font-size: 0.9rem;
}

.card-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 18px;
}

.pagination-wrap {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 18px 22px;
  margin-top: 20px;
}

.pagination-copy span,
.dialog-intro h3,
.empty-card h3 {
  color: #54456f;
}

.state-shell {
  display: flex;
  justify-content: center;
}

.empty-card {
  width: min(100%, 720px);
  padding: 36px 24px;
  text-align: center;
}

.empty-card p {
  max-width: 520px;
  margin: 0 auto;
  color: #827792;
  line-height: 1.8;
}

.empty-visual {
  position: relative;
  width: 148px;
  height: 148px;
  margin: 0 auto 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: linear-gradient(135deg, rgba(249, 219, 231, 0.9), rgba(224, 216, 252, 0.95));
}

.empty-icon {
  position: relative;
  z-index: 2;
  font-size: 3rem;
}

.ring-a {
  width: 128px;
  height: 128px;
  border: 1px solid rgba(255, 255, 255, 0.7);
}

.ring-b {
  width: 164px;
  height: 164px;
  border: 1px solid rgba(224, 206, 244, 0.7);
}

.error-visual {
  background: linear-gradient(135deg, rgba(248, 222, 231, 0.95), rgba(233, 224, 247, 0.95));
}

.empty-actions {
  display: flex;
  justify-content: center;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 24px;
}

.joined-panel {
  padding: 24px;
}

.joined-head {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: center;
  margin-bottom: 18px;
}

.joined-list {
  display: grid;
  gap: 12px;
}

.joined-item {
  padding: 16px 18px;
  border-radius: 18px;
  background: rgba(252, 248, 255, 0.94);
  border: 1px solid rgba(233, 224, 246, 0.84);
}

.joined-item h3 {
  margin: 0 0 6px;
  color: #54456f;
  font-size: 1rem;
}

.joined-item p,
.joined-empty {
  margin: 0;
  color: #867a99;
}

.joined-empty {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 18px 0 4px;
}

.joined-empty-error {
  color: #be728f;
}

.dialog-intro {
  margin-bottom: 18px;
}

.dialog-intro h3 {
  margin: 0 0 6px;
}

.activity-form :deep(.el-form-item__label) {
  color: #6d5d87;
  font-weight: 600;
}

.form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

.skeleton-grid {
  align-items: stretch;
}

.activity-skeleton {
  overflow: hidden;
}

.skeleton-body {
  padding: 18px;
}

.skeleton-tags {
  display: flex;
  gap: 12px;
  margin-top: 18px;
}

.fade-slide-enter-active,
.fade-slide-leave-active {
  transition: all 0.24s ease;
}

.fade-slide-enter-from,
.fade-slide-leave-to {
  opacity: 0;
  transform: translateY(10px);
}

@media (max-width: 1024px) {
  .hero-panel {
    grid-template-columns: 1fr;
  }

  .summary-grid,
  .form-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 768px) {
  .group-activity-page {
    padding: 16px;
  }

  .hero-panel,
  .filter-panel,
  .joined-panel {
    padding: 20px;
  }

  .hero-copy h1 {
    font-size: 1.7rem;
  }

  .filter-head,
  .joined-head,
  .pagination-wrap {
    flex-direction: column;
    align-items: stretch;
  }

  .activity-grid {
    grid-template-columns: 1fr;
  }

  .card-heading-row,
  .card-actions {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
