<template>
  <div class="achievements-page">
    <header class="page-header">
      <h1>成就中心</h1>
      <p>解锁各种成就，成为放松大师</p>
    </header>

    <div class="achievements-content">
      <!-- 成就统计 -->
      <div class="achievement-stats">
        <div class="stat-card">
          <div class="stat-icon">🏆</div>
          <div class="stat-info">
            <h3>已解锁成就</h3>
            <p>{{ unlockedCount }}/{{ totalCount }}</p>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon">📊</div>
          <div class="stat-info">
            <h3>完成率</h3>
            <p>{{ completionRate }}%</p>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon">🔥</div>
          <div class="stat-info">
            <h3>最近解锁</h3>
            <p>{{ lastUnlocked || "暂无" }}</p>
          </div>
        </div>
      </div>

      <!-- 成就列表 -->
      <div class="achievements-list">
        <h2>所有成就</h2>
        <div class="achievement-grid">
          <div
            v-for="achievement in achievements"
            :key="achievement.id"
            class="achievement-card"
            :class="{
              unlocked: isUnlocked(achievement.id),
              locked: !isUnlocked(achievement.id),
            }"
            @click="showAchievementDetail(achievement)"
          >
            <div class="achievement-icon" :class="achievement.level">
              {{ getAchievementIcon(achievement.type) }}
            </div>
            <div class="achievement-info">
              <h3 class="achievement-name">{{ achievement.name }}</h3>
              <p class="achievement-description">
                {{ achievement.description }}
              </p>
              <div class="achievement-level">
                {{ getLevelName(achievement.level) }}
              </div>
              <div
                v-if="!isUnlocked(achievement.id)"
                class="achievement-progress"
              >
                <div class="progress-bar">
                  <div
                    class="progress-fill"
                    :style="{
                      width: getProgressPercentage(achievement.id) + '%',
                    }"
                  ></div>
                </div>
                <span class="progress-text"
                  >{{ getCurrentProgress(achievement.id) }}/{{
                    achievement.threshold
                  }}</span
                >
              </div>
              <div v-else class="achievement-unlocked">
                <span class="unlocked-date">
                  解锁于 {{ formatUnlockDate(achievement.id) }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 成就详情弹窗 -->
    <div
      v-if="selectedAchievement"
      class="achievement-modal"
      @click="closeModal"
    >
      <div class="modal-content" @click.stop>
        <button class="close-btn" @click="closeModal">×</button>
        <div class="modal-icon" :class="selectedAchievement.level">
          {{ getAchievementIcon(selectedAchievement.type) }}
        </div>
        <h2>{{ selectedAchievement.name }}</h2>
        <p class="modal-description">{{ selectedAchievement.description }}</p>
        <div class="modal-level">
          {{ getLevelName(selectedAchievement.level) }}
        </div>
        <div v-if="isUnlocked(selectedAchievement.id)" class="modal-unlocked">
          <p>解锁时间：{{ formatUnlockDate(selectedAchievement.id) }}</p>
        </div>
        <div v-else class="modal-progress">
          <p>
            当前进度：{{ getCurrentProgress(selectedAchievement.id) }}/{{
              selectedAchievement.threshold
            }}
          </p>
          <div class="progress-bar">
            <div
              class="progress-fill"
              :style="{
                width: getProgressPercentage(selectedAchievement.id) + '%',
              }"
            ></div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import useAchievementStore from "@/stores/achievementStore";
import { formatDate } from "@/utils/dateUtil";
import type { Achievement } from "@/api/achievements";

const achievementStore = useAchievementStore();
const selectedAchievement = ref<Achievement | null>(null);

// 计算属性
const achievements = computed(() => achievementStore.achievements);
const userAchievements = computed(() => achievementStore.userAchievements);
const progress = computed(() => achievementStore.progress);

const unlockedCount = computed(() => userAchievements.value.length);
const totalCount = computed(() => achievements.value.length);
const completionRate = computed(() => {
  if (totalCount.value === 0) return 0;
  return Math.round((unlockedCount.value / totalCount.value) * 100);
});

const lastUnlocked = computed(() => {
  if (userAchievements.value.length === 0) return null;
  const sorted = [...userAchievements.value].sort(
    (a, b) =>
      new Date(b.unlockedAt).getTime() - new Date(a.unlockedAt).getTime(),
  );
  return sorted[0].achievement.name;
});

// 方法
function isUnlocked(achievementId: string): boolean {
  return userAchievements.value.some(
    (ua) => ua.achievementId === achievementId,
  );
}

function getProgress(achievementId: string) {
  return progress.value.find((p) => p.achievementId === achievementId);
}

function getCurrentProgress(achievementId: string): number {
  const p = getProgress(achievementId);
  return p ? p.current : 0;
}

function getProgressPercentage(achievementId: string): number {
  const achievement = achievements.value.find((a) => a.id === achievementId);
  if (!achievement) return 0;
  const current = getCurrentProgress(achievementId);
  return Math.min(Math.round((current / achievement.threshold) * 100), 100);
}

function formatUnlockDate(achievementId: string): string {
  const userAchievement = userAchievements.value.find(
    (ua) => ua.achievementId === achievementId,
  );
  if (userAchievement) {
    return formatDate(new Date(userAchievement.unlockedAt));
  }
  return "";
}

function getAchievementIcon(type: string): string {
  const iconMap: Record<string, string> = {
    first_use: "🎉",
    wooden_fish: "木鱼",
    meditation: "🧘",
    game: "🎮",
    all_activities: "🌟",
    streak: "🔥",
  };
  return iconMap[type] || "🏅";
}

function getLevelName(level: string): string {
  const levelMap: Record<string, string> = {
    bronze: "青铜",
    silver: "白银",
    gold: "黄金",
  };
  return levelMap[level] || level;
}

function showAchievementDetail(achievement: Achievement) {
  selectedAchievement.value = achievement;
}

function closeModal() {
  selectedAchievement.value = null;
}

// 生命周期
onMounted(async () => {
  await achievementStore.init();
});
</script>

<style scoped lang="scss">
.achievements-page {
  padding: 20px;
  max-width: 1200px;
  margin: 0 auto;

  .page-header {
    text-align: center;
    margin-bottom: 40px;

    h1 {
      font-size: 2.5rem;
      color: #333;
      margin-bottom: 10px;
    }

    p {
      font-size: 1.1rem;
      color: #666;
    }
  }

  .achievement-stats {
    display: flex;
    justify-content: space-around;
    margin-bottom: 40px;

    .stat-card {
      background: #f8f9fa;
      border-radius: 12px;
      padding: 20px;
      text-align: center;
      flex: 1;
      margin: 0 10px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);

      .stat-icon {
        font-size: 2rem;
        margin-bottom: 10px;
      }

      .stat-info h3 {
        font-size: 1.2rem;
        color: #333;
        margin-bottom: 5px;
      }

      .stat-info p {
        font-size: 1.5rem;
        font-weight: bold;
        color: #007bff;
      }
    }
  }

  .achievements-list {
    h2 {
      font-size: 1.8rem;
      color: #333;
      margin-bottom: 20px;
      text-align: center;
    }

    .achievement-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      gap: 20px;

      .achievement-card {
        background: #fff;
        border-radius: 12px;
        padding: 20px;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        cursor: pointer;
        transition: all 0.3s ease;
        border: 2px solid transparent;

        &:hover {
          transform: translateY(-5px);
          box-shadow: 0 5px 15px rgba(0, 0, 0, 0.1);
        }

        &.unlocked {
          border-color: #28a745;
          background: #f8fff8;
        }

        &.locked {
          opacity: 0.6;
          border-color: #dee2e6;
        }

        .achievement-icon {
          font-size: 3rem;
          margin-bottom: 15px;
          text-align: center;

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

        .achievement-info {
          .achievement-name {
            font-size: 1.2rem;
            font-weight: bold;
            color: #333;
            margin-bottom: 8px;
          }

          .achievement-description {
            font-size: 0.9rem;
            color: #666;
            margin-bottom: 12px;
          }

          .achievement-level {
            display: inline-block;
            padding: 4px 12px;
            border-radius: 12px;
            font-size: 0.8rem;
            font-weight: bold;
            margin-bottom: 12px;

            &.bronze {
              background: #f5e6d3;
              color: #cd7f32;
            }

            &.silver {
              background: #f0f0f0;
              color: #c0c0c0;
            }

            &.gold {
              background: #fff9c4;
              color: #ffd700;
            }
          }

          .achievement-progress {
            margin-top: 10px;

            .progress-bar {
              height: 8px;
              background: #e9ecef;
              border-radius: 4px;
              overflow: hidden;
              margin-bottom: 5px;

              .progress-fill {
                height: 100%;
                background: #007bff;
                transition: width 0.3s ease;
              }
            }

            .progress-text {
              font-size: 0.8rem;
              color: #666;
              text-align: right;
            }
          }

          .achievement-unlocked {
            margin-top: 10px;

            .unlocked-date {
              font-size: 0.8rem;
              color: #28a745;
              font-weight: 500;
            }
          }
        }
      }
    }
  }
}

/* 弹窗样式 */
.achievement-modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;

  .modal-content {
    background: #fff;
    border-radius: 16px;
    padding: 30px;
    max-width: 400px;
    width: 90%;
    position: relative;
    text-align: center;

    .close-btn {
      position: absolute;
      top: 10px;
      right: 15px;
      background: none;
      border: none;
      font-size: 1.5rem;
      cursor: pointer;
      color: #666;

      &:hover {
        color: #333;
      }
    }

    .modal-icon {
      font-size: 4rem;
      margin-bottom: 20px;

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

    h2 {
      font-size: 1.8rem;
      color: #333;
      margin-bottom: 15px;
    }

    .modal-description {
      font-size: 1rem;
      color: #666;
      margin-bottom: 20px;
      line-height: 1.4;
    }

    .modal-level {
      display: inline-block;
      padding: 6px 16px;
      border-radius: 16px;
      font-size: 0.9rem;
      font-weight: bold;
      margin-bottom: 20px;

      &.bronze {
        background: #f5e6d3;
        color: #cd7f32;
      }

      &.silver {
        background: #f0f0f0;
        color: #c0c0c0;
      }

      &.gold {
        background: #fff9c4;
        color: #ffd700;
      }
    }

    .modal-unlocked {
      p {
        color: #28a745;
        font-weight: 500;
      }
    }

    .modal-progress {
      p {
        margin-bottom: 10px;
        color: #666;
      }

      .progress-bar {
        height: 10px;
        background: #e9ecef;
        border-radius: 5px;
        overflow: hidden;

        .progress-fill {
          height: 100%;
          background: #007bff;
        }
      }
    }
  }
}

/* 响应式设计 */
@media (max-width: 768px) {
  .achievements-page {
    .achievement-stats {
      flex-direction: column;

      .stat-card {
        margin: 10px 0;
      }
    }

    .achievements-list {
      .achievement-grid {
        grid-template-columns: 1fr;
      }
    }
  }
}
</style>
