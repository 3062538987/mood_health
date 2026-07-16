<template>
  <div v-if="newAchievements.length > 0" class="achievement-notifications">
    <div
      v-for="(achievement, index) in newAchievements"
      :key="achievement.id"
      class="achievement-notification"
      :class="{ show: true }"
      @click="navigateToAchievements"
    >
      <div class="notification-icon" :class="achievement.achievement.level">
        {{ getAchievementIcon(achievement.achievement.type) }}
      </div>
      <div class="notification-content">
        <h4>🎉 成就解锁</h4>
        <p class="achievement-name">{{ achievement.achievement.name }}</p>
        <p class="achievement-level">{{ getLevelName(achievement.achievement.level) }}</p>
      </div>
      <button class="close-btn" @click.stop="closeNotification(index)">×</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import useAchievementStore from '@/stores/achievementStore'

const router = useRouter()
const achievementStore = useAchievementStore()

const newAchievements = computed(() => achievementStore.newAchievements)

// 方法
function getAchievementIcon(type: string): string {
  const iconMap: Record<string, string> = {
    first_use: '🎉',
    wooden_fish: '木鱼',
    meditation: '🧘',
    game: '🎮',
    all_activities: '🌟',
    streak: '🔥',
  }
  return iconMap[type] || '🏅'
}

function getLevelName(level: string): string {
  const levelMap: Record<string, string> = {
    bronze: '青铜',
    silver: '白银',
    gold: '黄金',
  }
  return levelMap[level] || level
}

function navigateToAchievements() {
  router.push('/relax/achievements')
  achievementStore.clearNewAchievements()
}

function closeNotification(index: number) {
  // 从新成就列表中移除
  const updatedAchievements = [...newAchievements.value]
  updatedAchievements.splice(index, 1)
  // 这里需要修改store中的newAchievements，暂时直接调用clearNewAchievements
  achievementStore.clearNewAchievements()
}

// 监听新成就
watch(
  newAchievements,
  (newVal) => {
    if (newVal.length > 0) {
      // 3秒后自动关闭通知
      setTimeout(() => {
        achievementStore.clearNewAchievements()
      }, 3000)
    }
  },
  { deep: true }
)
</script>

<style scoped lang="scss">
.achievement-notifications {
  position: fixed;
  top: 20px;
  right: 20px;
  z-index: 1000;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.achievement-notification {
  background: #fff;
  border-radius: 12px;
  padding: 15px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 300px;
  max-width: 350px;
  cursor: pointer;
  transition: all 0.3s ease;
  border-left: 4px solid #007bff;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 16px rgba(0, 0, 0, 0.2);
  }

  .notification-icon {
    font-size: 2rem;

    &.bronze {
      color: #cd7f32;
    }

    &.silver {
      color: #c0c0c0;
    }

    &.gold {
      color: #ffd700;
    }
  }

  .notification-content {
    flex: 1;

    h4 {
      margin: 0 0 5px 0;
      color: #333;
      font-size: 14px;
    }

    .achievement-name {
      margin: 0 0 3px 0;
      color: #333;
      font-weight: bold;
      font-size: 16px;
    }

    .achievement-level {
      margin: 0;
      color: #666;
      font-size: 12px;
    }
  }

  .close-btn {
    background: none;
    border: none;
    font-size: 1.2rem;
    cursor: pointer;
    color: #999;
    padding: 0;
    width: 20px;
    height: 20px;
    display: flex;
    align-items: center;
    justify-content: center;

    &:hover {
      color: #333;
    }
  }

  &.show {
    animation: slideIn 0.3s ease-out;
  }
}

@keyframes slideIn {
  from {
    transform: translateX(100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}

/* 响应式设计 */
@media (max-width: 768px) {
  .achievement-notifications {
    top: 10px;
    right: 10px;
    left: 10px;

    .achievement-notification {
      min-width: auto;
      max-width: none;
    }
  }
}
</style>
