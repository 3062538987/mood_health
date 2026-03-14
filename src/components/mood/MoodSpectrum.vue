<template>
  <div class="mood-spectrum">
    <h3>选择你的当前情绪</h3>
    <div class="error-message" v-if="errorMessage">
      {{ errorMessage }}
    </div>

    <!-- 情绪饼状图 -->
    <div class="color-wheel-container">
      <div class="color-wheel">
        <!-- 白色背景 -->
        <div class="white-background"></div>

        <!-- 已选择的情绪扇形 -->
        <div class="mood-pie" :style="getPieStyle()">
          <!-- 情绪标签 -->
          <div
            v-for="(item, index) in finalMoods"
            :key="item.type"
            class="mood-label"
            :style="getLabelStyle(index)"
          >
            {{ item.name }}
          </div>
        </div>
      </div>
    </div>

    <!-- 系统情绪列表 -->
    <div class="system-moods">
      <h4>系统情绪</h4>
      <div class="system-moods-list">
        <div
          v-for="item in systemMoods"
          :key="item.type"
          class="mood-option"
          :class="{ active: selectedMoods.includes(item.type) }"
          :style="{ backgroundColor: item.color }"
          @click="toggleMood(item.type)"
        >
          <span class="mood-option-name">{{ item.name }}</span>
        </div>
      </div>
    </div>

    <!-- 选中的情绪和占比 -->
    <div class="selected-moods" v-if="selectedMoods.length > 0">
      <h4>已选择的情绪：</h4>
      <div class="selected-list">
        <div
          v-for="(item, index) in selectedMoods
            .map((type) => moodList.find((m) => m.type === type))
            .filter((item) => item !== undefined)"
          :key="item.type"
          class="selected-item"
          :style="{ backgroundColor: item.color }"
        >
          <span>{{ item.name }}</span>
          <input
            type="number"
            v-model.number="manualRatios[item.type]"
            min="0"
            max="100"
            @input="updateMoods"
            class="ratio-input"
            placeholder="0"
          />
          <span class="ratio">%</span>
          <button class="remove-btn" @click.stop="removeMood(item.type)">
            ×
          </button>
        </div>
      </div>
    </div>

    <!-- 自定义情绪 -->
    <div class="custom-emotion">
      <h4>添加自定义情绪</h4>
      <div class="custom-form">
        <input
          type="text"
          v-model="customEmotionName"
          placeholder="输入情绪名称"
          class="custom-name-input"
        />
        <input
          type="color"
          v-model="customEmotionColor"
          class="custom-color-input"
        />
        <button @click="addCustomEmotion" class="add-custom-btn">添加</button>
      </div>
    </div>

    <!-- 错误信息 -->
    <div class="error-message" v-if="errorMessage">{{ errorMessage }}</div>

    <!-- 提示信息 -->
    <div class="tips">
      <p>请输入各情绪的占比，总和不足100%的部分将自动填入"平静"</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";

// 定义props和emits
const props = defineProps<{
  modelValue: { types: string[]; ratios: number[] };
}>();

const emit = defineEmits<{
  (e: "update:modelValue", value: { types: string[]; ratios: number[] }): void;
}>();

// 系统预设情绪
const systemMoods = ref([
  { type: "angry", name: "愤怒", color: "#FF3A3A", icon: "😠" },
  { type: "sad", name: "悲伤", color: "#3A86FF", icon: "😔" },
  { type: "calm", name: "平静", color: "#3AFF47", icon: "😌" },
  { type: "happy", name: "愉悦", color: "#FFD700", icon: "😊" },
  { type: "anxious", name: "焦虑", color: "#9D4EDD", icon: "😰" },
  { type: "irritable", name: "烦躁", color: "#FF7F00", icon: "😫" },
]);

// 所有情绪列表（包含系统情绪和自定义情绪）
const moodList = computed(() => [...systemMoods.value]);

// 选中的情绪类型
const selectedMoods = ref<string[]>(props.modelValue?.types || []);
// 手动输入的情绪占比
const manualRatios = ref<Record<string, number>>({});
// 错误信息
const errorMessage = ref("");
// 自定义情绪输入
const customEmotionName = ref("");
const customEmotionColor = ref("#FF6B6B");

// 最终要显示在饼状图上的情绪
const finalMoods = ref<
  Array<{ type: string; name: string; color: string; ratio: number }>
>([]);

// 切换情绪选择
const toggleMood = (type: string) => {
  const index = selectedMoods.value.indexOf(type);
  if (index > -1) {
    selectedMoods.value.splice(index, 1);
    delete manualRatios.value[type];
    updateMoods(); // 移除时更新饼图
  } else {
    selectedMoods.value.push(type);
    manualRatios.value[type] = 0;
    // 只添加到已选列表，不立即更新饼图
  }
};

// 移除情绪
const removeMood = (type: string | undefined) => {
  if (!type) return;
  const index = selectedMoods.value.indexOf(type);
  if (index > -1) {
    selectedMoods.value.splice(index, 1);
    delete manualRatios.value[type];
    updateMoods();
  }
};

// 更新情绪占比
const updateMoods = () => {
  // 计算已输入的占比总和
  const sum = selectedMoods.value.reduce((total, type) => {
    return total + (manualRatios.value[type] || 0);
  }, 0);

  // 检查是否超过100%
  if (sum > 100) {
    errorMessage.value = "情绪占比总和不能超过100%";
    return;
  }
  errorMessage.value = "";

  // 构建最终的类型和占比数组（只包含用户选择的情绪）
  const finalTypes: string[] = [];
  const finalRatios: number[] = [];

  // 添加所有选中的情绪
  selectedMoods.value.forEach((type) => {
    finalTypes.push(type);
    finalRatios.push(manualRatios.value[type] || 0);
  });

  // 验证总和是否超过100%
  const totalRatio = finalRatios.reduce((sum, ratio) => sum + ratio, 0);
  if (totalRatio > 100) {
    errorMessage.value = "情绪比例总和超过了100%，请重新填写";
  } else {
    errorMessage.value = "";
  }

  // 更新finalMoods（只显示占比大于0的情绪）
  const allMoods = finalTypes.map((type, index) => {
    const mood = moodList.value.find((m) => m.type === type);
    return {
      type,
      name: mood?.name || "未知",
      color: mood?.color || "#CCCCCC",
      ratio: finalRatios[index],
    };
  });

  // 只保留比例大于0的情绪，同时保持原始顺序
  finalMoods.value = allMoods.filter((item) => item.ratio > 0);

  // 更新父组件
  emit("update:modelValue", {
    types: finalTypes,
    ratios: finalRatios,
  });
};

// 添加自定义情绪
const addCustomEmotion = () => {
  if (!customEmotionName.value.trim()) {
    errorMessage.value = "请输入自定义情绪名称";
    return;
  }

  // 创建自定义情绪类型
  const customType = "custom_" + Date.now();
  systemMoods.value.push({
    type: customType,
    name: customEmotionName.value.trim(),
    color: customEmotionColor.value,
    icon: "😊",
  });

  // 清空输入
  customEmotionName.value = "";
  customEmotionColor.value = "#FF6B6B";

  // 选中新添加的情绪
  selectedMoods.value.push(customType);
  manualRatios.value[customType] = 0;
  updateMoods();
};

// 计算整个饼图的样式（使用单个conic-gradient）
const getPieStyle = () => {
  if (finalMoods.value.length === 0) return {};

  // 构建conic-gradient的颜色停止点
  let currentAngle = 0;
  const gradientStops: string[] = [];

  // 添加所有情绪的颜色停止点
  finalMoods.value.forEach((mood) => {
    const endAngle = currentAngle + (mood.ratio / 100) * 360;
    gradientStops.push(`${mood.color} ${currentAngle}deg`);
    gradientStops.push(`${mood.color} ${endAngle}deg`);
    currentAngle = endAngle;
  });

  return {
    background: `conic-gradient(${gradientStops.join(", ")})`,
  };
};

// 计算每个情绪标签的位置
const getLabelStyle = (index: number) => {
  if (finalMoods.value.length === 0) return {};

  // 计算该情绪段的起始角度和中间角度
  let startAngle = 0;
  for (let i = 0; i < index; i++) {
    startAngle += (finalMoods.value[i].ratio / 100) * 360;
  }
  const endAngle = startAngle + (finalMoods.value[index].ratio / 100) * 360;
  const middleAngle = (startAngle + endAngle) / 2;

  // 将角度转换为弧度
  const radians = (middleAngle * Math.PI) / 180;

  // 计算标签的位置（在饼图的边缘区域）
  const radius = 120; // 增大半径值，确保标签能显示在各自扇形区域的边缘位置
  const x = Math.cos(radians) * radius;
  const y = Math.sin(radians) * radius;

  // 如果扇形角度太小（小于15度），不显示标签
  const angleSize = (finalMoods.value[index].ratio / 100) * 360;
  if (angleSize < 15) {
    return { display: "none" };
  }

  return {
    transform: `translate(-50%, -50%) translate(${x}px, ${y}px)`,
    zIndex: 10,
  };
};
</script>

<style scoped lang="scss">
.mood-spectrum {
  padding: 20px;

  h3 {
    font-size: 20px;
    margin-bottom: 20px;
    color: #333;
    text-align: center;
  }

  .error-message {
    text-align: center;
    color: #ff3a3a;
    font-size: 14px;
    margin-bottom: 15px;
    padding: 8px;
    background-color: rgba(255, 58, 58, 0.1);
    border-radius: 4px;
    border: 1px solid rgba(255, 58, 58, 0.3);
  }

  .color-wheel-container {
    display: flex;
    justify-content: center;
    margin: 30px 0;
  }

  .color-wheel {
    position: relative;
    width: 350px;
    height: 350px;
    border-radius: 50%;
    overflow: hidden;
    border: 3px solid #fff;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  }

  // 初始白色背景
  .white-background {
    position: absolute;
    width: 100%;
    height: 100%;
    background: white;
    border-radius: 50%;
  }

  // 完整饼图
  .mood-pie {
    width: 100%;
    height: 100%;
    border-radius: 50%;
    position: relative;
  }

  .mood-label {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    color: white;
    font-weight: bold;
    font-size: 18px;
    text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.5);
    pointer-events: none;
    white-space: nowrap;
  }

  // 系统情绪列表
  .system-moods {
    margin-top: 30px;

    h4 {
      margin-bottom: 15px;
      color: #333;
      font-size: 16px;
    }

    .system-moods-list {
      display: flex;
      gap: 12px;
      flex-wrap: wrap;
      justify-content: center;
    }

    .mood-option {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 10px 20px;
      border-radius: 25px;
      color: white;
      font-size: 16px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.3s ease;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);

      &:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
      }

      &.active {
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        filter: brightness(1.1);
      }
    }
  }

  // 选中的情绪
  .selected-moods {
    margin-top: 30px;

    h4 {
      margin-bottom: 15px;
      color: #333;
      font-size: 16px;
    }

    .selected-list {
      display: flex;
      gap: 15px;
      flex-wrap: wrap;
    }

    .selected-item {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 15px;
      border-radius: 25px;
      color: white;
      font-size: 16px;
      font-weight: 500;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);

      .ratio-input {
        width: 50px;
        padding: 6px;
        border: none;
        border-radius: 4px;
        text-align: center;
        font-size: 14px;
        font-weight: 500;
        background: rgba(255, 255, 255, 0.9);
        color: #333;
      }

      .ratio {
        font-size: 14px;
        opacity: 0.9;
      }

      .remove-btn {
        background: transparent;
        border: none;
        color: white;
        font-size: 18px;
        cursor: pointer;
        padding: 0 8px;
        opacity: 0.8;

        &:hover {
          opacity: 1;
        }
      }
    }
  }

  // 自定义情绪样式
  .custom-emotion {
    margin-top: 30px;

    h4 {
      margin-bottom: 15px;
      color: #333;
      font-size: 16px;
    }

    .custom-form {
      display: flex;
      gap: 10px;
      align-items: center;
      flex-wrap: wrap;
    }

    .custom-name-input {
      flex: 1;
      min-width: 150px;
      padding: 10px 15px;
      border: 1px solid #ddd;
      border-radius: 8px;
      font-size: 14px;
    }

    .custom-color-input {
      width: 50px;
      height: 40px;
      border: none;
      border-radius: 8px;
      cursor: pointer;
    }

    .add-custom-btn {
      padding: 10px 20px;
      background: linear-gradient(135deg, #42b983 0%, #388e3c 100%);
      color: white;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      font-size: 14px;
      font-weight: 500;
      transition: all 0.3s ease;

      &:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(66, 185, 131, 0.3);
      }
    }
  }

  // 错误信息样式
  .error-message {
    margin-top: 20px;
    padding: 10px;
    background: #ffebee;
    color: #d32f2f;
    border-radius: 8px;
    text-align: center;
    font-size: 14px;
  }

  .tips {
    margin-top: 20px;

    p {
      color: #666;
      font-size: 16px;
      text-align: center;
    }
  }
}
</style>
