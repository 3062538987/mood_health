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
  未知: "❓"
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
  未知: "#CCCCCC"
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
