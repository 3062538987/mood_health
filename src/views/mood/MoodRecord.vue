<template>
  <div class="mood-record">
    <div class="container">
      <h2>情绪记录页面</h2>

      <!-- 情绪转盘 -->
      <div class="form-group">
        <label>情绪强度</label>
        <div class="emotion-wheel-container">
          <div
            class="emotion-wheel"
            :style="{ transform: `rotate(${rotationAngle}deg)` }"
          >
            <div class="wheel-bg"></div>
            <div class="emotion-face" :class="getEmotionClass(currentScore)">
              {{ getEmoji(currentScore) }}
            </div>
            <div
              v-for="n in 10"
              :key="n"
              class="wheel-segment"
              :style="getSegmentStyle(n)"
              @click="setIntensity(n)"
            >
              <span class="segment-number">{{ n }}</span>
            </div>
          </div>
          <div class="intensity-labels">
            <span class="label-low">😞 低落</span>
            <span class="label-mid">😐 平稳</span>
            <span class="label-high">😊 愉悦</span>
          </div>
          <input
            type="range"
            v-model.number="currentScore"
            min="1"
            max="10"
            class="intensity-slider"
            @input="updateRotation"
          />
        </div>
      </div>

      <!-- 情绪描述 -->
      <div class="form-group">
        <label>情绪描述</label>
        <textarea
          v-model="moodContent"
          rows="3"
          placeholder="请描述你当前的情绪状态..."
          :maxlength="200"
        ></textarea>
        <div class="form-hint">{{ moodContent.length }}/200</div>
      </div>

      <!-- 动态气泡云情绪类型选择器 -->
      <div class="form-group">
        <label>情绪类型</label>
        <div class="emotion-cloud">
          <div
            v-for="type in moodTypes"
            :key="type.id"
            class="emotion-bubble"
            :class="{
              selected: selectedMood.types.includes(type.id),
              merging: isMerging && selectedMood.types.includes(type.id),
            }"
            :style="getBubbleStyle(type)"
            @click="toggleMoodType(type)"
          >
            <span class="bubble-emoji">{{ type.emoji }}</span>
            <span class="bubble-name">{{ type.name }}</span>
            <span v-if="type.frequency > 0" class="frequency-dot"></span>
          </div>
        </div>
      </div>

      <!-- 智能标签推荐触发因素 -->
      <div class="form-group">
        <label>触发因素</label>
        <div class="trigger-input-container">
          <input
            v-model="triggerText"
            placeholder="今天发生了什么？"
            @input="suggestTriggers"
            @keydown.enter.prevent="addCustomTrigger"
            class="trigger-input"
          />
          <div class="suggestion-chips" v-if="suggestions.length > 0">
            <span
              v-for="sug in suggestions"
              :key="sug"
              class="chip"
              @click="addTrigger(sug)"
            >
              {{ sug }} <span class="chip-add">+</span>
            </span>
          </div>
          <div class="selected-triggers">
            <span
              v-for="tag in selectedTriggers"
              :key="tag"
              class="trigger-tag"
              :class="{ 'delete-item': deletingTag === tag }"
              :style="{ backgroundColor: getTriggerColor(tag) }"
              @click="removeTrigger(tag)"
            >
              {{ tag }} <span class="remove-btn">✕</span>
            </span>
          </div>
        </div>
      </div>

      <!-- 情绪标签 -->
      <div class="form-group">
        <label>情绪标签</label>
        <div class="tags-container">
          <div
            v-for="tag in availableTags"
            :key="tag"
            :class="{
              active: selectedTags.includes(tag),
              'delete-item': deletingTag === tag,
            }"
            class="tag-item"
            @click="toggleTag(tag)"
          >
            {{ tag }}
          </div>
        </div>
      </div>

      <!-- 草稿状态 -->
      <div class="draft-status" v-if="hasDraft">
        <span class="draft-indicator">📝 草稿已自动保存</span>
        <button class="clear-draft-btn" @click="handleClearDraft">
          清除草稿
        </button>
      </div>

      <!-- AI 情绪建议 -->
      <div class="form-group">
        <el-button
          type="primary"
          :loading="aiLoading"
          @click="debouncedGetAdvice"
          class="ai-advice-btn"
        >
          获取 AI 情绪建议
        </el-button>

        <el-card v-if="aiResult" class="ai-advice-card">
          <div class="ai-header">
            <h3>🤖 AI 情绪分析</h3>
            <div
              v-if="aiResult.mood"
              class="mood-badge"
              :style="{ backgroundColor: moodColor }"
            >
              <span class="mood-emoji">{{ moodEmoji }}</span>
              <span class="mood-label">{{ aiResult.mood }}</span>
            </div>
          </div>
          <p>{{ aiResult.analysis }}</p>
          <h4>💡 建议：</h4>
          <ul>
            <li v-for="(item, idx) in aiResult.suggestions" :key="idx">
              {{ item }}
            </li>
          </ul>
        </el-card>
      </div>

      <!-- 提交按钮 -->
      <button
        class="submit-btn"
        :class="{ 'submit-success': isSubmittingSuccess }"
        @click="handleSubmitMoodRecord"
        :disabled="isSubmitting"
      >
        {{ isSubmitting ? "提交中..." : "提交记录" }}
      </button>
    </div>

    <!-- 草稿恢复对话框 -->
    <el-dialog
      v-model="showDraftDialog"
      title="发现未完成的草稿"
      width="400px"
      :close-on-click-modal="false"
    >
      <p>检测到您之前有未提交的情绪记录草稿，是否恢复？</p>
      <template #footer>
        <el-button @click="handleDiscardDraft">放弃草稿</el-button>
        <el-button type="primary" @click="handleRestoreDraft"
          >恢复草稿</el-button
        >
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch, computed } from "vue";
import { useDebounceFn } from "@vueuse/core";
import {
  submitMoodRecord as addMoodRecord,
  analyzeMoodWithRetry,
  type AnalyzeMoodResponse,
} from "@/api/mood";
import { saveAdvice } from "@/api/advice";
import { ElMessage, ElMessageBox } from "element-plus";

const DRAFT_KEY = "moodRecordDraft";
const DEBOUNCE_DELAY = 1000;
const SUBMIT_DEBOUNCE_DELAY = 300;

// 情绪类型数据
interface MoodType {
  id: string;
  name: string;
  emoji: string;
  color: string;
  frequency: number;
}

// 草稿数据类型
interface MoodDraft {
  selectedMood: { types: string[]; ratios: number[] };
  moodContent: string;
  currentScore: number;
  selectedTags: string[];
  selectedTriggers: string[];
  savedAt: number;
}

// 情绪标签到图标的映射
const MOOD_EMOJI_MAP: Record<string, string> = {
  开心: "😊",
  焦虑: "😰",
  抑郁: "😢",
  平静: "😌",
  愤怒: "😠",
  疲惫: "😴",
  紧张: "😟",
  兴奋: "🤩",
  未知: "❓",
};

// 情绪标签到颜色的映射
const MOOD_COLOR_MAP: Record<string, string> = {
  开心: "#FFD166",
  焦虑: "#FF6B6B",
  抑郁: "#4D96FF",
  平静: "#95E1D3",
  愤怒: "#EF476F",
  疲惫: "#78C0A8",
  紧张: "#FF8E72",
  兴奋: "#FF6B9D",
  未知: "#CCCCCC",
};

const moodTypes: MoodType[] = [
  {
    id: "happy",
    name: "快乐",
    emoji: "😊",
    color: "var(--mood-happy)",
    frequency: 15,
  },
  {
    id: "sad",
    name: "悲伤",
    emoji: "😢",
    color: "var(--mood-sad)",
    frequency: 8,
  },
  {
    id: "angry",
    name: "愤怒",
    emoji: "😠",
    color: "var(--mood-angry)",
    frequency: 5,
  },
  {
    id: "anxious",
    name: "焦虑",
    emoji: "😰",
    color: "var(--mood-anxious)",
    frequency: 12,
  },
  {
    id: "calm",
    name: "平静",
    emoji: "😌",
    color: "var(--mood-calm)",
    frequency: 20,
  },
  { id: "excited", name: "兴奋", emoji: "🤩", color: "#FF6B9D", frequency: 10 },
  {
    id: "tired",
    name: "疲惫",
    emoji: "😴",
    color: "var(--mood-neutral)",
    frequency: 18,
  },
  { id: "grateful", name: "感恩", emoji: "🥰", color: "#C77DFF", frequency: 7 },
];

// 触发因素推荐数据
const commonTriggers = [
  "考试",
  "熬夜",
  "约会",
  "运动",
  "美食",
  "工作",
  "学习",
  "社交",
  "家庭",
  "天气",
  "音乐",
  "电影",
];

const triggerColors: Record<string, string> = {
  考试: "#FF6B6B",
  熬夜: "#4ECDC4",
  约会: "#FF8B94",
  运动: "#95E1D3",
  美食: "#F38181",
  工作: "#AA96DA",
  学习: "#FCBAD3",
  社交: "#A8D8EA",
  家庭: "#FFD93D",
  天气: "#6BCB77",
  音乐: "#4D96FF",
  电影: "#FF6B9D",
};

// 响应式数据
const selectedMood = ref<{ types: string[]; ratios: number[] }>({
  types: [],
  ratios: [],
});
const moodContent = ref("");
const currentScore = ref(5);
const rotationAngle = ref(0);
const isMerging = ref(false);

const triggerText = ref("");
const suggestions = ref<string[]>([]);
const selectedTriggers = ref<string[]>([]);

const availableTags = [
  "焦虑",
  "开心",
  "疲惫",
  "平静",
  "愤怒",
  "沮丧",
  "兴奋",
  "紧张",
];
const selectedTags = ref<string[]>([]);

const isSubmitting = ref(false);
const isSubmittingSuccess = ref(false);
const hasDraft = ref(false);
const showDraftDialog = ref(false);
const isInitialized = ref(false);
const deletingTag = ref<string | null>(null);

const aiLoading = ref(false);
const aiResult = ref<AnalyzeMoodResponse | null>(null);

// 计算属性：最大频率用于气泡大小计算
const maxFrequency = computed(() => {
  return Math.max(...moodTypes.map((t) => t.frequency));
});

// 计算属性：情绪图标
const moodEmoji = computed(() => {
  if (!aiResult.value || !aiResult.value.mood) {
    return MOOD_EMOJI_MAP["未知"];
  }
  return MOOD_EMOJI_MAP[aiResult.value.mood] || MOOD_EMOJI_MAP["未知"];
});

// 计算属性：情绪颜色
const moodColor = computed(() => {
  if (!aiResult.value || !aiResult.value.mood) {
    return MOOD_COLOR_MAP["未知"];
  }
  return MOOD_COLOR_MAP[aiResult.value.mood] || MOOD_COLOR_MAP["未知"];
});

// 情绪转盘相关函数
const getEmoji = (score: number): string => {
  const emojis = ["😞", "😔", "😟", "😕", "😐", "🙂", "😊", "😄", "😁", "🤩"];
  return emojis[score - 1] || "😐";
};

const getEmotionClass = (score: number): string => {
  if (score <= 3) return "low";
  if (score <= 6) return "medium";
  return "high";
};

const getSegmentStyle = (n: number) => {
  const angle = (n - 1) * 36;
  const colors = [
    "#FF6B6B",
    "#FF8E72",
    "#FFB347",
    "#FFD166",
    "#FFE66D",
    "#C7F464",
    "#95E1D3",
    "#6BCB77",
    "#4D96FF",
    "#9B59B6",
  ];
  return {
    transform: `rotate(${angle}deg)`,
    background: `linear-gradient(to right, ${colors[n - 1]}22, ${colors[n - 1]}44)`,
  };
};

const setIntensity = (n: number) => {
  currentScore.value = n;
  updateRotation();
};

const updateRotation = () => {
  rotationAngle.value = (currentScore.value - 1) * 36;
};

// 气泡云相关函数
const getBubbleStyle = (type: MoodType) => {
  const size = 60 + (type.frequency / maxFrequency.value) * 40;
  return {
    "--bubble-size": `${size}px`,
    "--bubble-color": type.color,
  };
};

const toggleMoodType = (type: MoodType) => {
  const index = selectedMood.value.types.indexOf(type.id);
  if (index > -1) {
    selectedMood.value.types.splice(index, 1);
    selectedMood.value.ratios.splice(index, 1);
  } else {
    if (selectedMood.value.types.length < 3) {
      selectedMood.value.types.push(type.id);
      selectedMood.value.ratios.push(50);
      // 触发合并动画
      if (selectedMood.value.types.length > 1) {
        isMerging.value = true;
        setTimeout(() => {
          isMerging.value = false;
        }, 500);
      }
    } else {
      ElMessage.warning("最多选择3种情绪类型");
    }
  }
};

// 智能标签推荐相关函数
const suggestTriggers = () => {
  if (triggerText.value.length < 1) {
    suggestions.value = [];
    return;
  }
  const input = triggerText.value.toLowerCase();
  suggestions.value = commonTriggers
    .filter(
      (t) =>
        t.toLowerCase().includes(input) && !selectedTriggers.value.includes(t),
    )
    .slice(0, 5);
};

const addTrigger = (trigger: string) => {
  if (!selectedTriggers.value.includes(trigger)) {
    selectedTriggers.value.push(trigger);
  }
  triggerText.value = "";
  suggestions.value = [];
};

const addCustomTrigger = () => {
  if (triggerText.value.trim()) {
    addTrigger(triggerText.value.trim());
  }
};

const removeTrigger = (trigger: string) => {
  deletingTag.value = trigger;
  setTimeout(() => {
    const index = selectedTriggers.value.indexOf(trigger);
    if (index > -1) {
      selectedTriggers.value.splice(index, 1);
    }
    deletingTag.value = null;
  }, 300);
};

const getTriggerColor = (trigger: string): string => {
  return triggerColors[trigger] || "#6AB0A5";
};

// 标签相关函数
const toggleTag = (tag: string) => {
  const index = selectedTags.value.indexOf(tag);
  if (index > -1) {
    deletingTag.value = tag;
    setTimeout(() => {
      selectedTags.value.splice(index, 1);
      deletingTag.value = null;
    }, 300);
  } else {
    selectedTags.value.push(tag);
  }
};

// 表单验证和提交
const validateForm = (): boolean => {
  if (selectedMood.value.types.length === 0) {
    ElMessage.error("请选择至少一种情绪类型");
    return false;
  }
  if (!moodContent.value.trim()) {
    ElMessage.error("请填写情绪描述");
    return false;
  }
  if (moodContent.value.length > 200) {
    ElMessage.error("情绪描述不能超过200字");
    return false;
  }
  return true;
};

const doSubmit = async () => {
  if (!validateForm()) {
    return;
  }

  try {
    isSubmitting.value = true;
    await addMoodRecord({
      moodType: selectedMood.value.types,
      moodRatio: selectedMood.value.ratios,
      event: moodContent.value,
      tags: [...selectedTags.value, ...selectedTriggers.value],
      trigger: selectedTriggers.value.join(","),
      intensity: currentScore.value,
    });
    ElMessage.success("记录提交成功！");
    isSubmittingSuccess.value = true;
    setTimeout(() => {
      isSubmittingSuccess.value = false;
      resetForm();
    }, 600);
  } catch (error) {
    console.error("提交失败", error);
    ElMessage.error("提交失败，请稍后再试");
  } finally {
    isSubmitting.value = false;
  }
};

const handleSubmitMoodRecord = useDebounceFn(doSubmit, SUBMIT_DEBOUNCE_DELAY);

const resetForm = () => {
  selectedMood.value = { types: [], ratios: [] };
  moodContent.value = "";
  currentScore.value = 5;
  rotationAngle.value = 0;
  selectedTags.value = [];
  selectedTriggers.value = [];
  triggerText.value = "";
  suggestions.value = [];
  aiResult.value = null;
  clearDraft();
};

// 草稿相关函数
const saveDraft = () => {
  if (!isInitialized.value) return;

  const hasContent =
    selectedMood.value.types.length > 0 ||
    moodContent.value.trim() ||
    selectedTags.value.length > 0 ||
    selectedTriggers.value.length > 0;

  if (!hasContent) {
    hasDraft.value = false;
    return;
  }

  const draft = {
    selectedMood: selectedMood.value,
    moodContent: moodContent.value,
    currentScore: currentScore.value,
    selectedTags: [...selectedTags.value],
    selectedTriggers: [...selectedTriggers.value],
    savedAt: Date.now(),
  };
  localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  hasDraft.value = true;
};

const debouncedSaveDraft = useDebounceFn(saveDraft, DEBOUNCE_DELAY);

const loadDraft = () => {
  const draftStr = localStorage.getItem(DRAFT_KEY);
  if (draftStr) {
    try {
      return JSON.parse(draftStr);
    } catch (error) {
      console.error("加载草稿失败", error);
      return null;
    }
  }
  return null;
};

const applyDraft = (draft: MoodDraft) => {
  selectedMood.value = draft.selectedMood || { types: [], ratios: [] };
  moodContent.value = draft.moodContent || "";
  currentScore.value = draft.currentScore || 5;
  selectedTags.value = draft.selectedTags || [];
  selectedTriggers.value = draft.selectedTriggers || [];
  hasDraft.value = true;
  updateRotation();
};

const clearDraft = () => {
  localStorage.removeItem(DRAFT_KEY);
  hasDraft.value = false;
};

const handleClearDraft = async () => {
  try {
    await ElMessageBox.confirm("确定要清除当前草稿吗？", "提示", {
      confirmButtonText: "确定",
      cancelButtonText: "取消",
      type: "warning",
    });
    resetForm();
    ElMessage.success("草稿已清除");
  } catch {
    // 用户取消
  }
};

const handleRestoreDraft = () => {
  const draft = loadDraft();
  if (draft) {
    applyDraft(draft);
    ElMessage.success("草稿已恢复");
  }
  showDraftDialog.value = false;
};

const handleDiscardDraft = () => {
  clearDraft();
  showDraftDialog.value = false;
};

const handleGetAdvice = async () => {
  if (!moodContent.value.trim()) {
    ElMessage.warning("请先记录今天的情绪描述");
    return;
  }
  if (aiLoading.value) {
    ElMessage.warning("正在获取建议，请稍候");
    return;
  }
  aiLoading.value = true;
  try {
    const res = await analyzeMoodWithRetry({
      content: moodContent.value,
      mood_level: currentScore.value,
    });
    aiResult.value = res;

    try {
      await saveAdvice({
        analysis: res.analysis,
        suggestions: res.suggestions,
      });
    } catch (saveError) {
      console.error("保存 AI 建议失败:", saveError);
    }
  } catch (error: any) {
    if (error.response) {
      if (error.response.status === 429) {
        ElMessage.error("请求太频繁，请稍后再试");
      } else if (error.response.status >= 500) {
        ElMessage.error("服务器繁忙，请稍后重试");
      } else {
        ElMessage.error(
          `获取建议失败: ${error.response.data?.detail || error.response.data?.message || "未知错误"}`,
        );
      }
    } else if (error.code === "ECONNABORTED") {
      ElMessage.error("请求超时，请检查网络");
    } else if (error.message && error.message.includes("Network Error")) {
      ElMessage.error("网络连接失败，请检查网络设置");
    } else if (error.message) {
      ElMessage.error(error.message);
    } else {
      ElMessage.error("获取建议失败，请稍后重试");
    }
    console.error("AI 分析错误:", error);
  } finally {
    aiLoading.value = false;
  }
};

const debouncedGetAdvice = useDebounceFn(handleGetAdvice, 500);

// 监听数据变化自动保存草稿
watch(
  [selectedMood, moodContent, currentScore, selectedTags, selectedTriggers],
  () => {
    debouncedSaveDraft();
  },
  { deep: true },
);

// 组件挂载
onMounted(() => {
  const draft = loadDraft();
  if (draft) {
    const hoursSinceSaved = (Date.now() - draft.savedAt) / (1000 * 60 * 60);
    if (hoursSinceSaved < 24) {
      showDraftDialog.value = true;
    } else {
      clearDraft();
    }
  }
  isInitialized.value = true;
  updateRotation();
});
</script>

<style scoped lang="scss">
@import "@/assets/styles/theme.scss";

.mood-record {
  padding: 20px;

  .container {
    max-width: 800px;
    margin: 0 auto;
  }

  .form-group {
    margin-bottom: 28px;

    label {
      display: block;
      margin-bottom: 16px;
      font-weight: 600;
      color: var(--text-color);
      font-size: $font-size-lg;
      font-family: "Noto Serif SC", serif;
    }

    textarea {
      width: 100%;
      padding: 16px;
      border: 1px solid var(--border-color);
      border-radius: $border-radius-lg;
      resize: vertical;
      font-size: $font-size-md;
      transition: all 0.3s ease;
      background: rgba(255, 255, 255, 0.7);
      backdrop-filter: blur(8px);

      &:focus {
        outline: none;
        border-color: var(--theme-color, var(--primary-color));
        box-shadow: 0 0 0 3px rgba(106, 176, 165, 0.1);
      }
    }

    .form-hint {
      font-size: $font-size-sm;
      color: var(--text-light-color);
      text-align: right;
      margin-top: 8px;
    }
  }

  // 情绪转盘样式
  .emotion-wheel-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 20px;

    .emotion-wheel {
      position: relative;
      width: 280px;
      height: 280px;
      border-radius: 50%;
      transition: transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
      cursor: pointer;

      .wheel-bg {
        position: absolute;
        inset: 0;
        border-radius: 50%;
        background: conic-gradient(
          from 0deg,
          #ff6b6b 0deg 36deg,
          #ff8e72 36deg 72deg,
          #ffb347 72deg 108deg,
          #ffd166 108deg 144deg,
          #ffe66d 144deg 180deg,
          #c7f464 180deg 216deg,
          #95e1d3 216deg 252deg,
          #6bcb77 252deg 288deg,
          #4d96ff 288deg 324deg,
          #9b59b6 324deg 360deg
        );
        opacity: 0.3;
      }

      .emotion-face {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 100px;
        height: 100px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 48px;
        background: rgba(255, 255, 255, 0.9);
        backdrop-filter: blur(10px);
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
        transition: all 0.3s ease;

        &.low {
          background: linear-gradient(135deg, #ff6b6b20, #ff8e7230);
        }
        &.medium {
          background: linear-gradient(135deg, #ffd16620, #ffe66d30);
        }
        &.high {
          background: linear-gradient(135deg, #6bcb7720, #95e1d330);
        }
      }

      .wheel-segment {
        position: absolute;
        top: 50%;
        left: 50%;
        width: 50%;
        height: 2px;
        transform-origin: left center;
        cursor: pointer;
        transition: all 0.3s ease;

        &:hover {
          height: 4px;
        }

        .segment-number {
          position: absolute;
          right: 20px;
          top: 50%;
          transform: translateY(-50%);
          font-size: 14px;
          font-weight: 600;
          color: var(--text-color);
        }
      }
    }

    .intensity-labels {
      display: flex;
      justify-content: space-between;
      width: 100%;
      max-width: 280px;
      font-size: $font-size-sm;
      color: var(--text-light-color);
    }

    .intensity-slider {
      width: 100%;
      max-width: 280px;
      cursor: pointer;
    }
  }

  // AI 建议卡片样式
  .ai-advice-card {
    margin-top: 16px;
    border-radius: $border-radius-lg;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);

    .ai-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 16px;

      h3 {
        margin: 0;
        font-size: $font-size-lg;
        color: var(--primary-color);
      }

      .mood-badge {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px 16px;
        border-radius: $border-radius-full;
        background: var(--primary-color);
        color: white;
        font-weight: 600;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
        animation: pulse 2s infinite;

        .mood-emoji {
          font-size: 24px;
        }

        .mood-label {
          font-size: $font-size-md;
        }
      }
    }

    p {
      margin: 12px 0;
      color: var(--text-color);
      line-height: 1.6;
    }

    h4 {
      margin: 16px 0 8px 0;
      font-size: $font-size-md;
      color: var(--primary-color);
    }

    ul {
      margin: 0;
      padding-left: 20px;

      li {
        margin: 8px 0;
        color: var(--text-color);
        line-height: 1.6;
      }
    }
  }

  @keyframes pulse {
    0%,
    100% {
      transform: scale(1);
    }
    50% {
      transform: scale(1.05);
    }
  }

  // 其他样式保持不变...
  .emotion-cloud {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    justify-content: center;
    padding: 20px;
    background: rgba(255, 255, 255, 0.5);
    border-radius: $border-radius-lg;
    backdrop-filter: blur(8px);

    .emotion-bubble {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      width: var(--bubble-size);
      height: var(--bubble-size);
      border-radius: 50%;
      background: var(--bubble-color);
      cursor: pointer;
      transition: all 0.3s ease;
      position: relative;

      &:hover {
        transform: scale(1.1);
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
      }

      &.selected {
        box-shadow: 0 0 0 4px var(--primary-color);
        transform: scale(1.15);
      }

      &.merging {
        animation: merge 0.5s ease;
      }

      .bubble-emoji {
        font-size: 28px;
        margin-bottom: 4px;
      }

      .bubble-name {
        font-size: 12px;
        font-weight: 500;
        color: var(--text-color);
      }

      .frequency-dot {
        position: absolute;
        top: 8px;
        right: 8px;
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: var(--primary-color);
      }
    }
  }

  @keyframes merge {
    0% {
      transform: scale(1);
    }
    50% {
      transform: scale(1.2);
    }
    100% {
      transform: scale(1.15);
    }
  }

  .trigger-input-container {
    position: relative;

    .trigger-input {
      width: 100%;
      padding: 12px 16px;
      border: 1px solid var(--border-color);
      border-radius: $border-radius-md;
      font-size: $font-size-md;
      transition: all 0.3s ease;

      &:focus {
        outline: none;
        border-color: var(--primary-color);
        box-shadow: 0 0 0 3px rgba(106, 176, 165, 0.1);
      }
    }

    .suggestion-chips {
      position: absolute;
      top: 100%;
      left: 0;
      right: 0;
      background: white;
      border-radius: $border-radius-md;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
      padding: 8px;
      z-index: 10;
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 4px;

      .chip {
        padding: 6px 12px;
        background: var(--primary-color);
        color: white;
        border-radius: $border-radius-full;
        cursor: pointer;
        font-size: $font-size-sm;
        transition: all 0.3s ease;

        &:hover {
          background: var(--primary-color-dark);
          transform: translateY(-2px);
        }

        .chip-add {
          margin-left: 4px;
          font-weight: 600;
        }
      }
    }

    .selected-triggers {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 12px;

      .trigger-tag {
        padding: 6px 12px;
        border-radius: $border-radius-full;
        color: white;
        font-size: $font-size-sm;
        cursor: pointer;
        transition: all 0.3s ease;
        display: flex;
        align-items: center;
        gap: 6px;

        &:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        }

        &.delete-item {
          animation: fadeOut 0.3s ease;
        }

        .remove-btn {
          font-size: 12px;
          opacity: 0.7;
        }
      }
    }
  }

  @keyframes fadeOut {
    to {
      opacity: 0;
      transform: scale(0.8);
    }
  }

  .tags-container {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;

    .tag-item {
      padding: 8px 16px;
      border: 1px solid var(--border-color);
      border-radius: $border-radius-full;
      background: rgba(255, 255, 255, 0.7);
      cursor: pointer;
      transition: all 0.3s ease;
      font-size: $font-size-sm;

      &:hover {
        border-color: var(--primary-color);
        background: rgba(106, 176, 165, 0.1);
      }

      &.active {
        background: var(--primary-color);
        color: white;
        border-color: var(--primary-color);
      }

      &.delete-item {
        animation: fadeOut 0.3s ease;
      }
    }
  }

  .draft-status {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    background: rgba(255, 193, 7, 0.1);
    border: 1px solid rgba(255, 193, 7, 0.3);
    border-radius: $border-radius-md;

    .draft-indicator {
      font-size: $font-size-sm;
      color: #f57c00;
    }

    .clear-draft-btn {
      padding: 6px 12px;
      background: transparent;
      border: 1px solid #f57c00;
      color: #f57c00;
      border-radius: $border-radius-sm;
      cursor: pointer;
      font-size: $font-size-sm;
      transition: all 0.3s ease;

      &:hover {
        background: #f57c00;
        color: white;
      }
    }
  }

  .ai-advice-btn {
    width: 100%;
    padding: 12px;
    font-size: $font-size-md;
    font-weight: 600;
    border-radius: $border-radius-md;
  }

  .submit-btn {
    width: 100%;
    padding: 16px;
    background: linear-gradient(
      135deg,
      var(--primary-color),
      var(--primary-color-dark)
    );
    color: white;
    border: none;
    border-radius: $border-radius-lg;
    font-size: $font-size-lg;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.3s ease;
    box-shadow: 0 4px 12px rgba(106, 176, 165, 0.3);

    &:hover:not(:disabled) {
      transform: translateY(-2px);
      box-shadow: 0 8px 24px rgba(106, 176, 165, 0.4);
    }

    &:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    &.submit-success {
      background: linear-gradient(135deg, #6bcb77, #95e1d3);
      animation: successPulse 0.6s ease;
    }
  }

  @keyframes successPulse {
    0% {
      transform: scale(1);
    }
    50% {
      transform: scale(1.05);
    }
    100% {
      transform: scale(1);
    }
  }
}
</style>
