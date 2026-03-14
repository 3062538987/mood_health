<template>
  <div class="mood-wooden-fish">
    <!-- 今日累计次数 -->
    <div class="daily-stats">
      <span class="stats-icon">📊</span>
      <span class="stats-text">今日累计：{{ dailyCount }} 次</span>
    </div>

    <div
      class="wooden-fish"
      @click="tapWoodenFish"
      :class="{ tapping: isTapping }"
    >
      <div class="fish-body">
        <div class="fish-inner"></div>
      </div>
      <div class="fish-stick"></div>
      <div class="mood-reduce" v-if="showText">{{ reduceText }}</div>
    </div>

    <!-- 目标快捷选择 -->
    <div class="target-section">
      <label class="section-label">目标敲击次数：</label>
      <div class="quick-select">
        <button
          v-for="num in [50, 100, 200, 500]"
          :key="num"
          class="quick-btn"
          :class="{ active: targetCount === num }"
          @click="setQuickTarget(num)"
        >
          {{ num }}
        </button>
      </div>
      <div class="custom-input">
        <input
          type="number"
          v-model.number="targetCount"
          min="10"
          max="1000"
          placeholder="自定义"
        />
        <button @click="setTarget" class="confirm-btn">确定</button>
      </div>
    </div>

    <div class="progress">
      <div class="progress-bar">
        <div
          class="progress-fill"
          :style="{ width: progressPercent + '%' }"
        ></div>
      </div>
      <span class="progress-text"
        >已敲击：{{ tapCount }}/{{ targetCount }}</span
      >
    </div>

    <!-- 完成弹窗 -->
    <div v-if="showCompleteModal" class="modal-overlay" @click="closeModal">
      <div class="modal-content" @click.stop>
        <div class="modal-icon">🎉</div>
        <h3 class="modal-title">目标达成！</h3>
        <p class="modal-text">今日累计敲击 {{ dailyCount }} 次</p>
        <p class="modal-subtext">继续保持好心情~</p>
        <button class="modal-btn" @click="closeModal">继续敲击</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from "vue";
import useRelaxStore from "@/stores/relaxStore";
import useAchievementStore from "@/stores/achievementStore";
import soundManager from "@/utils/sound";

const relaxStore = useRelaxStore();
const achievementStore = useAchievementStore();
const tapCount = ref(0);
const targetCount = ref(100);
const showText = ref(false);
const reduceText = ref("");
const isTapping = ref(false);
const startTime = ref(new Date().toISOString());
const showCompleteModal = ref(false);
const dailyCount = ref(0);

// 从localStorage加载今日累计次数
const loadDailyCount = () => {
  const today = new Date().toDateString();
  const savedDate = localStorage.getItem("woodenFishDate");
  const savedCount = localStorage.getItem("woodenFishDailyCount");

  if (savedDate === today && savedCount) {
    dailyCount.value = parseInt(savedCount, 10);
  } else {
    dailyCount.value = 0;
    localStorage.setItem("woodenFishDate", today);
    localStorage.setItem("woodenFishDailyCount", "0");
  }
};

// 保存今日累计次数
const saveDailyCount = () => {
  localStorage.setItem("woodenFishDailyCount", dailyCount.value.toString());
};

const progressPercent = computed(() => {
  return Math.min((tapCount.value / targetCount.value) * 100, 100);
});

// 快捷设置目标
const setQuickTarget = (num: number) => {
  targetCount.value = num;
  setTarget();
};

// 关闭弹窗
const closeModal = () => {
  showCompleteModal.value = false;
};

const tapWoodenFish = () => {
  tapCount.value++;
  // 更新今日累计次数
  dailyCount.value++;
  saveDailyCount();
  // 播放音效
  soundManager.playSound("woodenFish");
  showText.value = true;
  isTapping.value = true;

  const messages = ["焦虑-1", "压力-1", "烦恼-1", "紧张-1", "疲惫-1"];
  reduceText.value = messages[Math.floor(Math.random() * messages.length)];

  setTimeout(() => {
    showText.value = false;
  }, 800);

  setTimeout(() => {
    isTapping.value = false;
  }, 150);

  if (tapCount.value === targetCount.value) {
    setTimeout(() => {
      showCompleteModal.value = true;
      saveRelaxRecord();
    }, 200);
  }
};

const saveRelaxRecord = async () => {
  const endTime = new Date().toISOString();
  await relaxStore.saveRecord({
    activityType: "woodenFish",
    startTime: startTime.value,
    endTime: endTime,
    metrics: {
      tapCount: tapCount.value,
      targetCount: targetCount.value,
    },
  });
  // 检查成就
  await achievementStore.checkAchievements();
  // 重置开始时间，以便下次记录
  startTime.value = new Date().toISOString();
};

const setTarget = () => {
  if (targetCount.value < 10) targetCount.value = 10;
  if (targetCount.value > 1000) targetCount.value = 1000;
  // 重置开始时间
  startTime.value = new Date().toISOString();
  tapCount.value = 0;
};

onMounted(() => {
  loadDailyCount();
});
</script>

<style scoped lang="scss">
.mood-wooden-fish {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 30px;
  position: relative;

  // 今日累计次数
  .daily-stats {
    position: absolute;
    top: 20px;
    right: 20px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    padding: 10px 20px;
    border-radius: 20px;
    font-size: 14px;
    box-shadow: 0 4px 15px rgba(102, 126, 234, 0.3);
    display: flex;
    align-items: center;
    gap: 8px;

    .stats-icon {
      font-size: 16px;
    }

    .stats-text {
      font-weight: 500;
    }
  }

  .wooden-fish {
    position: relative;
    cursor: pointer;
    transition: transform 0.1s ease;
    user-select: none;

    &.tapping {
      transform: scale(0.95);
    }

    &:hover {
      transform: scale(1.02);
    }

    &:active {
      transform: scale(0.92);
    }

    .fish-body {
      width: 180px;
      height: 120px;
      background: linear-gradient(
        145deg,
        #d4a574 0%,
        #b8956c 50%,
        #9a7b59 100%
      );
      border-radius: 50% 50% 50% 50% / 60% 60% 40% 40%;
      position: relative;
      box-shadow:
        0 8px 20px rgba(0, 0, 0, 0.2),
        inset 0 -5px 15px rgba(0, 0, 0, 0.1),
        inset 0 5px 10px rgba(255, 255, 255, 0.2);

      .fish-inner {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 60px;
        height: 40px;
        background: linear-gradient(145deg, #c49a6c, #a07850);
        border-radius: 50%;
        box-shadow:
          inset 0 2px 5px rgba(0, 0, 0, 0.2),
          0 2px 5px rgba(255, 255, 255, 0.1);

        &::before {
          content: "木";
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          font-size: 20px;
          color: #5a4030;
          font-weight: bold;
        }
      }
    }

    .fish-stick {
      width: 20px;
      height: 80px;
      background: linear-gradient(90deg, #8b6914, #a67c00, #8b6914);
      border-radius: 10px;
      margin: -10px auto 0;
      box-shadow: 2px 2px 5px rgba(0, 0, 0, 0.2);
    }

    .mood-reduce {
      position: absolute;
      top: -40px;
      left: 50%;
      transform: translateX(-50%);
      color: #e74c3c;
      font-size: 24px;
      font-weight: bold;
      animation: floatUp 0.8s ease-out;
      white-space: nowrap;
    }
  }

  // 目标设置区域
  .target-section {
    margin: 30px 0 20px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 15px;

    .section-label {
      font-size: 14px;
      color: #666;
      font-weight: 500;
    }

    .quick-select {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
      justify-content: center;

      .quick-btn {
        padding: 10px 20px;
        background: #f5f7fa;
        border: 2px solid #e0e0e0;
        border-radius: 8px;
        cursor: pointer;
        font-size: 14px;
        font-weight: 500;
        color: #666;
        transition: all 0.3s;

        &:hover {
          border-color: #42b983;
          color: #42b983;
          transform: translateY(-2px);
        }

        &.active {
          background: linear-gradient(135deg, #42b983, #359469);
          border-color: #42b983;
          color: #fff;
          box-shadow: 0 4px 12px rgba(66, 185, 131, 0.3);
        }
      }
    }

    .custom-input {
      display: flex;
      align-items: center;
      gap: 10px;

      input {
        width: 100px;
        padding: 10px 12px;
        border: 2px solid #e0e0e0;
        border-radius: 8px;
        font-size: 14px;
        text-align: center;
        transition: border-color 0.3s;

        &:focus {
          outline: none;
          border-color: #42b983;
        }
      }

      .confirm-btn {
        padding: 10px 20px;
        background: linear-gradient(135deg, #42b983, #359469);
        color: #fff;
        border: none;
        border-radius: 8px;
        cursor: pointer;
        font-size: 14px;
        transition: all 0.3s;

        &:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(66, 185, 131, 0.3);
        }
      }
    }
  }

  .progress {
    width: 100%;
    max-width: 300px;

    .progress-bar {
      height: 12px;
      background: #e9ecef;
      border-radius: 6px;
      overflow: hidden;
      margin-bottom: 10px;

      .progress-fill {
        height: 100%;
        background: linear-gradient(90deg, #42b983, #359469);
        border-radius: 6px;
        transition: width 0.3s ease;
      }
    }

    .progress-text {
      display: block;
      text-align: center;
      font-size: 14px;
      color: #666;
    }
  }
}

@keyframes floatUp {
  0% {
    opacity: 1;
    transform: translateX(-50%) translateY(0);
  }
  100% {
    opacity: 0;
    transform: translateX(-50%) translateY(-30px);
  }
}

// 弹窗样式
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  animation: fadeIn 0.3s ease;
}

.modal-content {
  background: white;
  border-radius: 20px;
  padding: 40px;
  text-align: center;
  max-width: 320px;
  width: 90%;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
  animation: scaleIn 0.3s ease;

  .modal-icon {
    font-size: 60px;
    margin-bottom: 20px;
    animation: bounce 1s ease infinite;
  }

  .modal-title {
    font-size: 24px;
    color: #333;
    margin: 0 0 15px 0;
    font-weight: 600;
  }

  .modal-text {
    font-size: 16px;
    color: #666;
    margin: 0 0 10px 0;
  }

  .modal-subtext {
    font-size: 14px;
    color: #999;
    margin: 0 0 25px 0;
  }

  .modal-btn {
    padding: 12px 30px;
    background: linear-gradient(135deg, #42b983, #359469);
    color: white;
    border: none;
    border-radius: 25px;
    font-size: 16px;
    cursor: pointer;
    transition: all 0.3s;

    &:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 15px rgba(66, 185, 131, 0.4);
    }
  }
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes scaleIn {
  from {
    transform: scale(0.8);
    opacity: 0;
  }
  to {
    transform: scale(1);
    opacity: 1;
  }
}

@keyframes bounce {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-10px);
  }
}

// 响应式设计
@media (max-width: 768px) {
  .mood-wooden-fish {
    padding: 20px;

    .daily-stats {
      position: static;
      margin-bottom: 20px;
      align-self: flex-end;
    }

    .target-section {
      .quick-select {
        gap: 8px;

        .quick-btn {
          padding: 8px 16px;
          font-size: 13px;
        }
      }
    }
  }
}
</style>
