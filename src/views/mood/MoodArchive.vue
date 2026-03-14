<template>
  <div class="mood-archive">
    <div class="container">
      <h2>情绪档案</h2>

      <!-- 筛选区域 -->
      <div class="filter-section">
        <!-- 时间筛选 -->
        <div class="filter-group">
          <label>时间范围：</label>
          <div class="time-filters">
            <button
              v-for="filter in timeFilters"
              :key="filter.key"
              :class="{ active: selectedTimeFilter === filter.key }"
              @click="setTimeFilter(filter.key)"
            >
              {{ filter.label }}
            </button>
          </div>

          <!-- 自定义时间范围 -->
          <div class="custom-time" v-if="selectedTimeFilter === 'custom'">
            <input
              type="date"
              v-model="customStartDate"
              @change="handleCustomDateChange"
            />
            <span class="date-separator">至</span>
            <input
              type="date"
              v-model="customEndDate"
              @change="handleCustomDateChange"
            />
          </div>
        </div>

        <!-- 情绪类型筛选 -->
        <div class="filter-group">
          <label>情绪类型：</label>
          <div class="mood-filters">
            <button
              v-for="mood in moodTypes"
              :key="mood.type"
              :class="{ active: selectedMoodFilters.includes(mood.type) }"
              @click="toggleMoodFilter(mood.type)"
            >
              <span
                class="mood-dot"
                :style="{ backgroundColor: mood.color }"
              ></span>
              {{ mood.name }}
            </button>
            <button
              :class="{ active: selectedMoodFilters.length === 0 }"
              @click="clearMoodFilters"
            >
              全部
            </button>
          </div>
        </div>

        <button class="reset-btn" @click="resetFilters">重置筛选</button>
      </div>

      <!-- 骨架屏 -->
      <div
        v-if="isLoading && moodRecords.length === 0"
        class="skeleton-container"
      >
        <el-skeleton :rows="10" animated />
      </div>

      <!-- 时间轴+本托布局 -->
      <div v-else class="timeline-bento-container">
        <div v-if="filteredRecords.length === 0" class="no-records">
          没有找到匹配的情绪记录
        </div>

        <div v-else class="timeline-bento">
          <div
            v-for="(record, index) in filteredRecords"
            :key="record.id"
            class="bento-item"
            :class="getItemSize(record, index)"
            @click="showDetail(record)"
          >
            <div class="date-badge">
              <div class="date-day">{{ getDay(record.createTime) }}</div>
              <div class="date-month">{{ getMonth(record.createTime) }}</div>
            </div>

            <div class="emotion-summary">
              <div
                v-for="(type, idx) in record.moodType"
                :key="idx"
                class="emotion-dot"
                :style="{
                  backgroundColor: getMoodColor(type),
                  transform: `scale(${(record.moodRatio[idx] || 50) / 30})`,
                  zIndex: idx,
                }"
                :title="`${getMoodName(type)}: ${record.moodRatio[idx] || 50}%`"
              ></div>
            </div>

            <div class="trigger-preview">
              <span class="trigger-icon">🎯</span>
              <span class="trigger-text">{{ getMainTrigger(record) }}</span>
            </div>

            <div class="mood-note">{{ truncateText(record.event, 20) }}</div>

            <div class="item-actions">
              <button
                class="action-btn edit-btn"
                @click.stop="editRecord(record)"
              >
                ✏️
              </button>
              <button
                class="action-btn delete-btn"
                @click.stop="confirmDeleteRecord(record)"
              >
                🗑️
              </button>
            </div>
          </div>
        </div>

        <!-- 加载更多 -->
        <div class="load-more" v-if="hasMore">
          <el-button type="primary" :loading="isLoading" @click="loadMore">
            加载更多
          </el-button>
        </div>
      </div>
    </div>

    <!-- 详情对话框 -->
    <el-dialog
      v-model="showDetailDialog"
      :title="`情绪详情 - ${formatDateDetail(selectedRecord?.createTime)}`"
      width="500px"
      class="detail-dialog"
    >
      <div v-if="selectedRecord" class="detail-content">
        <div class="detail-section">
          <h4>情绪类型</h4>
          <div class="detail-emotions">
            <div
              v-for="(type, idx) in selectedRecord.moodType"
              :key="idx"
              class="detail-emotion-item"
            >
              <div
                class="emotion-dot-large"
                :style="{
                  backgroundColor: getMoodColor(type),
                  transform: `scale(${(selectedRecord.moodRatio[idx] || 50) / 25})`,
                }"
              ></div>
              <div class="emotion-info">
                <span class="emotion-name">{{ getMoodName(type) }}</span>
                <span class="emotion-ratio"
                  >{{ selectedRecord.moodRatio[idx] || 50 }}%</span
                >
              </div>
            </div>
          </div>
        </div>

        <div class="detail-section">
          <h4>触发因素</h4>
          <div class="detail-triggers">
            <span
              v-for="tag in getTags(selectedRecord)"
              :key="tag"
              class="trigger-tag"
            >
              {{ tag }}
            </span>
          </div>
        </div>

        <div class="detail-section">
          <h4>情绪描述</h4>
          <p class="detail-note">{{ selectedRecord.event }}</p>
        </div>

        <div class="detail-section" v-if="selectedRecord.intensity">
          <h4>情绪强度</h4>
          <div class="intensity-bar">
            <div
              class="intensity-fill"
              :style="{
                width: `${selectedRecord.intensity * 10}%`,
                background: getIntensityColor(selectedRecord.intensity),
              }"
            ></div>
            <span class="intensity-value"
              >{{ selectedRecord.intensity }}/10</span
            >
          </div>
        </div>
      </div>

      <template #footer>
        <el-button @click="showDetailDialog = false">关闭</el-button>
        <el-button type="primary" @click="editRecord(selectedRecord!)">
          编辑
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { useRouter } from "vue-router";

import { getMoodRecordList } from "@/api/mood";
import { MoodRecord } from "@/types/mood";
import { formatDate as formatDateUtil } from "@/utils/dateUtil";

const router = useRouter();

// 情绪类型数据
const moodTypes = [
  { type: "angry", name: "愤怒", color: "var(--mood-angry)" },
  { type: "sad", name: "悲伤", color: "var(--mood-sad)" },
  { type: "calm", name: "平静", color: "var(--mood-calm)" },
  { type: "happy", name: "愉悦", color: "var(--mood-happy)" },
  { type: "anxious", name: "焦虑", color: "var(--mood-anxious)" },
  { type: "irritable", name: "烦躁", color: "var(--mood-neutral)" },
];

// 时间筛选选项
const timeFilters = [
  { key: "today", label: "今日" },
  { key: "thisWeek", label: "本周" },
  { key: "thisMonth", label: "本月" },
  { key: "custom", label: "自定义" },
];

// 状态管理
const moodRecords = ref<MoodRecord[]>([]);
const selectedTimeFilter = ref("thisMonth");
const customStartDate = ref("");
const customEndDate = ref("");
const selectedMoodFilters = ref<string[]>([]);
const currentPage = ref(1);
const pageSize = ref(20);
const totalRecords = ref(0);
const isLoading = ref(false);
const showDetailDialog = ref(false);
const selectedRecord = ref<MoodRecord | null>(null);

// 计算属性：是否有更多数据
const hasMore = computed(() => {
  return moodRecords.value.length < totalRecords.value;
});

// 计算属性：筛选后的记录
const filteredRecords = computed(() => {
  let records = [...moodRecords.value];

  // 时间筛选
  const now = new Date();
  let startDate = new Date(0);
  let endDate = new Date();

  switch (selectedTimeFilter.value) {
    case "today":
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      break;
    case "thisWeek":
      const dayOfWeek = now.getDay() || 7;
      startDate = new Date(now);
      startDate.setDate(now.getDate() - dayOfWeek + 1);
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date(startDate);
      endDate.setDate(startDate.getDate() + 7);
      break;
    case "thisMonth":
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      break;
    case "custom":
      if (customStartDate.value && customEndDate.value) {
        startDate = new Date(customStartDate.value);
        endDate = new Date(customEndDate.value);
        endDate.setHours(23, 59, 59, 999);
      }
      break;
  }

  records = records.filter((record) => {
    const recordDate = new Date(record.createTime);
    return recordDate >= startDate && recordDate < endDate;
  });

  // 情绪类型筛选
  if (selectedMoodFilters.value.length > 0) {
    records = records.filter((record) =>
      record.moodType.some((type) => selectedMoodFilters.value.includes(type)),
    );
  }

  // 按时间倒序排序
  return records.sort(
    (a, b) =>
      new Date(b.createTime).getTime() - new Date(a.createTime).getTime(),
  );
});

// 获取情绪记录列表
const fetchMoodRecords = async () => {
  try {
    isLoading.value = true;
    const response = await getMoodRecordList({
      page: currentPage.value,
      size: pageSize.value,
    });
    if (currentPage.value === 1) {
      moodRecords.value = response.list;
    } else {
      moodRecords.value = [...moodRecords.value, ...response.list];
    }
    totalRecords.value = response.total;
  } catch (error) {
    console.error("获取情绪记录失败", error);
    ElMessage.error("获取情绪记录失败，请稍后再试");
  } finally {
    isLoading.value = false;
  }
};

// 加载更多
const loadMore = async () => {
  if (!isLoading.value && hasMore.value) {
    currentPage.value++;
    await fetchMoodRecords();
  }
};

// 设置时间筛选
const setTimeFilter = (filterKey: string) => {
  selectedTimeFilter.value = filterKey;
  if (filterKey !== "custom") {
    customStartDate.value = "";
    customEndDate.value = "";
  }
};

// 处理自定义日期变化
const handleCustomDateChange = () => {
  if (customStartDate.value && customEndDate.value) {
    const start = new Date(customStartDate.value);
    const end = new Date(customEndDate.value);
    if (start > end) {
      customEndDate.value = customStartDate.value;
    }
  }
};

// 切换情绪类型筛选
const toggleMoodFilter = (moodType: string) => {
  const index = selectedMoodFilters.value.indexOf(moodType);
  if (index > -1) {
    selectedMoodFilters.value.splice(index, 1);
  } else {
    selectedMoodFilters.value.push(moodType);
  }
};

// 清除情绪类型筛选
const clearMoodFilters = () => {
  selectedMoodFilters.value = [];
};

// 重置筛选
const resetFilters = () => {
  selectedTimeFilter.value = "thisMonth";
  customStartDate.value = "";
  customEndDate.value = "";
  selectedMoodFilters.value = [];
  currentPage.value = 1;
  fetchMoodRecords();
};

// 获取本托项目大小
const getItemSize = (record: MoodRecord, index: number) => {
  // 基于情绪强度和多种情绪判断重要性
  const hasMultipleEmotions = record.moodType.length > 1;
  const highIntensity = record.intensity && record.intensity >= 8;
  const isImportant = hasMultipleEmotions || highIntensity;

  // 前几个记录也显示得更大
  const isRecent = index < 3;

  if (isImportant && isRecent) return "large";
  if (isImportant || isRecent) return "medium";
  return "small";
};

// 获取日期
const getDay = (dateString: string) => {
  const date = new Date(dateString);
  return date.getDate();
};

const getMonth = (dateString: string) => {
  const date = new Date(dateString);
  const months = [
    "1月",
    "2月",
    "3月",
    "4月",
    "5月",
    "6月",
    "7月",
    "8月",
    "9月",
    "10月",
    "11月",
    "12月",
  ];
  return months[date.getMonth()];
};

// 获取主要触发因素
const getMainTrigger = (record: MoodRecord) => {
  const tags = getTags(record);
  return tags.length > 0 ? tags[0] : "无";
};

// 获取标签
const getTags = (record: MoodRecord) => {
  const tags: string[] = [];
  if (record.trigger) {
    tags.push(...record.trigger.split(",").map((t) => t.trim()));
  }
  if (record.tags && Array.isArray(record.tags)) {
    tags.push(...record.tags);
  }
  return tags.filter((tag) => tag).slice(0, 3);
};

// 截断文本
const truncateText = (text: string, maxLength: number) => {
  if (!text) return "";
  return text.length > maxLength ? text.substring(0, maxLength) + "..." : text;
};

// 格式化日期
const formatDate = (dateString: string) => {
  return formatDateUtil(dateString);
};

const formatDateDetail = (dateString?: string) => {
  if (!dateString) return "";
  return formatDateUtil(dateString);
};

// 获取情绪颜色
const getMoodColor = (moodType: string) => {
  const mood = moodTypes.find((m) => m.type === moodType);
  return mood ? mood.color : "#999";
};

// 获取情绪名称
const getMoodName = (moodType: string) => {
  const mood = moodTypes.find((m) => m.type === moodType);
  return mood ? mood.name : moodType;
};

// 获取强度颜色
const getIntensityColor = (intensity: number) => {
  if (intensity <= 3) return "var(--mood-angry)";
  if (intensity <= 6) return "var(--mood-happy)";
  return "var(--mood-calm)";
};

// 显示详情
const showDetail = (record: MoodRecord) => {
  selectedRecord.value = record;
  showDetailDialog.value = true;
};

// 编辑记录
const editRecord = (record: MoodRecord) => {
  showDetailDialog.value = false;
  router.push({
    path: "/mood/record",
    query: { edit: "true", id: record.id },
  });
};

// 确认删除记录
const confirmDeleteRecord = (record: MoodRecord) => {
  ElMessageBox.confirm("确定要删除这条情绪记录吗？", "删除确认", {
    confirmButtonText: "确定",
    cancelButtonText: "取消",
    type: "warning",
  })
    .then(async () => {
      try {
        const index = moodRecords.value.findIndex((r) => r.id === record.id);
        if (index > -1) {
          moodRecords.value.splice(index, 1);
        }
        ElMessage.success("记录删除成功！");
      } catch (error) {
        console.error("删除失败", error);
        ElMessage.error("删除失败，请稍后再试");
      }
    })
    .catch(() => {
      // 取消删除
    });
};

// 组件挂载时获取数据
onMounted(() => {
  fetchMoodRecords();
});
</script>

<style scoped lang="scss">
@import "@/assets/styles/theme.scss";

.mood-archive {
  padding: 20px;

  .container {
    max-width: 1200px;
    margin: 0 auto;
  }

  h2 {
    margin-bottom: 24px;
  }

  .filter-section {
    background: rgba(255, 255, 255, 0.7);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    border: 1px solid rgba(255, 255, 255, 0.3);
    border-radius: $border-radius-lg;
    box-shadow: 0 8px 32px rgba(31, 38, 135, 0.1);
    transition: all 0.3s ease;
    position: relative;
    overflow: hidden;
    padding: 20px;
    margin-bottom: 28px;
    display: flex;
    flex-wrap: wrap;
    gap: 20px;
    align-items: center;

    &:hover {
      transform: translateY(-3px);
      box-shadow: 0 12px 40px rgba(31, 38, 135, 0.15);
      border-color: rgba(255, 255, 255, 0.5);
    }
  }

  .filter-group {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  label {
    font-weight: 600;
    color: var(--text-color);
    font-size: $font-size-sm;
  }

  .time-filters {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }

  .time-filters button,
  .mood-filters button {
    padding: 8px 16px;
    border: 1px solid var(--border-color);
    border-radius: $border-radius-md;
    background: rgba(255, 255, 255, 0.8);
    backdrop-filter: blur(8px);
    cursor: pointer;
    transition: all 0.3s ease;
    font-size: $font-size-sm;
    display: flex;
    align-items: center;
    gap: 6px;

    &.active {
      background: var(--primary-color);
      color: var(--white);
      border-color: var(--primary-color);
      box-shadow: var(--shadow-sm);
    }

    &:hover {
      border-color: var(--primary-color);
      transform: translateY(-2px);
    }

    &.active:hover {
      opacity: 0.9;
    }
  }

  .custom-time {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 8px;

    input {
      padding: 8px 12px;
      border: 1px solid var(--border-color);
      border-radius: $border-radius-md;
      background: rgba(255, 255, 255, 0.8);
      backdrop-filter: blur(8px);
      font-size: $font-size-sm;
    }

    .date-separator {
      color: var(--text-light-color);
    }
  }

  .mood-filters {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }

  .mood-dot {
    display: inline-block;
    width: 10px;
    height: 10px;
    border-radius: 50%;
  }

  .reset-btn {
    padding: 8px 16px;
    border: 1px solid var(--border-color);
    border-radius: $border-radius-md;
    background: rgba(255, 255, 255, 0.8);
    backdrop-filter: blur(8px);
    cursor: pointer;
    margin-left: auto;
    transition: all 0.3s ease;

    &:hover {
      border-color: var(--primary-color);
      color: var(--primary-color);
      transform: translateY(-2px);
    }
  }

  .skeleton-container {
    margin: 20px 0;
  }

  .no-records {
    text-align: center;
    padding: 60px 20px;
    color: var(--text-light-color);
    font-size: $font-size-lg;
  }

  // 时间轴+本托布局
  .timeline-bento-container {
    min-height: 400px;
  }

  .timeline-bento {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 20px;
    padding: 10px 0;
  }

  .bento-item {
    background: rgba(255, 255, 255, 0.7);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    border: 1px solid rgba(255, 255, 255, 0.3);
    border-radius: $border-radius-lg;
    box-shadow: 0 8px 32px rgba(31, 38, 135, 0.1);
    transition: all 0.3s ease;
    position: relative;
    overflow: hidden;
    padding: 20px;
    border-radius: $border-radius-lg;
    cursor: pointer;
    transition: all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
    position: relative;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    gap: 12px;

    &.small {
      grid-column: span 1;
      grid-row: span 1;
    }

    &.medium {
      grid-column: span 1;
      grid-row: span 2;
    }

    &.large {
      grid-column: span 2;
      grid-row: span 2;
    }

    &:hover {
      transform: translateY(-8px) scale(1.02);
      box-shadow: 0 20px 50px rgba(0, 0, 0, 0.15);

      .item-actions {
        opacity: 1;
      }
    }

    .date-badge {
      position: absolute;
      top: 16px;
      right: 16px;
      background: linear-gradient(
        135deg,
        var(--primary-color),
        var(--secondary-color)
      );
      color: white;
      border-radius: $border-radius-md;
      padding: 8px 12px;
      text-align: center;
      box-shadow: 0 4px 12px rgba(106, 176, 165, 0.3);
      min-width: 50px;

      .date-day {
        font-size: 24px;
        font-weight: 700;
        line-height: 1;
      }

      .date-month {
        font-size: 12px;
        font-weight: 500;
        margin-top: 2px;
      }
    }

    .emotion-summary {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      margin-top: 40px;
      min-height: 50px;
      align-items: center;
      justify-content: center;
      padding: 10px;
      background: rgba(255, 255, 255, 0.3);
      border-radius: $border-radius-md;
    }

    .emotion-dot {
      width: 20px;
      height: 20px;
      border-radius: 50%;
      transition: all 0.3s ease;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
      position: relative;
    }

    .trigger-preview {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 14px;
      background: rgba(106, 176, 165, 0.1);
      border-radius: $border-radius-md;
      font-size: $font-size-sm;
      color: var(--text-color);

      .trigger-icon {
        font-size: 16px;
      }

      .trigger-text {
        font-weight: 500;
      }
    }

    .mood-note {
      font-size: $font-size-sm;
      color: var(--text-light-color);
      line-height: 1.5;
      flex-grow: 1;
    }

    .item-actions {
      position: absolute;
      bottom: 16px;
      right: 16px;
      display: flex;
      gap: 8px;
      opacity: 0;
      transition: opacity 0.3s ease;
    }

    .action-btn {
      width: 36px;
      height: 36px;
      border-radius: 50%;
      border: none;
      cursor: pointer;
      font-size: 16px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.3s ease;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);

      &.edit-btn {
        background: rgba(106, 176, 165, 0.9);
        color: white;

        &:hover {
          background: var(--primary-color);
          transform: scale(1.1);
        }
      }

      &.delete-btn {
        background: rgba(239, 71, 111, 0.9);
        color: white;

        &:hover {
          background: var(--mood-angry);
          transform: scale(1.1);
        }
      }
    }
  }

  .load-more {
    text-align: center;
    margin-top: 32px;
    margin-bottom: 20px;
  }
}

// 详情对话框样式
.detail-dialog {
  .detail-content {
    .detail-section {
      margin-bottom: 24px;

      h4 {
        font-size: $font-size-md;
        font-weight: 600;
        color: var(--text-color);
        margin-bottom: 12px;
        font-family: "Noto Serif SC", serif;
      }

      .detail-emotions {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }

      .detail-emotion-item {
        display: flex;
        align-items: center;
        gap: 16px;
        padding: 12px;
        background: rgba(255, 255, 255, 0.5);
        border-radius: $border-radius-md;
      }

      .emotion-dot-large {
        width: 40px;
        height: 40px;
        border-radius: 50%;
        flex-shrink: 0;
      }

      .emotion-info {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }

      .emotion-name {
        font-weight: 600;
        color: var(--text-color);
      }

      .emotion-ratio {
        font-size: $font-size-sm;
        color: var(--text-light-color);
      }

      .detail-triggers {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }

      .trigger-tag {
        padding: 6px 14px;
        background: rgba(106, 176, 165, 0.15);
        color: var(--primary-color);
        border-radius: $border-radius-full;
        font-size: $font-size-sm;
        font-weight: 500;
      }

      .detail-note {
        color: var(--text-color);
        line-height: 1.6;
        font-size: $font-size-md;
      }

      .intensity-bar {
        display: flex;
        align-items: center;
        gap: 12px;
      }

      .intensity-fill {
        height: 12px;
        border-radius: 6px;
        transition: width 0.5s ease;
      }

      .intensity-value {
        font-weight: 600;
        color: var(--text-color);
        min-width: 40px;
      }
    }
  }
}

@media (max-width: 768px) {
  .mood-archive {
    padding: 15px;

    .timeline-bento {
      grid-template-columns: 1fr;
      gap: 16px;
    }

    .bento-item {
      &.large {
        grid-column: span 1;
        grid-row: span 1;
      }

      &.medium {
        grid-row: span 1;
      }
    }

    .filter-section {
      flex-direction: column;
      align-items: stretch;
    }

    .reset-btn {
      margin-left: 0;
    }
  }
}
</style>
