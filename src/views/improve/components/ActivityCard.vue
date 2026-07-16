<template>
  <el-card
    class="activity-card"
    :body-style="{ padding: '0px' }"
    shadow="hover"
    @click="handleCardClick"
  >
    <!-- 活动图片 -->
    <div class="activity-image-wrapper">
      <img
        v-if="activity.imageUrl"
        :src="activity.imageUrl"
        class="activity-image"
        alt="活动图片"
      />
      <div v-else class="activity-image-placeholder">
        <el-icon :size="48"><Picture /></el-icon>
        <span>暂无图片</span>
      </div>
      <!-- 状态标签 -->
      <el-tag :type="statusConfig.type" effect="dark" class="status-tag" size="small">
        {{ statusConfig.label }}
      </el-tag>
    </div>

    <!-- 卡片内容 -->
    <div class="activity-content" @click.stop>
      <h3 class="activity-title" :title="activity.title" @click="handleCardClick">
        {{ activity.title }}
      </h3>

      <div class="activity-info">
        <div class="info-item">
          <el-icon><Calendar /></el-icon>
          <span>{{ formatDateTime(activity.startTime) }}</span>
        </div>
        <div class="info-item">
          <el-icon><Location /></el-icon>
          <span :title="activity.location">{{ activity.location }}</span>
        </div>
        <div class="info-item">
          <el-icon><User /></el-icon>
          <span
            :class="{
              'text-danger': isFull,
              'text-success': !isFull,
            }"
          >
            {{ activity.currentParticipants }} / {{ activity.maxParticipants }}
          </span>
        </div>
      </div>

      <p class="activity-description" :title="activity.description">
        {{ activity.description || '暂无描述' }}
      </p>

      <!-- 操作按钮 -->
      <div class="activity-actions">
        <!-- 管理员操作 -->
        <template v-if="isAdmin">
          <el-button type="primary" size="small" @click="$emit('edit', activity)">
            <el-icon><Edit /></el-icon>编辑
          </el-button>
          <el-button type="danger" size="small" @click="$emit('delete', activity.id)">
            <el-icon><Delete /></el-icon>删除
          </el-button>
        </template>

        <!-- 用户报名按钮 -->
        <template v-else>
          <el-button v-if="!isLoggedIn" type="primary" size="small" @click="$emit('login')">
            登录后报名
          </el-button>
          <el-button v-else-if="isJoined" type="success" size="small" disabled>
            <el-icon><Check /></el-icon>已报名
          </el-button>
          <el-button v-else-if="isFull || isEnded" type="info" size="small" disabled>
            {{ isFull ? '名额已满' : '已结束' }}
          </el-button>
          <el-button v-else type="primary" size="small" :loading="joining" @click="debouncedJoin">
            {{ joining ? '报名中...' : '立即报名' }}
          </el-button>
        </template>
      </div>
    </div>
  </el-card>
</template>

<script setup lang="ts">
import { computed, ref, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { Picture, Calendar, Location, User, Edit, Delete, Check } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import type { Activity } from '@/types/activity'
import { getActivityStatus } from '@/utils/activityStatus'
import { joinActivity } from '@/api/activityApi'
import { debounce } from '@/utils/debounce'

const router = useRouter()

interface Props {
  activity: Activity
  isAdmin?: boolean
  isLoggedIn?: boolean
  isJoined?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  isAdmin: false,
  isLoggedIn: false,
  isJoined: false,
})

const emit = defineEmits<{
  edit: [activity: Activity]
  delete: [id: number]
  login: []
  joined: [id: number]
}>()

const joining = ref(false)

// 点击卡片跳转到详情页
const handleCardClick = () => {
  router.push(`/improve/group/${props.activity.id}`)
}

// 计算状态配置
const statusConfig = computed(() => {
  return getActivityStatus(props.activity).config
})

// 是否已满
const isFull = computed(() => {
  return props.activity.currentParticipants >= props.activity.maxParticipants
})

// 是否已结束
const isEnded = computed(() => {
  return new Date(props.activity.endTime).getTime() < Date.now()
})

// 格式化日期时间
const formatDateTime = (dateStr: string) => {
  const date = new Date(dateStr)
  return date.toLocaleString('zh-CN', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// 处理报名
const handleJoin = async () => {
  if (joining.value) return

  joining.value = true
  try {
    await joinActivity(props.activity.id)
    ElMessage.success('报名成功！')
    emit('joined', props.activity.id)
  } catch (error) {
    // 错误已由拦截器处理
  } finally {
    joining.value = false
  }
}

// 防抖版本的报名函数
const debouncedJoin = debounce(handleJoin, 300)

// 组件卸载时清理
onUnmounted(() => {
  // debounce 函数会在组件销毁时自动清理
})
</script>

<style scoped lang="scss">
.activity-card {
  border-radius: 12px;
  overflow: hidden;
  transition: all 0.3s ease;
  height: 100%;
  display: flex;
  flex-direction: column;
  cursor: pointer;

  &:hover {
    transform: translateY(-4px);
  }
}

.activity-image-wrapper {
  position: relative;
  height: 160px;
  overflow: hidden;
  background: #f5f7fa;
}

.activity-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.3s ease;

  .activity-card:hover & {
    transform: scale(1.05);
  }
}

.activity-image-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #909399;
  gap: 8px;

  span {
    font-size: 14px;
  }
}

.status-tag {
  position: absolute;
  top: 12px;
  right: 12px;
  font-weight: 600;
  padding: 4px 12px;
  border-radius: 20px;
}

.activity-content {
  padding: 16px;
  flex: 1;
  display: flex;
  flex-direction: column;
}

.activity-title {
  margin: 0 0 12px 0;
  font-size: 16px;
  font-weight: 600;
  color: #303133;
  line-height: 1.4;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  min-height: 44px;
}

.activity-info {
  margin-bottom: 12px;

  .info-item {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 6px;
    font-size: 13px;
    color: #606266;

    .el-icon {
      color: #909399;
      font-size: 14px;
    }

    span {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  }
}

.activity-description {
  margin: 0 0 16px 0;
  font-size: 13px;
  color: #909399;
  line-height: 1.5;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  flex: 1;
}

.activity-actions {
  display: flex;
  gap: 8px;
  margin-top: auto;

  .el-button {
    flex: 1;
  }
}

.text-danger {
  color: #f56c6c;
}

.text-success {
  color: #67c23a;
}
</style>
