<template>
  <div class="profile">
    <div class="container">
      <h1 class="page-title">我的</h1>

      <!-- 用户信息卡片 -->
      <div class="user-info-card">
        <div class="avatar">
          <div class="avatar-placeholder">👤</div>
        </div>
        <div class="user-details">
          <h2 class="username">{{ displayUsername }}</h2>
          <p class="user-id">用户ID: {{ displayUserId }}</p>
        </div>
      </div>

      <!-- 个人情绪主页 -->
      <div class="emotion-homepage">
        <h3 class="section-title">个人情绪主页</h3>

        <!-- 情绪健康评分 -->
        <div class="emotion-score-card">
          <div class="score-circle">
            <div class="score-number">{{ emotionScore }}</div>
            <div class="score-label">情绪健康评分</div>
          </div>
          <div class="score-description">
            <p>基于近30天情绪记录</p>
            <p>积极情绪占比越高，评分越高</p>
          </div>
        </div>

        <!-- 近期高频情绪 -->
        <div class="recent-emotions">
          <h4>近期高频情绪</h4>
          <div v-if="emotionEntries.length > 0" class="emotion-tags">
            <div v-for="(count, emotion) in recentEmotions" :key="emotion" class="emotion-tag">
              <span class="emotion-name">{{ getMoodNameZh(emotion) }}</span>
              <span class="emotion-count">{{ count }}次</span>
            </div>
          </div>
          <p v-else class="empty-text">暂无情绪记录</p>
        </div>

        <!-- 参与记录与收藏 -->
        <div class="activity-records">
          <div class="record-item">
            <h4>团体辅导参与记录</h4>
            <p class="record-value">{{ groupActivityCount }}次</p>
          </div>
          <div class="record-item">
            <h4>收藏的知识点</h4>
            <p class="record-value">{{ favoriteKnowledgeCount }}个</p>
          </div>
          <div class="record-item">
            <h4>收藏的解压工具</h4>
            <p class="record-value">{{ favoriteToolsCount }}个</p>
          </div>
        </div>
      </div>

      <!-- 功能入口区域 -->
      <div class="function-section">
        <h3 class="section-title">功能入口</h3>
        <div class="function-grid">
          <div class="function-card settings-card" @click="goToSetting">
            <div class="card-icon">⚙️</div>
            <h4 class="card-title">设置</h4>
            <p class="card-description">账号和隐私设置</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '@/stores/userStore'
import { getMoodRecordList } from '@/api/mood'
import { getMyJoinedActivities } from '@/api/activityApi'

const router = useRouter()
const userStore = useUserStore()

const displayUsername = computed(() => userStore.user?.username || '未登录用户')
const displayUserId = computed(() => String(userStore.user?.id || '-'))

// 个人情绪主页数据（按当前登录用户实时计算）
const emotionScore = ref(0)
const recentEmotions = ref<Record<string, number>>({})
const groupActivityCount = ref(0)
const favoriteKnowledgeCount = ref(0)
const favoriteToolsCount = ref(0)
const emotionEntries = computed(() => Object.entries(recentEmotions.value))

const moodLabelMap: Record<string, string> = {
  happy: '开心',
  delight: '愉悦',
  neutral: '一般',
  sad: '难过',
  angry: '愤怒',
  irritable: '烦躁',
  anxious: '焦虑',
  calm: '平静',
  excited: '兴奋',
  tired: '疲惫',
  grateful: '感恩',
}

const getMoodNameZh = (mood: string) => moodLabelMap[mood] || mood

const computeEmotionScore = (list: Array<{ moodRatio?: number[]; intensity?: number }>) => {
  if (list.length === 0) return 0
  const total = list.reduce((sum, item) => {
    if (Array.isArray(item.moodRatio) && item.moodRatio.length > 0) {
      return sum + Number(item.moodRatio[0] || 0)
    }
    return sum + Number(item.intensity || 0) * 10
  }, 0)
  return Math.max(0, Math.min(100, Math.round(total / list.length)))
}

const computeRecentEmotions = (list: Array<{ moodType?: string[] }>) => {
  const counter = new Map<string, number>()
  for (const item of list) {
    const moods = Array.isArray(item.moodType) ? item.moodType : []
    for (const mood of moods) {
      const key = String(mood || '').trim()
      if (!key) continue
      counter.set(key, (counter.get(key) || 0) + 1)
    }
  }

  return Object.fromEntries([...counter.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4))
}

const loadProfileData = async () => {
  if (userStore.token && !userStore.user) {
    await userStore.fetchUserInfo()
  }

  if (!userStore.user) {
    emotionScore.value = 0
    recentEmotions.value = {}
    groupActivityCount.value = 0
    return
  }

  const [moodListResult, joinedActivities] = await Promise.all([
    getMoodRecordList({ page: 1, size: 200 }),
    getMyJoinedActivities(),
  ])

  const moodList = Array.isArray(moodListResult?.list) ? moodListResult.list : []
  emotionScore.value = computeEmotionScore(moodList)
  recentEmotions.value = computeRecentEmotions(moodList)
  groupActivityCount.value = Array.isArray(joinedActivities) ? joinedActivities.length : 0
}

const goToSetting = () => {
  router.push('/user/setting')
}

onMounted(() => {
  loadProfileData().catch(() => {
    emotionScore.value = 0
    recentEmotions.value = {}
    groupActivityCount.value = 0
  })
})
</script>

<style scoped lang="scss">
.profile-view {
  min-height: 100vh;
  background: #f5f7fa;

  .container {
    max-width: 900px;
    margin: 0 auto;
    padding: 20px;
  }

  .page-title {
    text-align: center;
    color: #42b983;
    margin: 0 0 40px 0;
    font-size: 32px;
  }
}

// 用户信息卡片样式
.user-info-card {
  background: white;
  border-radius: 16px;
  padding: 30px;
  margin-bottom: 30px;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.08);
  display: flex;
  align-items: center;
  gap: 20px;

  .avatar {
    .avatar-placeholder {
      width: 100px;
      height: 100px;
      border-radius: 50%;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 50px;
      color: white;
    }
  }

  .user-details {
    .username {
      margin: 0 0 8px 0;
      color: #333;
      font-size: 24px;
    }

    .user-id {
      margin: 0;
      color: #999;
      font-size: 14px;
    }
  }
}

// 功能区域样式
.function-section {
  margin-bottom: 30px;

  .section-title {
    margin: 0 0 20px 0;
    color: #333;
    font-size: 20px;
  }
}

// 功能卡片网格
.function-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 20px;
}

// 功能卡片样式
.function-card {
  background: white;
  border-radius: 12px;
  padding: 24px;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  border: 2px solid transparent;
  position: relative;

  &:hover {
    transform: translateY(-5px);
    box-shadow: 0 8px 25px rgba(0, 0, 0, 0.1);
  }

  .card-icon {
    font-size: 48px;
    margin-bottom: 16px;
  }

  .card-title {
    margin: 0 0 8px 0;
    color: #333;
    font-size: 18px;
  }

  .card-description {
    margin: 0 0 16px 0;
    color: #666;
    font-size: 14px;
    line-height: 1.5;
  }
}

// 个人情绪主页样式
.emotion-homepage {
  background: white;
  border-radius: 16px;
  padding: 24px;
  margin-bottom: 30px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);

  .section-title {
    margin: 0 0 24px 0;
    color: #333;
    font-size: 20px;
  }
}

// 情绪健康评分卡片样式
.emotion-score-card {
  display: flex;
  align-items: center;
  margin-bottom: 24px;
  gap: 40px;

  .score-circle {
    width: 150px;
    height: 150px;
    border-radius: 50%;
    background: linear-gradient(135deg, #42b983 0%, #388e3c 100%);
    color: white;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    box-shadow: 0 8px 25px rgba(66, 185, 131, 0.2);

    .score-number {
      font-size: 48px;
      font-weight: bold;
      margin-bottom: 8px;
    }

    .score-label {
      font-size: 14px;
      opacity: 0.9;
    }
  }

  .score-description {
    p {
      margin: 4px 0;
      color: #666;
      font-size: 14px;
    }
  }
}

// 近期高频情绪样式
.recent-emotions {
  margin-bottom: 24px;

  h4 {
    margin: 0 0 16px 0;
    color: #333;
    font-size: 16px;
  }

  .empty-text {
    margin: 0;
    color: #999;
    font-size: 14px;
  }
}

// 情绪标签样式
.emotion-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;

  .emotion-tag {
    background: #f0f0f0;
    padding: 8px 16px;
    border-radius: 20px;
    display: flex;
    align-items: center;
    gap: 8px;
    transition: all 0.3s ease;

    &:hover {
      background: #e0e0e0;
      transform: translateY(-2px);
    }

    .emotion-name {
      font-weight: 500;
      color: #333;
    }

    .emotion-count {
      background: #42b983;
      color: white;
      padding: 2px 8px;
      border-radius: 10px;
      font-size: 12px;
    }
  }
}

// 活动记录样式
.activity-records {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;

  .record-item {
    background: #f8f9fa;
    padding: 16px;
    border-radius: 12px;
    text-align: center;

    h4 {
      margin: 0 0 8px 0;
      color: #666;
      font-size: 14px;
    }

    .record-value {
      margin: 0;
      color: #42b983;
      font-size: 24px;
      font-weight: bold;
    }
  }
}

// 响应式设计
@media (max-width: 768px) {
  .user-info-card {
    flex-direction: column;
    text-align: center;
  }

  .function-grid {
    grid-template-columns: 1fr;
  }

  .page-title {
    font-size: 24px;
  }
}
</style>
