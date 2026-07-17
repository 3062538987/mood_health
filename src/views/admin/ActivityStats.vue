<template>
  <div class="activity-stats">
    <div class="page-header">
      <h2>活动效果统计</h2>
      <div class="date-filter">
        <el-date-picker
          v-model="dateRange"
          type="daterange"
          range-separator="至"
          start-placeholder="开始日期"
          end-placeholder="结束日期"
          format="YYYY-MM-DD"
          value-format="YYYY-MM-DD"
          @change="loadStats"
        />
        <el-button type="primary" @click="loadStats">查询</el-button>
      </div>
    </div>

    <!-- 加载状态 -->
    <div v-if="loading" class="loading-wrapper">
      <el-skeleton :rows="6" animated />
    </div>

    <!-- 错误状态 -->
    <el-empty
      v-else-if="error"
      description="加载失败，请稍后重试"
      :image-size="160"
    >
      <el-button type="primary" @click="loadStats">重新加载</el-button>
    </el-empty>

    <!-- 统计数据 -->
    <template v-else>
      <!-- KPI 卡片 -->
      <el-row :gutter="20" class="kpi-row">
        <el-col :span="6">
          <el-card shadow="hover" class="kpi-card">
            <div class="kpi-label">总活动数</div>
            <div class="kpi-value">{{ stats?.totalActivities ?? 0 }}</div>
          </el-card>
        </el-col>
        <el-col :span="6">
          <el-card shadow="hover" class="kpi-card">
            <div class="kpi-label">总报名人次</div>
            <div class="kpi-value">{{ stats?.totalParticipants ?? 0 }}</div>
          </el-card>
        </el-col>
        <el-col :span="6">
          <el-card shadow="hover" class="kpi-card">
            <div class="kpi-label">反馈总数</div>
            <div class="kpi-value">{{ stats?.totalFeedback ?? 0 }}</div>
          </el-card>
        </el-col>
        <el-col :span="6">
          <el-card shadow="hover" class="kpi-card">
            <div class="kpi-label">平均评分</div>
            <div class="kpi-value">
              {{ stats?.averageRating ?? 0 }}
              <span class="kpi-unit">/ 5</span>
            </div>
          </el-card>
        </el-col>
      </el-row>

      <!-- 评分分布 -->
      <el-card shadow="hover" class="chart-card">
        <template #header>
          <span class="card-title">评分分布</span>
        </template>
        <div v-if="hasRatingData" class="rating-distribution">
          <div v-for="star in 5" :key="star" class="rating-bar">
            <span class="rating-label">{{ star }}星</span>
            <el-progress
              :percentage="getRatingPercent(star)"
              :color="getRatingColor(star)"
              :stroke-width="20"
            />
            <span class="rating-count">{{ getRatingCount(star) }}</span>
          </div>
        </div>
        <el-empty v-else description="暂无评分数据" :image-size="80" />
      </el-card>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { getActivityStats } from '@/api/activityApi'
import type { ActivityFeedbackStats } from '@/api/activityApi'

interface ActivityStats {
  totalActivities: number
  totalParticipants: number
  averageParticipants: number
  totalFeedback: number
  averageRating: number
  ratingDistribution: Record<number, number>
}

const loading = ref(false)
const error = ref(false)
const stats = ref<ActivityStats | null>(null)
const dateRange = ref<[string, string] | null>(null)

const hasRatingData = computed(() => {
  if (!stats.value) return false
  return Object.values(stats.value.ratingDistribution).some((v) => v > 0)
})

const getRatingCount = (star: number) => {
  return stats.value?.ratingDistribution?.[star] ?? 0
}

const getRatingPercent = (star: number) => {
  const total = stats.value?.totalFeedback ?? 0
  if (total === 0) return 0
  return Math.round(((stats.value?.ratingDistribution?.[star] ?? 0) / total) * 100)
}

const getRatingColor = (star: number) => {
  const colors: Record<number, string> = {
    1: '#f56c6c',
    2: '#e6a23c',
    3: '#f7ba2a',
    4: '#67c23a',
    5: '#409eff',
  }
  return colors[star] || '#909399'
}

const loadStats = async () => {
  loading.value = true
  error.value = false
  try {
    const params: Record<string, string> = {}
    if (dateRange.value?.length === 2) {
      params.startDate = dateRange.value[0]
      params.endDate = dateRange.value[1]
    }
    stats.value = await getActivityStats(params)
  } catch {
    error.value = true
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadStats()
})
</script>

<style scoped lang="scss">
.activity-stats {
  padding: 24px;
  background: #f5f7fa;
  min-height: 100%;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;

  h2 {
    margin: 0;
    font-size: 22px;
    font-weight: 600;
    color: #303133;
  }

  .date-filter {
    display: flex;
    gap: 12px;
  }
}

.loading-wrapper {
  padding: 40px;
}

.kpi-row {
  margin-bottom: 24px;
}

.kpi-card {
  border-radius: 12px;
  text-align: center;

  .kpi-label {
    font-size: 14px;
    color: #909399;
    margin-bottom: 8px;
  }

  .kpi-value {
    font-size: 32px;
    font-weight: 700;
    color: #303133;

    .kpi-unit {
      font-size: 14px;
      font-weight: 400;
      color: #909399;
    }
  }
}

.chart-card {
  border-radius: 12px;

  .card-title {
    font-size: 16px;
    font-weight: 600;
    color: #303133;
  }
}

.rating-distribution {
  .rating-bar {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 16px;

    &:last-child {
      margin-bottom: 0;
    }

    .rating-label {
      width: 40px;
      font-size: 14px;
      color: #606266;
      flex-shrink: 0;
    }

    .el-progress {
      flex: 1;
    }

    .rating-count {
      width: 40px;
      font-size: 14px;
      color: #909399;
      text-align: right;
      flex-shrink: 0;
    }
  }
}
</style>