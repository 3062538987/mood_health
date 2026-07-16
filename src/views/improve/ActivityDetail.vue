<template>
  <div class="activity-detail">
    <div class="page-container">
      <!-- 返回按钮 -->
      <div class="back-nav">
        <el-button link @click="$router.back()">
          <el-icon><ArrowLeft /></el-icon>
          返回列表
        </el-button>
      </div>

      <!-- 加载状态 -->
      <div v-if="loading" class="loading-wrapper">
        <el-skeleton :rows="10" animated />
      </div>

      <!-- 错误提示 -->
      <el-empty v-else-if="error" description="加载失败，请稍后重试" :image-size="200">
        <el-button type="primary" @click="loadActivityDetail">重新加载</el-button>
      </el-empty>

      <!-- 活动详情内容 -->
      <template v-else-if="activity">
        <div class="detail-layout">
          <!-- 左侧：活动信息 -->
          <div class="main-content">
            <el-card class="activity-info-card" shadow="hover">
              <!-- 活动图片 -->
              <div class="activity-image-wrapper">
                <img
                  v-if="activity.imageUrl"
                  :src="activity.imageUrl"
                  class="activity-image"
                  alt="活动图片"
                />
                <div v-else class="activity-image-placeholder">
                  <el-icon :size="64"><Picture /></el-icon>
                  <span>暂无图片</span>
                </div>
                <el-tag :type="statusConfig.type" effect="dark" class="status-tag" size="large">
                  {{ statusConfig.label }}
                </el-tag>
              </div>

              <!-- 活动标题 -->
              <div class="activity-header">
                <h1 class="activity-title">{{ activity.title }}</h1>
                <div class="activity-meta">
                  <span class="meta-item">
                    <el-icon><Calendar /></el-icon>
                    {{ formatDateTime(activity.startTime) }} -
                    {{ formatTime(activity.endTime) }}
                  </span>
                  <span class="meta-item">
                    <el-icon><Location /></el-icon>
                    {{ activity.location }}
                  </span>
                </div>
              </div>

              <!-- 活动描述 -->
              <div class="activity-description">
                <h3>活动介绍</h3>
                <p>{{ activity.description || '暂无描述' }}</p>
              </div>

              <!-- 报名信息 -->
              <div class="registration-info">
                <div class="info-header">
                  <h3>报名信息</h3>
                  <el-tag :type="isFull ? 'danger' : 'success'" effect="plain">
                    {{ activity.currentParticipants }} / {{ activity.maxParticipants }} 人
                  </el-tag>
                </div>
                <el-progress
                  :percentage="registrationProgress"
                  :status="isFull ? 'exception' : 'success'"
                  :stroke-width="12"
                  :show-text="false"
                />
                <p class="progress-text">
                  已报名 {{ activity.currentParticipants }} 人，剩余名额 {{ remainingSlots }} 人
                </p>
              </div>

              <!-- 操作按钮 -->
              <div class="action-buttons">
                <template v-if="isAdmin">
                  <el-button type="primary" size="large" @click="editActivity">
                    <el-icon><Edit /></el-icon>编辑活动
                  </el-button>
                  <el-button type="danger" size="large" @click="confirmDelete">
                    <el-icon><Delete /></el-icon>删除活动
                  </el-button>
                </template>
                <template v-else>
                  <el-button
                    v-if="!isLoggedIn"
                    type="primary"
                    size="large"
                    @click="$router.push('/login')"
                  >
                    登录后报名
                  </el-button>
                  <template v-else-if="isJoined">
                    <el-button type="success" size="large" plain>
                      <el-icon><Check /></el-icon>已报名
                    </el-button>
                    <el-button
                      type="danger"
                      size="large"
                      plain
                      :loading="cancelling"
                      :disabled="isEnded"
                      @click="handleCancelJoin"
                    >
                      {{ isEnded ? '活动已结束' : '取消报名' }}
                    </el-button>
                  </template>
                  <el-button v-else-if="isFull || isEnded" type="info" size="large" disabled>
                    {{ isFull ? '名额已满' : '活动已结束' }}
                  </el-button>
                  <el-button
                    v-else
                    type="primary"
                    size="large"
                    :loading="joining"
                    @click="handleJoin"
                  >
                    {{ joining ? '报名中...' : '立即报名' }}
                  </el-button>
                </template>
              </div>
            </el-card>
          </div>

          <!-- 右侧：参与者列表 -->
          <div class="sidebar">
            <el-card class="participants-card" shadow="hover">
              <template #header>
                <div class="card-header">
                  <span class="card-title">
                    <el-icon><User /></el-icon>
                    报名人员
                  </span>
                  <el-tag type="info" size="small">{{ participants.length }} 人</el-tag>
                </div>
              </template>

              <div v-if="participants.length > 0" class="participants-list">
                <div
                  v-for="participant in participants"
                  :key="participant.id"
                  class="participant-item"
                >
                  <el-avatar :size="40" :src="participant.avatar" :icon="UserFilled" />
                  <div class="participant-info">
                    <span class="participant-name">
                      {{ participant.nickname || participant.username }}
                    </span>
                    <span class="participant-time">
                      {{ formatDate(participant.joined_at) }} 报名
                    </span>
                  </div>
                </div>
              </div>

              <el-empty v-else description="暂无报名人员" :image-size="100" />
            </el-card>

            <!-- 活动统计 -->
            <el-card class="stats-card" shadow="hover">
              <template #header>
                <div class="card-header">
                  <span class="card-title">
                    <el-icon><DataLine /></el-icon>
                    活动统计
                  </span>
                </div>
              </template>
              <div class="stats-content">
                <div class="stat-item">
                  <span class="stat-label">报名率</span>
                  <span class="stat-value">{{ registrationRate }}%</span>
                </div>
                <div class="stat-item">
                  <span class="stat-label">剩余名额</span>
                  <span class="stat-value" :class="{ 'text-danger': remainingSlots <= 5 }">
                    {{ remainingSlots }}
                  </span>
                </div>
                <div class="stat-item">
                  <span class="stat-label">活动状态</span>
                  <el-tag :type="statusConfig.type" size="small">
                    {{ statusConfig.label }}
                  </el-tag>
                </div>
              </div>
            </el-card>
          </div>
        </div>
      </template>
    </div>

    <!-- 删除确认弹窗 -->
    <el-dialog v-model="showDeleteModal" title="确认删除" width="400px">
      <p>确定要删除这个活动吗？此操作不可恢复。</p>
      <template #footer>
        <el-button @click="showDeleteModal = false">取消</el-button>
        <el-button type="danger" :loading="deleting" @click="deleteActivityConfirm">
          {{ deleting ? '删除中...' : '删除' }}
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import {
  ArrowLeft,
  Picture,
  Calendar,
  Location,
  Edit,
  Delete,
  Check,
  User,
  UserFilled,
  DataLine,
} from '@element-plus/icons-vue'
import { useUserStore } from '@/stores/userStore'
import type { Activity } from '@/types/activity'
import type { Participant } from '@/api/activityApi'
import {
  cancelJoinActivity,
  getActivityDetailWithParticipants,
  joinActivity,
  deleteActivity,
} from '@/api/activityApi'
import { getActivityStatus } from '@/utils/activityStatus'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()

const isAdmin = computed(() => userStore.isAdmin)
const isLoggedIn = computed(() => userStore.isLoggedIn)

// 活动数据
const activity = ref<Activity | null>(null)
const participants = ref<Participant[]>([])
const loading = ref(false)
const error = ref(false)
const joining = ref(false)
const cancelling = ref(false)
const deleting = ref(false)
const showDeleteModal = ref(false)

// 计算属性
const statusConfig = computed(() => {
  if (!activity.value) return { label: '', type: 'info' as const }
  return getActivityStatus(activity.value).config
})

const isFull = computed(() => {
  if (!activity.value) return false
  return activity.value.currentParticipants >= activity.value.maxParticipants
})

const isEnded = computed(() => {
  if (!activity.value) return false
  return new Date(activity.value.endTime).getTime() < Date.now()
})

const isJoined = computed(() => {
  if (!activity.value) return false
  return participants.value.some((p) => p.id === userStore.user?.id)
})

const registrationProgress = computed(() => {
  if (!activity.value) return 0
  return Math.round((activity.value.currentParticipants / activity.value.maxParticipants) * 100)
})

const remainingSlots = computed(() => {
  if (!activity.value) return 0
  return activity.value.maxParticipants - activity.value.currentParticipants
})

const registrationRate = computed(() => {
  if (!activity.value) return 0
  return Math.round((activity.value.currentParticipants / activity.value.maxParticipants) * 100)
})

// 初始化
onMounted(() => {
  loadActivityDetail()
})

// 加载活动详情
const loadActivityDetail = async () => {
  const id = parseInt(route.params.id as string)
  if (isNaN(id)) {
    error.value = true
    return
  }

  loading.value = true
  error.value = false
  try {
    const response = await getActivityDetailWithParticipants(id)
    activity.value = response.activity
    participants.value = response.participants
  } catch {
    error.value = true
  } finally {
    loading.value = false
  }
}

// 报名
const handleJoin = async () => {
  if (!activity.value || joining.value) return

  joining.value = true
  try {
    await joinActivity(activity.value.id)
    ElMessage.success('报名成功！')
    loadActivityDetail()
  } catch {
    // 错误已由拦截器处理
  } finally {
    joining.value = false
  }
}

// 编辑活动
const editActivity = () => {
  if (!activity.value) return
  router.push({
    path: '/improve/group',
    query: {
      edit: String(activity.value.id),
    },
  })
}

const handleCancelJoin = async () => {
  if (!activity.value || cancelling.value) return

  cancelling.value = true
  try {
    await cancelJoinActivity(activity.value.id)
    ElMessage.success('已取消报名')
    await loadActivityDetail()
  } catch {
    // 错误已由拦截器处理
  } finally {
    cancelling.value = false
  }
}

// 确认删除
const confirmDelete = () => {
  showDeleteModal.value = true
}

// 删除活动
const deleteActivityConfirm = async () => {
  if (!activity.value) return
  deleting.value = true
  try {
    await deleteActivity(activity.value.id)
    ElMessage.success('删除成功！')
    router.push('/improve/group')
  } catch {
    // 错误已由拦截器处理
  } finally {
    deleting.value = false
    showDeleteModal.value = false
  }
}

// 格式化日期时间
const formatDateTime = (dateStr: string) => {
  const date = new Date(dateStr)
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// 格式化时间
const formatTime = (dateStr: string) => {
  const date = new Date(dateStr)
  return date.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

// 格式化日期
const formatDate = (dateStr: string) => {
  const date = new Date(dateStr)
  return date.toLocaleDateString('zh-CN', {
    month: 'short',
    day: 'numeric',
  })
}
</script>

<style scoped lang="scss">
.activity-detail {
  min-height: 100vh;
  background: linear-gradient(135deg, #f5f7fa 0%, #e4e7ed 100%);
  padding: 24px;
}

.page-container {
  max-width: 1200px;
  margin: 0 auto;
}

.back-nav {
  margin-bottom: 20px;

  .el-button {
    font-size: 14px;
    color: #606266;

    &:hover {
      color: #409eff;
    }
  }
}

.loading-wrapper {
  padding: 40px;
}

.detail-layout {
  display: grid;
  grid-template-columns: 1fr 360px;
  gap: 24px;
}

// 主内容区
.main-content {
  .activity-info-card {
    border-radius: 16px;
    overflow: hidden;

    :deep(.el-card__body) {
      padding: 0;
    }
  }
}

.activity-image-wrapper {
  position: relative;
  height: 300px;
  overflow: hidden;
  background: #f5f7fa;
}

.activity-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.activity-image-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #909399;
  gap: 12px;

  span {
    font-size: 16px;
  }
}

.status-tag {
  position: absolute;
  top: 20px;
  right: 20px;
  font-weight: 600;
  padding: 6px 16px;
  border-radius: 20px;
  font-size: 14px;
}

.activity-header {
  padding: 24px;
  border-bottom: 1px solid #ebeef5;

  .activity-title {
    margin: 0 0 16px 0;
    font-size: 24px;
    font-weight: 600;
    color: #303133;
    line-height: 1.4;
  }

  .activity-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 16px;

    .meta-item {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 14px;
      color: #606266;

      .el-icon {
        color: #909399;
      }
    }
  }
}

.activity-description {
  padding: 24px;
  border-bottom: 1px solid #ebeef5;

  h3 {
    margin: 0 0 12px 0;
    font-size: 16px;
    font-weight: 600;
    color: #303133;
  }

  p {
    margin: 0;
    font-size: 14px;
    color: #606266;
    line-height: 1.8;
  }
}

.registration-info {
  padding: 24px;
  border-bottom: 1px solid #ebeef5;

  .info-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;

    h3 {
      margin: 0;
      font-size: 16px;
      font-weight: 600;
      color: #303133;
    }
  }

  .progress-text {
    margin: 12px 0 0 0;
    font-size: 13px;
    color: #909399;
  }
}

.action-buttons {
  padding: 24px;
  display: flex;
  gap: 12px;

  .el-button {
    flex: 1;
  }
}

// 侧边栏
.sidebar {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.participants-card,
.stats-card {
  border-radius: 16px;

  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;

    .card-title {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 16px;
      font-weight: 600;
      color: #303133;

      .el-icon {
        color: #409eff;
      }
    }
  }
}

.participants-list {
  max-height: 400px;
  overflow-y: auto;
}

.participant-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 0;
  border-bottom: 1px solid #ebeef5;

  &:last-child {
    border-bottom: none;
  }
}

.participant-info {
  display: flex;
  flex-direction: column;
  gap: 4px;

  .participant-name {
    font-size: 14px;
    font-weight: 500;
    color: #303133;
  }

  .participant-time {
    font-size: 12px;
    color: #909399;
  }
}

.stats-content {
  .stat-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 0;
    border-bottom: 1px solid #ebeef5;

    &:last-child {
      border-bottom: none;
    }

    .stat-label {
      font-size: 14px;
      color: #606266;
    }

    .stat-value {
      font-size: 16px;
      font-weight: 600;
      color: #303133;

      &.text-danger {
        color: #f56c6c;
      }
    }
  }
}

// 响应式适配
@media (max-width: 968px) {
  .detail-layout {
    grid-template-columns: 1fr;
  }

  .sidebar {
    order: -1;
  }

  .activity-image-wrapper {
    height: 200px;
  }

  .activity-header {
    .activity-title {
      font-size: 20px;
    }
  }
}

@media (max-width: 576px) {
  .activity-detail {
    padding: 16px;
  }

  .activity-header {
    padding: 16px;

    .activity-meta {
      flex-direction: column;
      gap: 8px;
    }
  }

  .activity-description,
  .registration-info,
  .action-buttons {
    padding: 16px;
  }

  .action-buttons {
    flex-direction: column;
  }
}
</style>
