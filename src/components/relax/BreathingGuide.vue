<template>
  <div class="breathing-guide">
    <h3>呼吸同步游戏 - 冥想</h3>

    <!-- 游戏设置 -->
    <div class="game-settings" v-if="!isGameStarted && !gameFinished">
      <div class="duration-selector">
        <label>选择冥想时长：</label>
        <div class="duration-options">
          <button
            v-for="duration in durations"
            :key="duration"
            :class="{ active: selectedDuration === duration }"
            @click="selectDuration(duration)"
            class="duration-btn"
          >
            {{ duration }}分钟
          </button>
        </div>
      </div>

      <!-- 呼吸模式选择 -->
      <div class="breathing-pattern">
        <label>选择呼吸模式：</label>
        <div class="pattern-options">
          <button
            v-for="pattern in breathingPatterns"
            :key="pattern.id"
            :class="{ active: selectedPattern === pattern.id }"
            @click="selectPattern(pattern.id)"
            class="pattern-btn"
            :title="pattern.description"
          >
            {{ pattern.name }}
          </button>
        </div>
        <p class="pattern-description">{{ currentPatternDescription }}</p>
      </div>

      <div class="background-sound">
        <label>选择背景音：</label>
        <select v-model="selectedSound">
          <option value="rain">雨声</option>
          <option value="ocean">海浪声</option>
          <option value="fire">篝火声</option>
          <option value="none">无背景音</option>
        </select>
      </div>

      <!-- 语音引导开关 -->
      <div class="voice-guide">
        <label class="toggle-label">
          <input type="checkbox" v-model="voiceGuideEnabled" />
          <span class="toggle-slider"></span>
          <span class="toggle-text">语音引导</span>
        </label>
      </div>

      <button @click="startBreathing" class="game-btn start-btn">
        开始冥想
      </button>
    </div>

    <!-- 游戏界面 -->
    <div class="game-container" v-if="isGameStarted && !gameFinished">
      <div class="timer-display">
        <span>{{ formattedTime }}</span>
      </div>

      <div class="breathing-circle-container">
        <div
          class="breathing-circle"
          :class="breathingPhase"
          :style="{ transform: `scale(${circleScale})` }"
        >
          <div class="breathing-instruction">
            {{ breathingInstruction }}
          </div>
          <div class="breathing-count">{{ breathingCount }}</div>
        </div>
      </div>

      <div class="breathing-progress">
        <div class="progress-bar">
          <div
            class="progress-fill"
            :style="{ width: progressPercentage + '%' }"
          ></div>
        </div>
      </div>

      <button @click="pauseBreathing" class="game-btn pause-btn">
        {{ isPaused ? "继续" : "暂停" }}
      </button>
      <button @click="stopBreathing" class="game-btn stop-btn">停止</button>
    </div>

    <!-- 冥想报告 -->
    <div class="meditation-report" v-if="gameFinished">
      <h4>🧘 冥想报告</h4>
      <div class="report-content">
        <div class="report-card main-stats">
          <div class="stat-item">
            <span class="stat-icon">🎯</span>
            <span class="stat-label">专注度</span>
            <span class="stat-value">{{ focusLevel }}%</span>
          </div>
          <div class="stat-item">
            <span class="stat-icon">💓</span>
            <span class="stat-label">平均心率</span>
            <span class="stat-value">{{ averageHeartRate }} bpm</span>
          </div>
        </div>

        <div class="report-card breathing-details">
          <h5>呼吸统计</h5>
          <div class="detail-row">
            <span>呼吸模式：</span>
            <span class="highlight">{{ currentPatternName }}</span>
          </div>
          <div class="detail-row">
            <span>吸气次数：</span>
            <span class="highlight">{{ inhaleCount }} 次</span>
          </div>
          <div class="detail-row">
            <span>呼气次数：</span>
            <span class="highlight">{{ exhaleCount }} 次</span>
          </div>
          <div class="detail-row">
            <span>平均呼吸频率：</span>
            <span class="highlight">{{ breathingRate }} 次/分钟</span>
          </div>
        </div>

        <div class="report-card rhythm-info">
          <div class="rhythm-stability">
            <span class="label">呼吸节奏稳定性：</span>
            <span class="value" :class="rhythmClass">{{
              rhythmStability
            }}</span>
          </div>
        </div>

        <div class="report-card achievement-card">
          <div class="achievement">
            <span class="achievement-icon">🏆</span>
            <span class="achievement-text">{{ achievement }}</span>
          </div>
        </div>

        <div class="report-card time-stats">
          <div class="time-row">
            <span>计划时长：</span>
            <span>{{ selectedDuration }} 分钟</span>
          </div>
          <div class="time-row">
            <span>实际时长：</span>
            <span class="highlight">{{ actualDuration }} 分钟</span>
          </div>
        </div>
      </div>
      <button @click="restartGame" class="game-btn restart-btn">
        🔄 重新开始
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from "vue";
import useRelaxStore from "@/stores/relaxStore";
import useAchievementStore from "@/stores/achievementStore";

// 游戏状态
const isGameStarted = ref(false);
const isPaused = ref(false);
const gameFinished = ref(false);
const selectedDuration = ref(3); // 默认3分钟
const selectedSound = ref("rain");
const selectedPattern = ref("relax");
const voiceGuideEnabled = ref(false);
const startTime = ref(new Date().toISOString());

const relaxStore = useRelaxStore();
const achievementStore = useAchievementStore();

// 音频元素引用
const audioElement = ref<HTMLAudioElement | null>(null);

// 游戏配置
const durations = [3, 5, 10]; // 可选时长（分钟）

// 呼吸模式配置
const breathingPatterns = [
  {
    id: "relax",
    name: "放松呼吸",
    description: "4-7-8呼吸法：吸气4秒，屏息7秒，呼气8秒，帮助放松和入睡",
    cycle: { inhale: 4, hold: 7, exhale: 8, pause: 0 },
  },
  {
    id: "box",
    name: "箱式呼吸",
    description:
      "4-4-4-4呼吸法：吸气4秒，屏息4秒，呼气4秒，休息4秒，提升专注力",
    cycle: { inhale: 4, hold: 4, exhale: 4, pause: 4 },
  },
  {
    id: "energy",
    name: "活力呼吸",
    description: "2-0-2-0呼吸法：快速吸气和呼气，提升能量和警觉性",
    cycle: { inhale: 2, hold: 0, exhale: 2, pause: 0 },
  },
  {
    id: "balance",
    name: "平衡呼吸",
    description: "5-0-5-0呼吸法：吸气和呼气各5秒，平衡身心状态",
    cycle: { inhale: 5, hold: 0, exhale: 5, pause: 0 },
  },
];

// 当前呼吸周期
const breathingCycle = computed(() => {
  const pattern = breathingPatterns.find((p) => p.id === selectedPattern.value);
  return pattern ? pattern.cycle : breathingPatterns[0].cycle;
});

// 呼吸状态
const remainingTime = ref(selectedDuration.value * 60);
const breathingPhase = ref("inhale"); // inhale, hold, exhale, pause
const breathingCount = ref(0);
const circleScale = ref(1);
const sessionStartTime = ref(0);
const elapsedTime = ref(0);

// 游戏循环
let gameLoop: number | null = null;
let lastUpdateTime: number = 0; // 用于呼吸动画的时间跟踪
let timeUpdateTime: number = 0; // 用于时间显示的时间跟踪
let phaseTimer: number = 0; // 当前呼吸阶段的计时（毫秒）
let currentPhaseTime: number = 0;

// 冥想报告数据
const focusLevel = ref(0);
const rhythmStability = ref("");
const achievement = ref("");
const actualDuration = ref(0);
const averageHeartRate = ref(0);
const inhaleCount = ref(0);
const exhaleCount = ref(0);
const breathingRate = ref(0);

// 计算属性
const currentPatternDescription = computed(() => {
  const pattern = breathingPatterns.find((p) => p.id === selectedPattern.value);
  return pattern ? pattern.description : "";
});

const currentPatternName = computed(() => {
  const pattern = breathingPatterns.find((p) => p.id === selectedPattern.value);
  return pattern ? pattern.name : "";
});

const rhythmClass = computed(() => {
  if (focusLevel.value >= 90) return "excellent";
  if (focusLevel.value >= 80) return "good";
  return "normal";
});

// 计算属性
const formattedTime = computed(() => {
  const minutes = Math.floor(remainingTime.value / 60);
  const seconds = remainingTime.value % 60;
  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
});

const progressPercentage = computed(() => {
  const totalTime = selectedDuration.value * 60;
  return ((totalTime - remainingTime.value) / totalTime) * 100;
});

const breathingInstruction = computed(() => {
  switch (breathingPhase.value) {
    case "inhale":
      return "吸气";
    case "hold":
      return "屏息";
    case "exhale":
      return "呼气";
    case "pause":
      return "休息";
    default:
      return "吸气";
  }
});

// 选择时长
const selectDuration = (duration: number) => {
  selectedDuration.value = duration;
  remainingTime.value = duration * 60;
};

// 选择呼吸模式
const selectPattern = (patternId: string) => {
  selectedPattern.value = patternId;
};

// 播放背景音
const playBackgroundSound = () => {
  if (selectedSound.value === "none") return;

  const soundMap: Record<string, string> = {
    rain: "/audio/rain.mp3",
    ocean: "/audio/ocean.mp3",
    fire: "/audio/fire.mp3",
  };

  const audioPath = soundMap[selectedSound.value];
  if (!audioPath) return;

  audioElement.value = new Audio(audioPath);
  audioElement.value.loop = true;
  audioElement.value.volume = 0.3;
  audioElement.value.play().catch((err) => {
    console.warn("背景音播放失败:", err);
  });
};

// 停止背景音
const stopBackgroundSound = () => {
  if (audioElement.value) {
    audioElement.value.pause();
    audioElement.value.currentTime = 0;
    audioElement.value = null;
  }
};

// 语音引导
const speakGuidance = (text: string) => {
  if (!voiceGuideEnabled.value) return;

  // 使用Web Speech API
  if ("speechSynthesis" in window) {
    // 取消之前的语音
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "zh-CN";
    utterance.rate = 0.8;
    utterance.pitch = 1;
    window.speechSynthesis.speak(utterance);
  }
};

// 更新呼吸状态
const updateBreathing = (deltaTime: number) => {
  if (isPaused.value) return;

  phaseTimer += deltaTime;

  // 更新呼吸计数（转换为秒）
  breathingCount.value = Math.floor(phaseTimer / 1000);

  // 更新呼吸阶段
  const currentPhaseSeconds =
    breathingCycle.value[
      breathingPhase.value as keyof typeof breathingCycle.value
    ];
  if (breathingCount.value >= currentPhaseSeconds) {
    // 切换到下一个呼吸阶段
    const previousPhase = breathingPhase.value;
    switch (breathingPhase.value) {
      case "inhale":
        breathingPhase.value = "hold";
        inhaleCount.value++;
        speakGuidance("屏息");
        break;
      case "hold":
        breathingPhase.value = "exhale";
        speakGuidance("呼气");
        break;
      case "exhale":
        exhaleCount.value++;
        if (breathingCycle.value.pause > 0) {
          breathingPhase.value = "pause";
          speakGuidance("休息");
        } else {
          breathingPhase.value = "inhale";
          speakGuidance("吸气");
        }
        break;
      case "pause":
        breathingPhase.value = "inhale";
        speakGuidance("吸气");
        break;
    }

    // 重置阶段计时器
    phaseTimer = 0;
    breathingCount.value = 0;
    currentPhaseTime =
      breathingCycle.value[
        breathingPhase.value as keyof typeof breathingCycle.value
      ];
  }

  // 更新呼吸球缩放
  const progress = phaseTimer / 1000 / currentPhaseSeconds;
  if (breathingPhase.value === "inhale") {
    circleScale.value = 1 + progress * 0.5; // 膨胀到1.5倍
  } else if (breathingPhase.value === "exhale") {
    circleScale.value = 1.5 - progress * 0.5; // 收缩回1倍
  }
};

// 开始冥想
const startBreathing = () => {
  isGameStarted.value = true;
  isPaused.value = false;
  gameFinished.value = false;
  remainingTime.value = selectedDuration.value * 60;
  breathingPhase.value = "inhale";
  breathingCount.value = 0;
  circleScale.value = 1;
  phaseTimer = 0;
  currentPhaseTime = breathingCycle.value.inhale;
  startTime.value = new Date().toISOString(); // 重置开始时间
  sessionStartTime.value = Date.now();
  lastUpdateTime = 0;
  timeUpdateTime = 0; // 重置时间更新定时器

  // 重置呼吸统计
  inhaleCount.value = 0;
  exhaleCount.value = 0;

  // 播放背景音
  playBackgroundSound();

  // 播放初始语音引导
  speakGuidance("开始吸气");

  // 开始游戏循环
  if (gameLoop) cancelAnimationFrame(gameLoop);
  gameLoop = requestAnimationFrame(gameStep);
};

// 游戏循环步骤
const gameStep = (timestamp: number) => {
  if (isPaused.value) {
    gameLoop = requestAnimationFrame(gameStep);
    return;
  }

  // 计算时间差
  if (lastUpdateTime === 0) {
    lastUpdateTime = timestamp;
  }
  const deltaTime = timestamp - lastUpdateTime;
  lastUpdateTime = timestamp;

  updateBreathing(deltaTime);

  // 简化时间更新逻辑：每1000毫秒减少1秒
  if (timeUpdateTime === 0) {
    timeUpdateTime = timestamp;
  }

  if (timestamp - timeUpdateTime >= 1000) {
    remainingTime.value = Math.max(0, remainingTime.value - 1);
    timeUpdateTime = timestamp;
  }

  // 检查冥想结束
  if (remainingTime.value <= 0) {
    endBreathing();
    return;
  }

  gameLoop = requestAnimationFrame(gameStep);
};

// 暂停冥想
const pauseBreathing = () => {
  isPaused.value = !isPaused.value;

  // 当恢复时，重置时间更新定时器的基准时间
  if (!isPaused.value) {
    timeUpdateTime = performance.now();
  }
};

// 停止冥想
const stopBreathing = () => {
  if (gameLoop) {
    cancelAnimationFrame(gameLoop);
    gameLoop = null;
  }
  // 停止背景音
  stopBackgroundSound();
  // 停止语音
  if ("speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }
  isGameStarted.value = false;
  gameFinished.value = true;
  generateMeditationReport();
  saveRelaxRecord();
};

// 结束冥想
const endBreathing = async () => {
  if (gameLoop) {
    cancelAnimationFrame(gameLoop);
    gameLoop = null;
  }
  // 停止背景音
  stopBackgroundSound();
  // 停止语音
  if ("speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }
  isGameStarted.value = false;
  gameFinished.value = true;

  // 计算实际经过时间
  const totalSeconds = selectedDuration.value * 60;
  const adjustedElapsedTime = (totalSeconds - remainingTime.value) * 1000;
  elapsedTime.value = adjustedElapsedTime;
  actualDuration.value = Math.floor(elapsedTime.value / 60000);

  generateMeditationReport();
  await saveRelaxRecord();
};

// 保存放松记录
const saveRelaxRecord = async () => {
  const endTime = new Date().toISOString();
  await relaxStore.saveRecord({
    activityType: "breathing",
    startTime: startTime.value,
    endTime: endTime,
    metrics: {
      focusLevel: focusLevel.value,
      rhythmStability: rhythmStability.value,
      actualDuration: actualDuration.value,
      selectedDuration: selectedDuration.value,
    },
  });
  // 检查成就
  await achievementStore.checkAchievements();
};

// 生成冥想报告
const generateMeditationReport = () => {
  // 模拟生成专注度（80-95%）
  focusLevel.value = Math.floor(Math.random() * 16) + 80;

  // 模拟平均心率（60-80 bpm）
  averageHeartRate.value = Math.floor(Math.random() * 21) + 60;

  // 计算呼吸频率（次/分钟）
  const totalBreaths = inhaleCount.value;
  const minutes = actualDuration.value || 1;
  breathingRate.value = Math.round(totalBreaths / minutes);

  // 呼吸节奏稳定性
  if (focusLevel.value >= 90) {
    rhythmStability.value = "非常稳定";
  } else if (focusLevel.value >= 80) {
    rhythmStability.value = "稳定";
  } else {
    rhythmStability.value = "一般";
  }

  // 成就
  if (focusLevel.value >= 95) {
    achievement.value = "冥想大师！继续保持这等专注！";
  } else if (focusLevel.value >= 90) {
    achievement.value = "太棒了！您的专注力非常出色！";
  } else if (focusLevel.value >= 85) {
    achievement.value = "很好！呼吸节奏保持得不错！";
  } else {
    achievement.value = "继续练习，专注度会逐渐提升！";
  }
};

// 重新开始
const restartGame = () => {
  gameFinished.value = false;
};

// 组件卸载时清理
onUnmounted(() => {
  if (gameLoop) {
    cancelAnimationFrame(gameLoop);
    gameLoop = null;
  }
  // 停止背景音
  stopBackgroundSound();
  // 停止语音
  if ("speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }
});
</script>

<style scoped lang="scss">
.breathing-guide {
  padding: 16px;
  text-align: center;

  .game-settings {
    margin: 20px 0;

    .duration-selector {
      margin-bottom: 20px;

      label {
        display: block;
        margin-bottom: 10px;
        font-weight: 500;
        color: #333;
      }

      .duration-options {
        display: flex;
        justify-content: center;
        gap: 15px;

        .duration-btn {
          padding: 10px 20px;
          border: 2px solid #42b983;
          border-radius: 25px;
          background: #fff;
          color: #42b983;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.3s ease;

          &.active {
            background: #42b983;
            color: #fff;
          }

          &:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(66, 185, 131, 0.2);
          }
        }
      }
    }

    .breathing-pattern {
      margin-bottom: 20px;

      label {
        display: block;
        margin-bottom: 10px;
        font-weight: 500;
        color: #333;
      }

      .pattern-options {
        display: flex;
        justify-content: center;
        gap: 10px;
        flex-wrap: wrap;
        margin-bottom: 10px;

        .pattern-btn {
          padding: 8px 16px;
          border: 2px solid #42b983;
          border-radius: 20px;
          background: #fff;
          color: #42b983;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.3s ease;

          &.active {
            background: #42b983;
            color: #fff;
          }

          &:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(66, 185, 131, 0.2);
          }
        }
      }

      .pattern-description {
        font-size: 13px;
        color: #666;
        margin: 0;
        padding: 0 20px;
      }
    }

    .background-sound {
      margin-bottom: 20px;

      label {
        margin-right: 10px;
        font-weight: 500;
        color: #333;
      }

      select {
        padding: 8px 12px;
        border: 1px solid #ddd;
        border-radius: 4px;
        background: #fff;
        font-size: 14px;
      }
    }

    .voice-guide {
      margin-bottom: 20px;

      .toggle-label {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 10px;
        cursor: pointer;

        input {
          display: none;
        }

        .toggle-slider {
          width: 50px;
          height: 26px;
          background: #ccc;
          border-radius: 13px;
          position: relative;
          transition: background 0.3s;

          &::before {
            content: "";
            position: absolute;
            width: 22px;
            height: 22px;
            background: white;
            border-radius: 50%;
            top: 2px;
            left: 2px;
            transition: transform 0.3s;
          }
        }

        input:checked + .toggle-slider {
          background: #42b983;

          &::before {
            transform: translateX(24px);
          }
        }

        .toggle-text {
          font-weight: 500;
          color: #333;
        }
      }
    }
  }

  .game-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 20px;
    margin: 30px 0;

    .timer-display {
      font-size: 48px;
      font-weight: bold;
      color: #42b983;
      text-shadow: 0 2px 8px rgba(66, 185, 131, 0.3);
    }

    .breathing-circle-container {
      width: 300px;
      height: 300px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: radial-gradient(circle, rgba(66, 185, 131, 0.1), transparent);
      border-radius: 50%;

      .breathing-circle {
        width: 200px;
        height: 200px;
        border-radius: 50%;
        background: linear-gradient(135deg, #42b983, #359469);
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        color: white;
        font-weight: bold;
        transition: transform 0.3s ease;
        box-shadow: 0 10px 30px rgba(66, 185, 131, 0.4);

        .breathing-instruction {
          font-size: 24px;
          margin-bottom: 10px;
        }

        .breathing-count {
          font-size: 48px;
        }
      }
    }

    .breathing-progress {
      width: 100%;
      max-width: 400px;

      .progress-bar {
        height: 8px;
        background: #e9ecef;
        border-radius: 4px;
        overflow: hidden;

        .progress-fill {
          height: 100%;
          background: linear-gradient(90deg, #42b983, #359469);
          transition: width 0.3s ease;
        }
      }
    }
  }

  .meditation-report {
    margin: 30px auto;
    padding: 30px;
    max-width: 600px;
    background: linear-gradient(135deg, #f8f9fa, #e9ecef);
    border-radius: 20px;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.1);

    h4 {
      margin: 0 0 25px 0;
      color: #333;
      font-size: 28px;
      text-align: center;
    }

    .report-content {
      display: flex;
      flex-direction: column;
      gap: 15px;

      .report-card {
        background: rgba(255, 255, 255, 0.9);
        border-radius: 12px;
        padding: 20px;
        box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);

        h5 {
          margin: 0 0 15px 0;
          color: #333;
          font-size: 16px;
          font-weight: 600;
        }
      }

      .main-stats {
        display: flex;
        justify-content: space-around;
        gap: 20px;

        .stat-item {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;

          .stat-icon {
            font-size: 32px;
          }

          .stat-label {
            font-size: 14px;
            color: #666;
          }

          .stat-value {
            font-size: 24px;
            font-weight: bold;
            color: #42b983;
          }
        }
      }

      .breathing-details {
        .detail-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 10px 0;
          border-bottom: 1px solid #eee;

          &:last-child {
            border-bottom: none;
          }

          span:first-child {
            color: #666;
          }

          .highlight {
            font-weight: 600;
            color: #42b983;
          }
        }
      }

      .rhythm-info {
        .rhythm-stability {
          display: flex;
          justify-content: space-between;
          align-items: center;

          .label {
            color: #666;
          }

          .value {
            font-weight: bold;
            padding: 5px 15px;
            border-radius: 20px;

            &.excellent {
              background: #d4edda;
              color: #155724;
            }

            &.good {
              background: #fff3cd;
              color: #856404;
            }

            &.normal {
              background: #f8d7da;
              color: #721c24;
            }
          }
        }
      }

      .achievement-card {
        .achievement {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 10px;
          text-align: center;

          .achievement-icon {
            font-size: 40px;
          }

          .achievement-text {
            font-size: 16px;
            font-weight: 600;
            color: #3498db;
          }
        }
      }

      .time-stats {
        .time-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 8px 0;

          span:first-child {
            color: #666;
          }

          .highlight {
            font-weight: 600;
            color: #42b983;
          }
        }
      }
    }
  }

  .game-btn {
    padding: 10px 20px;
    border: none;
    border-radius: 25px;
    font-weight: 500;
    font-size: 16px;
    cursor: pointer;
    transition: all 0.3s ease;
    margin: 5px;

    &:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    }
  }

  .start-btn {
    background: #42b983;
    color: white;

    &:hover {
      background: #359469;
    }
  }

  .pause-btn {
    background: #f39c12;
    color: white;

    &:hover {
      background: #e67e22;
    }
  }

  .stop-btn {
    background: #e74c3c;
    color: white;

    &:hover {
      background: #c0392b;
    }
  }

  .restart-btn {
    background: #3498db;
    color: white;

    &:hover {
      background: #2980b9;
    }
  }
}
</style>
