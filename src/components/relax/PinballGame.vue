<template>
  <div class="pinball-game">
    <h3>物理弹球 - 砖块破坏者</h3>

    <!-- 游戏设置 -->
    <div class="game-settings" v-if="!isGameStarted && !gameOver">
      <div class="difficulty-selector">
        <label>选择难度：</label>
        <select v-model="selectedDifficulty">
          <option value="easy">简单（10块砖）</option>
          <option value="medium">中等（20块砖）</option>
          <option value="hard">困难（30块砖）</option>
        </select>
      </div>
      <button @click="startGame" class="game-btn start-btn">开始游戏</button>
    </div>

    <!-- 游戏界面 -->
    <div
      class="game-container"
      ref="gameContainer"
      v-if="isGameStarted && !gameOver"
    >
      <div class="ball" ref="ball"></div>
      <div class="paddle" ref="paddle"></div>
      <!-- 砖块 -->
      <div
        v-for="(brick, index) in bricks"
        :key="index"
        class="brick"
        :style="{
          left: brick.x + 'px',
          top: brick.y + 'px',
          display: brick.visible ? 'block' : 'none',
        }"
        ref="brickRefs"
      ></div>

      <!-- 分数显示 -->
      <div class="score-display">分数：{{ score }}</div>
      <div class="bricks-destroyed">
        已破坏砖块：{{ destroyedBricks }}/{{ totalBricks }}
      </div>
    </div>

    <!-- 暂停和关闭按钮 -->
    <div class="game-controls" v-if="isGameStarted && !gameOver">
      <button @click="togglePause" class="game-btn pause-btn">
        {{ isPaused ? "继续" : "暂停" }}
      </button>
      <button @click="closeGame" class="game-btn close-btn">关闭游戏</button>
    </div>

    <!-- 游戏结束 -->
    <div class="game-over" v-if="gameOver">
      <h4>游戏结束！</h4>
      <div class="final-score">解压得分：{{ finalScore }}</div>
      <div class="bricks-stats">共破坏砖块：{{ destroyedBricks }}</div>
      <div class="game-over-buttons">
        <button @click="restartGame" class="game-btn restart-btn">
          重新开始
        </button>
        <button @click="closeGame" class="game-btn close-btn">关闭游戏</button>
      </div>
    </div>

    <!-- 提示信息 -->
    <div class="game-message" v-if="showMessage">
      {{ message }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, nextTick } from "vue";
import useRelaxStore from "@/stores/relaxStore";
import useAchievementStore from "@/stores/achievementStore";
import soundManager from "@/utils/sound";

// 游戏容器和元素引用
const gameContainer = ref<HTMLElement | null>(null);
const ball = ref<HTMLElement | null>(null);
const paddle = ref<HTMLElement | null>(null);
const brickRefs = ref<HTMLElement[]>([]);

// 游戏状态
const isGameStarted = ref(false);
const gameOver = ref(false);
const isPaused = ref(false);
const selectedDifficulty = ref<"easy" | "medium" | "hard">("easy");
const score = ref(0);
const destroyedBricks = ref(0);
const totalBricks = ref(0);
const finalScore = ref(0);
const showMessage = ref(false);
const message = ref("");
const startTime = ref(new Date().toISOString());

const relaxStore = useRelaxStore();
const achievementStore = useAchievementStore();

// 小球属性
let ballX = 0;
let ballY = 0;
let dx = 2;
let dy = -2;
let gameLoop: number | null = null;

// 砖块数据结构
interface Brick {
  x: number;
  y: number;
  visible: boolean;
}

const bricks = ref<Brick[]>([]);

// 难度配置
const difficultyConfig = {
  easy: { bricks: 10, speed: 2 },
  medium: { bricks: 20, speed: 3 },
  hard: { bricks: 30, speed: 4 },
};

// 显示提示信息
const showPressureReductionMessage = () => {
  message.value = `压力-5`;
  showMessage.value = true;
  setTimeout(() => {
    showMessage.value = false;
  }, 1500);
};

// 生成砖块
const generateBricks = () => {
  const config = difficultyConfig[selectedDifficulty.value];
  totalBricks.value = config.bricks;

  if (!gameContainer.value) return;

  const containerWidth = gameContainer.value.offsetWidth;
  const brickWidth = 60;
  const brickHeight = 25;
  const padding = 10;
  const rows = Math.ceil(config.bricks / 5);
  const cols = 5;

  bricks.value = [];

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const index = row * cols + col;
      if (index >= config.bricks) break;

      const x = col * (brickWidth + padding) + padding;
      const y = row * (brickHeight + padding) + padding + 40;

      bricks.value.push({
        x,
        y,
        visible: true,
      });
    }
  }
};

// 初始化游戏
onMounted(() => {
  if (gameContainer.value && paddle.value) {
    paddle.value.style.left = `${gameContainer.value.offsetWidth / 2 - 40}px`;
  }

  // 监听鼠标移动控制挡板
  window.addEventListener("mousemove", (e) => {
    if (
      gameContainer.value &&
      paddle.value &&
      isGameStarted.value &&
      !gameOver.value
    ) {
      const containerRect = gameContainer.value.getBoundingClientRect();
      let paddleX = e.clientX - containerRect.left - 40;
      if (paddleX < 0) paddleX = 0;
      if (paddleX > containerRect.width - 80) {
        paddleX = containerRect.width - 80;
      }
      paddle.value.style.left = `${paddleX}px`;
    }
  });
});

// 开始游戏
const startGame = async () => {
  isGameStarted.value = true;
  gameOver.value = false;
  score.value = 0;
  destroyedBricks.value = 0;
  startTime.value = new Date().toISOString(); // 重置开始时间

  // 等待DOM更新，确保游戏容器和元素已经渲染
  await nextTick();

  if (!gameContainer.value || !ball.value || !paddle.value) return;

  // 初始化小球位置
  ballX = gameContainer.value.offsetWidth / 2;
  ballY = gameContainer.value.offsetHeight - 60;

  // 设置小球速度
  const config = difficultyConfig[selectedDifficulty.value];
  dx = config.speed * (Math.random() > 0.5 ? 1 : -1);
  dy = -config.speed;

  // 生成砖块
  generateBricks();

  // 开始游戏循环
  if (gameLoop) cancelAnimationFrame(gameLoop);
  gameLoop = requestAnimationFrame(updateGame);
};

// 更新游戏状态
const updateGame = () => {
  if (!gameContainer.value || !ball.value || !paddle.value) return;

  if (!isPaused.value) {
    // 更新小球位置
    ballX += dx;
    ballY += dy;

    const containerRect = gameContainer.value.getBoundingClientRect();
    const paddleRect = paddle.value.getBoundingClientRect();

    // 边界碰撞检测
    if (ballX < 0 || ballX > containerRect.width - 20) {
      dx = -dx;
      ballX = ballX < 0 ? 0 : containerRect.width - 20;
    }

    if (ballY < 0) {
      dy = -dy;
      ballY = 0;
    }

    // 挡板碰撞检测
    if (
      ballY > containerRect.height - 40 &&
      ballX > paddleRect.left - containerRect.left &&
      ballX < paddleRect.right - containerRect.left
    ) {
      dy = -dy;
      // 播放音效
      soundManager.playSound("paddleHit");
      // 让小球反弹角度与撞击挡板位置有关
      const hitPosition = (ballX - (paddleRect.left - containerRect.left)) / 80;
      dx = (hitPosition - 0.5) * 6;
    }

    // 砖块碰撞检测
    bricks.value.forEach((brick, index) => {
      if (!brick.visible) return;

      const brickX = brick.x;
      const brickY = brick.y;
      const brickWidth = 60;
      const brickHeight = 25;

      if (
        ballX + 20 > brickX &&
        ballX < brickX + brickWidth &&
        ballY + 20 > brickY &&
        ballY < brickY + brickHeight
      ) {
        dy = -dy;
        // 播放音效
        soundManager.playSound("brickBreak");
        brick.visible = false;
        destroyedBricks.value++;
        score.value += 10;

        // 每破坏10块砖显示压力减少提示
        if (destroyedBricks.value % 10 === 0) {
          showPressureReductionMessage();
        }

        // 检查是否所有砖块都被破坏
        if (destroyedBricks.value === totalBricks.value) {
          endGame();
          return;
        }
      }
    });

    // 游戏结束条件
    if (ballY > containerRect.height) {
      endGame();
      return;
    }

    // 更新小球位置
    ball.value.style.left = `${ballX}px`;
    ball.value.style.top = `${ballY}px`;
  }

  // 只有在游戏未结束时才继续游戏循环
  if (!gameOver.value) {
    gameLoop = requestAnimationFrame(updateGame);
  }
};

// 结束游戏
const endGame = async () => {
  gameOver.value = true;
  isGameStarted.value = false;
  finalScore.value = destroyedBricks.value * 2; // 破坏砖块数 × 2 作为解压得分

  // 播放游戏结束音效
  soundManager.playSound("gameOver");

  if (gameLoop) {
    cancelAnimationFrame(gameLoop);
    gameLoop = null;
  }

  // 确保游戏结束页面保持显示
  console.log("游戏结束，显示结束页面");
  await saveRelaxRecord();
};

// 保存放松记录
const saveRelaxRecord = async () => {
  const endTime = new Date().toISOString();
  await relaxStore.saveRecord({
    activityType: "pinball",
    startTime: startTime.value,
    endTime: endTime,
    metrics: {
      finalScore: finalScore.value,
      destroyedBricks: destroyedBricks.value,
      totalBricks: totalBricks.value,
      difficulty: selectedDifficulty.value,
    },
  });
  // 检查成就
  await achievementStore.checkAchievements();
};

// 暂停/继续游戏
const togglePause = () => {
  isPaused.value = !isPaused.value;
};

// 关闭游戏
const closeGame = () => {
  gameOver.value = false;
  isGameStarted.value = false;
  isPaused.value = false;
  score.value = 0;
  destroyedBricks.value = 0;
  finalScore.value = 0;
  bricks.value = [];

  if (gameLoop) {
    cancelAnimationFrame(gameLoop);
    gameLoop = null;
  }
};

// 重新开始游戏
const restartGame = () => {
  gameOver.value = false;
  isGameStarted.value = false;
  score.value = 0;
  destroyedBricks.value = 0;
  finalScore.value = 0;
  bricks.value = [];
};
</script>

<style scoped lang="scss">
.pinball-game {
  padding: 16px;
  text-align: center;

  .game-settings {
    margin: 20px 0;

    .difficulty-selector {
      margin-bottom: 15px;

      label {
        margin-right: 10px;
        font-weight: 500;
        color: #333;
      }

      select {
        padding: 6px 10px;
        border: 1px solid #ddd;
        border-radius: 4px;
        background: #fff;
        font-size: 14px;
      }
    }
  }

  .game-container {
    width: 400px;
    height: 500px;
    background: linear-gradient(180deg, #f5f7fa 0%, #e9ecef 100%);
    border: 3px solid #42b983;
    border-radius: 10px;
    position: relative;
    margin: 0 auto;
    overflow: hidden;
    box-shadow: 0 4px 15px rgba(66, 185, 131, 0.15);

    .ball {
      width: 20px;
      height: 20px;
      background: linear-gradient(45deg, #42b983, #359469);
      border-radius: 50%;
      position: absolute;
      top: 0;
      left: 0;
      box-shadow: 0 2px 8px rgba(66, 185, 131, 0.3);
    }

    .paddle {
      width: 80px;
      height: 15px;
      background: linear-gradient(45deg, #3498db, #2980b9);
      border-radius: 8px;
      position: absolute;
      bottom: 10px;
      left: 0;
      box-shadow: 0 2px 6px rgba(52, 152, 219, 0.3);
    }

    .brick {
      width: 60px;
      height: 25px;
      background: linear-gradient(45deg, #ff6b6b, #ee5a24);
      border-radius: 4px;
      position: absolute;
      box-shadow: 0 2px 4px rgba(255, 107, 107, 0.3);
      transition: transform 0.2s ease;

      &:hover {
        transform: scale(1.05);
      }
    }

    .score-display {
      position: absolute;
      top: 10px;
      left: 10px;
      background: rgba(255, 255, 255, 0.8);
      padding: 5px 10px;
      border-radius: 4px;
      font-weight: 500;
      color: #333;
    }

    .bricks-destroyed {
      position: absolute;
      top: 10px;
      right: 10px;
      background: rgba(255, 255, 255, 0.8);
      padding: 5px 10px;
      border-radius: 4px;
      font-weight: 500;
      color: #333;
    }
  }

  .game-over {
    margin: 30px auto;
    padding: 30px;
    background: white;
    border-radius: 15px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
    width: 90%;
    max-width: 400px;
    text-align: center;
    position: relative;
    z-index: 10;

    h4 {
      margin: 0 0 20px 0;
      color: #333;
      font-size: 24px;
      font-weight: 600;
    }

    .final-score {
      font-size: 32px;
      font-weight: bold;
      color: #42b983;
      margin: 15px 0;
    }

    .bricks-stats {
      color: #666;
      margin-bottom: 25px;
      font-size: 18px;
    }
  }

  .game-btn {
    display: inline-block;
    padding: 10px 20px;
    border: none;
    border-radius: 6px;
    font-weight: 500;
    font-size: 16px;
    cursor: pointer;
    transition: all 0.3s ease;
    margin: 5px;
    min-width: 120px;

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

  .restart-btn {
    background: #3498db;
    color: white;

    &:hover {
      background: #2980b9;
    }
  }

  .close-btn {
    background: #e74c3c;
    color: white;

    &:hover {
      background: #c0392b;
    }
  }

  .game-over-buttons {
    display: flex;
    justify-content: center;
    gap: 15px;
  }

  .game-controls {
    display: flex;
    justify-content: center;
    gap: 15px;
    margin-top: 20px;
    padding: 10px;
  }

  .game-message {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: rgba(66, 185, 131, 0.9);
    color: white;
    padding: 15px 30px;
    border-radius: 25px;
    font-size: 24px;
    font-weight: bold;
    z-index: 1000;
    animation: fadeInOut 1.5s ease-in-out;
    box-shadow: 0 4px 20px rgba(66, 185, 131, 0.4);
  }
}

@keyframes fadeInOut {
  0% {
    opacity: 0;
    transform: translate(-50%, -50%) scale(0.8);
  }
  20% {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1.1);
  }
  80% {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1.1);
  }
  100% {
    opacity: 0;
    transform: translate(-50%, -50%) scale(0.8);
  }
}
</style>
