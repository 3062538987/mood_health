<template>
  <div class="tetris-game">
    <h3>俄罗斯方块</h3>

    <!-- 游戏设置 -->
    <div class="game-settings" v-if="!isGameStarted && !gameOver">
      <div class="speed-selector">
        <label>游戏速度：</label>
        <select v-model="selectedSpeed">
          <option value="1">1档（慢速）</option>
          <option value="2">2档</option>
          <option value="3">3档（中速）</option>
          <option value="4">4档</option>
          <option value="5">5档（快速）</option>
        </select>
      </div>
      <div class="controls-info">
        <p>控制说明：</p>
        <p>← → 左右移动 | ↓ 加速下落 | ↑ 旋转</p>
        <p>空格键 暂停/继续</p>
      </div>
      <button @click="startGame" class="game-btn start-btn">开始游戏</button>
    </div>

    <!-- 游戏界面 -->
    <div class="game-container" v-if="isGameStarted && !gameOver">
      <div class="game-area">
        <!-- 游戏网格 -->
        <div class="game-grid">
          <div
            v-for="(cell, index) in gameGrid"
            :key="index"
            class="grid-cell"
            :class="{ filled: cell }"
          ></div>
        </div>

        <!-- 分数和统计 -->
        <div class="game-stats">
          <div class="stat-item">
            <label>分数：</label>
            <span>{{ score }}</span>
          </div>
          <div class="stat-item">
            <label>消除行数：</label>
            <span>{{ linesCleared }}</span>
          </div>
          <div class="stat-item">
            <label>等级：</label>
            <span>{{ level }}</span>
          </div>
          <div class="stat-item">
            <label>当前速度：</label>
            <span>{{ currentSpeed }}档</span>
          </div>
        </div>

        <!-- 暂停和关闭按钮 -->
        <div class="game-controls">
          <button @click="togglePause" class="game-btn pause-btn">
            {{ isPaused ? "继续" : "暂停" }}
          </button>
          <button @click="closeGame" class="game-btn close-btn">
            关闭游戏
          </button>
        </div>
      </div>

      <!-- 下一个方块预览 -->
      <div class="next-piece">
        <h5>下一个方块</h5>
        <div class="next-piece-grid">
          <div
            v-for="(cell, index) in nextPieceGrid"
            :key="index"
            class="grid-cell"
            :class="{ filled: cell }"
          ></div>
        </div>
      </div>
    </div>

    <!-- 游戏结束 -->
    <div class="game-over" v-if="gameOver">
      <h4>游戏结束！</h4>
      <div class="final-score">最终分数：{{ score }}</div>
      <div class="lines-stats">共消除行数：{{ linesCleared }}</div>
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
import { ref, onMounted, onUnmounted, computed } from "vue";
import useRelaxStore from "@/stores/relaxStore";
import useAchievementStore from "@/stores/achievementStore";
import soundManager from "@/utils/sound";

// 游戏常量
const GRID_WIDTH = 10;
const GRID_HEIGHT = 20;
const NEXT_PIECE_GRID_SIZE = 4;

// 方块形状定义
const TETROMINOS = {
  I: [[1, 1, 1, 1]],
  O: [
    [1, 1],
    [1, 1],
  ],
  T: [
    [0, 1, 0],
    [1, 1, 1],
  ],
  L: [
    [1, 0, 0],
    [1, 1, 1],
  ],
  J: [
    [0, 0, 1],
    [1, 1, 1],
  ],
  S: [
    [0, 1, 1],
    [1, 1, 0],
  ],
  Z: [
    [1, 1, 0],
    [0, 1, 1],
  ],
};

// 方块颜色
const TETROMINO_COLORS = {
  I: "#00FFFF",
  O: "#FFFF00",
  T: "#800080",
  L: "#FFA500",
  J: "#0000FF",
  S: "#00FF00",
  Z: "#FF0000",
};

// 游戏状态
const isGameStarted = ref(false);
const gameOver = ref(false);
const isPaused = ref(false);
const selectedSpeed = ref(3);
const currentSpeed = ref(3);
const score = ref(0);
const linesCleared = ref(0);
const level = ref(1);
const showMessage = ref(false);
const message = ref("");
const startTime = ref(new Date().toISOString());

const relaxStore = useRelaxStore();
const achievementStore = useAchievementStore();

// 方块类型定义
interface Piece {
  shape: number[][];
  x: number;
  y: number;
  type: string;
}

// 游戏网格
const gameGrid = ref<number[]>(Array(GRID_WIDTH * GRID_HEIGHT).fill(0));
const nextPieceGrid = ref<number[]>(
  Array(NEXT_PIECE_GRID_SIZE * NEXT_PIECE_GRID_SIZE).fill(0),
);

// 当前方块
const currentPiece = ref<Piece>({ shape: TETROMINOS.I, x: 0, y: 0, type: "I" });
const nextPiece = ref<Piece>({ shape: TETROMINOS.O, x: 0, y: 0, type: "O" });

// 游戏循环
let gameLoop: number | null = null;
let dropInterval: number = 1000; // 初始下落间隔（毫秒）
let lastDropTime: number = 0;

// 按键状态
const keysPressed = ref<Set<string>>(new Set());

// 计算下落速度
const calculateDropInterval = (speed: number) => {
  // 速度1-5档对应下落间隔1000ms-200ms
  return 1200 - (speed - 1) * 250;
};

// 生成随机方块
const generateRandomPiece = (): Piece => {
  const types = Object.keys(TETROMINOS) as Array<keyof typeof TETROMINOS>;
  const randomType = types[Math.floor(Math.random() * types.length)];
  return {
    shape: TETROMINOS[randomType],
    type: randomType,
    x: 0,
    y: 0,
  };
};

// 在网格上绘制方块
const drawPiece = (
  piece: Piece,
  xOffset: number,
  yOffset: number,
  grid: number[],
) => {
  const newGrid = [...grid];
  piece.shape.forEach((row: number[], y: number) => {
    row.forEach((cell: number, x: number) => {
      if (cell) {
        const gridIndex = (y + yOffset) * GRID_WIDTH + (x + xOffset);
        if (gridIndex >= 0 && gridIndex < newGrid.length) {
          newGrid[gridIndex] = cell;
        }
      }
    });
  });
  return newGrid;
};

// 检查碰撞
const checkCollision = (piece: Piece, xOffset: number, yOffset: number) => {
  for (let y = 0; y < piece.shape.length; y++) {
    for (let x = 0; x < piece.shape[y].length; x++) {
      if (piece.shape[y][x]) {
        const newX = x + xOffset;
        const newY = y + yOffset;

        // 检查边界
        if (newX < 0 || newX >= GRID_WIDTH || newY >= GRID_HEIGHT) {
          return true;
        }

        // 检查是否与已有方块碰撞
        if (newY >= 0 && gameGrid.value[newY * GRID_WIDTH + newX]) {
          return true;
        }
      }
    }
  }
  return false;
};

// 移动方块
const movePiece = (dx: number, dy: number) => {
  if (
    checkCollision(
      currentPiece.value,
      currentPiece.value.x + dx,
      currentPiece.value.y + dy,
    )
  ) {
    if (dy > 0) {
      // 方块落地，锁定到网格
      lockPiece();
      clearLines();
      spawnNewPiece();
    }
    return false;
  }

  currentPiece.value.x += dx;
  currentPiece.value.y += dy;
  return true;
};

// 旋转方块
const rotatePiece = () => {
  const rotatedShape = currentPiece.value.shape[0].map((_, index) =>
    currentPiece.value.shape.map((row) => row[index]).reverse(),
  );

  const rotatedPiece = {
    ...currentPiece.value,
    shape: rotatedShape,
  };

  if (!checkCollision(rotatedPiece, rotatedPiece.x, rotatedPiece.y)) {
    currentPiece.value.shape = rotatedShape;
    // 播放旋转音效
    soundManager.playSound("tetrisRotate");
  }
};

// 锁定方块到网格
const lockPiece = () => {
  for (let y = 0; y < currentPiece.value.shape.length; y++) {
    for (let x = 0; x < currentPiece.value.shape[y].length; x++) {
      if (currentPiece.value.shape[y][x]) {
        const gridIndex =
          (y + currentPiece.value.y) * GRID_WIDTH + (x + currentPiece.value.x);
        if (gridIndex >= 0 && gridIndex < gameGrid.value.length) {
          gameGrid.value[gridIndex] = 1;
        }
      }
    }
  }
};

// 清除完整行
const clearLines = () => {
  let linesToClear: number[] = [];

  // 检查每一行
  for (let y = GRID_HEIGHT - 1; y >= 0; y--) {
    let isFullLine = true;
    for (let x = 0; x < GRID_WIDTH; x++) {
      if (!gameGrid.value[y * GRID_WIDTH + x]) {
        isFullLine = false;
        break;
      }
    }
    if (isFullLine) {
      linesToClear.push(y);
    }
  }

  // 清除行
  if (linesToClear.length > 0) {
    linesCleared.value += linesToClear.length;

    // 播放消除行音效
    soundManager.playSound("tetrisClear");

    // 根据消除行数增加分数
    const lineScores = { 1: 100, 2: 300, 3: 500, 4: 800 };
    score.value +=
      lineScores[linesToClear.length as keyof typeof lineScores] || 0;

    // 更新等级
    level.value = Math.floor(linesCleared.value / 10) + 1;

    // 显示提示信息
    if (linesToClear.length === 1) {
      showEmotionReductionMessage("焦虑-2");
    } else if (linesToClear.length === 4) {
      showEmotionReductionMessage("烦恼清零！");
    }

    // 移除完整行并下移上方方块
    linesToClear.forEach((lineY) => {
      // 移除完整行
      gameGrid.value.splice(lineY * GRID_WIDTH, GRID_WIDTH);
      // 在顶部添加新行
      gameGrid.value.unshift(...Array(GRID_WIDTH).fill(0));
    });
  }
};

// 生成新方块
const spawnNewPiece = async () => {
  // 设置当前方块为下一个方块
  currentPiece.value = {
    ...nextPiece.value,
    x: Math.floor(GRID_WIDTH / 2) - 1,
    y: 0,
  };
  // 生成新的下一个方块
  nextPiece.value = generateRandomPiece();
  updateNextPieceGrid();

  // 检查游戏结束
  if (
    checkCollision(
      currentPiece.value,
      currentPiece.value.x,
      currentPiece.value.y,
    )
  ) {
    gameOver.value = true;
    // 播放游戏结束音效
    soundManager.playSound("gameOver");
    if (gameLoop) {
      cancelAnimationFrame(gameLoop);
      gameLoop = null;
    }
    await saveRelaxRecord();
  }
};

// 保存放松记录
const saveRelaxRecord = async () => {
  const endTime = new Date().toISOString();
  await relaxStore.saveRecord({
    activityType: "tetris",
    startTime: startTime.value,
    endTime: endTime,
    metrics: {
      score: score.value,
      linesCleared: linesCleared.value,
      level: level.value,
      speed: selectedSpeed.value,
    },
  });
  // 检查成就
  await achievementStore.checkAchievements();
};

// 更新下一个方块预览
const updateNextPieceGrid = () => {
  nextPieceGrid.value = Array(NEXT_PIECE_GRID_SIZE * NEXT_PIECE_GRID_SIZE).fill(
    0,
  );

  const offsetX = Math.floor(
    (NEXT_PIECE_GRID_SIZE - nextPiece.value.shape[0].length) / 2,
  );
  const offsetY = Math.floor(
    (NEXT_PIECE_GRID_SIZE - nextPiece.value.shape.length) / 2,
  );

  nextPiece.value.shape.forEach((row: number[], y: number) => {
    row.forEach((cell: number, x: number) => {
      if (cell) {
        const gridIndex = (y + offsetY) * NEXT_PIECE_GRID_SIZE + (x + offsetX);
        if (gridIndex >= 0 && gridIndex < nextPieceGrid.value.length) {
          nextPieceGrid.value[gridIndex] = 1;
        }
      }
    });
  });
};

// 显示情绪减少提示
const showEmotionReductionMessage = (msg: string) => {
  message.value = msg;
  showMessage.value = true;
  setTimeout(() => {
    showMessage.value = false;
  }, 1500);
};

// 开始游戏
const startGame = () => {
  isGameStarted.value = true;
  gameOver.value = false;
  isPaused.value = false;
  score.value = 0;
  linesCleared.value = 0;
  level.value = 1;
  currentSpeed.value = selectedSpeed.value;
  startTime.value = new Date().toISOString(); // 重置开始时间

  // 重置游戏网格
  gameGrid.value = Array(GRID_WIDTH * GRID_HEIGHT).fill(0);

  // 生成初始方块
  currentPiece.value = {
    ...generateRandomPiece(),
    x: Math.floor(GRID_WIDTH / 2) - 1,
    y: 0,
  };
  nextPiece.value = generateRandomPiece();
  updateNextPieceGrid();

  // 设置下落间隔
  dropInterval = calculateDropInterval(currentSpeed.value);

  // 开始游戏循环
  if (gameLoop) cancelAnimationFrame(gameLoop);
  lastDropTime = performance.now();
  gameLoop = requestAnimationFrame(gameStep);
};

// 游戏循环步骤
const gameStep = (timestamp: number) => {
  if (isPaused.value) {
    gameLoop = requestAnimationFrame(gameStep);
    return;
  }

  // 处理水平移动
  if (keysPressed.value.has("ArrowLeft")) {
    movePiece(-1, 0);
  } else if (keysPressed.value.has("ArrowRight")) {
    movePiece(1, 0);
  }

  // 处理加速下落
  if (keysPressed.value.has("ArrowDown")) {
    movePiece(0, 1);
  }

  // 处理方块自动下落
  if (timestamp - lastDropTime > dropInterval) {
    movePiece(0, 1);
    lastDropTime = timestamp;
  }

  gameLoop = requestAnimationFrame(gameStep);
};

// 暂停/继续游戏
const togglePause = () => {
  isPaused.value = !isPaused.value;
};

// 重新开始游戏
const restartGame = () => {
  isGameStarted.value = false;
  gameOver.value = false;
  isPaused.value = false;
  score.value = 0;
  linesCleared.value = 0;
  level.value = 1;
  gameGrid.value = Array(GRID_WIDTH * GRID_HEIGHT).fill(0);
  nextPieceGrid.value = Array(NEXT_PIECE_GRID_SIZE * NEXT_PIECE_GRID_SIZE).fill(
    0,
  );
};

// 关闭游戏
const closeGame = () => {
  if (gameLoop) {
    cancelAnimationFrame(gameLoop);
    gameLoop = null;
  }
  isGameStarted.value = false;
  gameOver.value = false;
  isPaused.value = false;
  score.value = 0;
  linesCleared.value = 0;
  level.value = 1;
  gameGrid.value = Array(GRID_WIDTH * GRID_HEIGHT).fill(0);
  nextPieceGrid.value = Array(NEXT_PIECE_GRID_SIZE * NEXT_PIECE_GRID_SIZE).fill(
    0,
  );
};

// 处理按键按下
const handleKeyDown = (e: KeyboardEvent) => {
  if (!isGameStarted.value || gameOver.value) return;

  keysPressed.value.add(e.key);

  switch (e.key) {
    case "ArrowUp":
      e.preventDefault();
      rotatePiece();
      break;
    case " ":
      e.preventDefault();
      togglePause();
      break;
    case "ArrowLeft":
    case "ArrowRight":
    case "ArrowDown":
      e.preventDefault();
      break;
  }
};

// 处理按键释放
const handleKeyUp = (e: KeyboardEvent) => {
  keysPressed.value.delete(e.key);
};

// 组件挂载时添加事件监听
onMounted(() => {
  window.addEventListener("keydown", handleKeyDown);
  window.addEventListener("keyup", handleKeyUp);

  // 初始化下一个方块预览
  updateNextPieceGrid();
});

// 组件卸载时清理
onUnmounted(() => {
  window.removeEventListener("keydown", handleKeyDown);
  window.removeEventListener("keyup", handleKeyUp);
  if (gameLoop) {
    cancelAnimationFrame(gameLoop);
    gameLoop = null;
  }
});
</script>

<style scoped lang="scss">
.tetris-game {
  padding: 16px;
  text-align: center;

  .game-settings {
    margin: 20px 0;

    .speed-selector {
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

    .controls-info {
      margin: 20px 0;
      padding: 15px;
      background: #f8f9fa;
      border-radius: 8px;
      font-size: 14px;
      color: #666;

      p {
        margin: 5px 0;
      }
    }
  }

  .game-container {
    display: flex;
    justify-content: center;
    align-items: flex-start;
    gap: 30px;
    margin: 20px 0;

    .game-area {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 15px;
    }

    .game-grid {
      display: grid;
      grid-template-columns: repeat(10, 30px);
      grid-template-rows: repeat(20, 30px);
      gap: 2px;
      background: #e9ecef;
      padding: 10px;
      border-radius: 8px;
      box-shadow: 0 4px 10px rgba(0, 0, 0, 0.1);

      .grid-cell {
        width: 30px;
        height: 30px;
        background: #fff;
        border-radius: 3px;
        transition: background-color 0.2s ease;

        &.filled {
          background: linear-gradient(45deg, #3498db, #2980b9);
          box-shadow: inset 0 0 5px rgba(0, 0, 0, 0.3);
        }
      }
    }

    .game-stats {
      display: grid;
      grid-template-columns: repeat(2, 150px);
      gap: 10px;
      background: #f8f9fa;
      padding: 15px;
      border-radius: 8px;

      .stat-item {
        display: flex;
        justify-content: space-between;
        align-items: center;

        label {
          font-weight: 500;
          color: #333;
        }

        span {
          color: #42b983;
          font-weight: bold;
        }
      }
    }

    .next-piece {
      background: #f8f9fa;
      padding: 15px;
      border-radius: 8px;
      min-width: 200px;

      h5 {
        margin: 0 0 10px 0;
        color: #333;
        font-size: 16px;
      }

      .next-piece-grid {
        display: grid;
        grid-template-columns: repeat(4, 25px);
        grid-template-rows: repeat(4, 25px);
        gap: 2px;
        background: #e9ecef;
        padding: 10px;
        border-radius: 6px;
        margin: 0 auto 15px auto;

        .grid-cell {
          width: 25px;
          height: 25px;
          background: #fff;
          border-radius: 2px;

          &.filled {
            background: linear-gradient(45deg, #e74c3c, #c0392b);
            box-shadow: inset 0 0 4px rgba(0, 0, 0, 0.3);
          }
        }
      }
    }
  }

  .game-over {
    margin: 30px 0;
    padding: 30px;
    background: #f8f9fa;
    border-radius: 12px;
    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);

    h4 {
      margin: 0 0 20px 0;
      color: #333;
      font-size: 24px;
    }

    .final-score {
      font-size: 28px;
      font-weight: bold;
      color: #42b983;
      margin: 15px 0;
    }

    .lines-stats {
      color: #666;
      margin-bottom: 25px;
    }
  }

  .game-btn {
    padding: 10px 20px;
    border: none;
    border-radius: 6px;
    font-weight: 500;
    font-size: 16px;
    cursor: pointer;
    transition: all 0.3s ease;
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

  .game-controls {
    display: flex;
    gap: 10px;
  }

  .game-over-buttons {
    display: flex;
    justify-content: center;
    gap: 15px;
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
