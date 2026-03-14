<template>
  <el-card class="filter-card" shadow="never">
    <div class="filter-row">
      <!-- 标题搜索 -->
      <div class="filter-item filter-title">
        <el-input
          v-model="localFilter.title"
          placeholder="搜索活动标题"
          clearable
          @keyup.enter="handleSearch"
        >
          <template #prefix>
            <el-icon><Search /></el-icon>
          </template>
        </el-input>
      </div>

      <!-- 地点选择 -->
      <div class="filter-item">
        <el-select
          v-model="localFilter.location"
          placeholder="选择地点"
          clearable
          style="width: 100%"
        >
          <el-option
            v-for="loc in locationOptions"
            :key="loc"
            :label="loc"
            :value="loc"
          />
        </el-select>
      </div>

      <!-- 日期范围 -->
      <div class="filter-item filter-date">
        <el-date-picker
          v-model="localFilter.dateRange"
          type="daterange"
          range-separator="至"
          start-placeholder="开始日期"
          end-placeholder="结束日期"
          value-format="YYYY-MM-DD"
          clearable
          style="width: 100%"
        />
      </div>

      <!-- 状态选择 -->
      <div class="filter-item">
        <el-select
          v-model="localFilter.status"
          placeholder="活动状态"
          multiple
          collapse-tags
          collapse-tags-tooltip
          clearable
          style="width: 100%"
        >
          <el-option label="进行中" value="ongoing">
            <el-tag type="success" size="small">进行中</el-tag>
          </el-option>
          <el-option label="即将开始" value="upcoming">
            <el-tag type="info" size="small">即将开始</el-tag>
          </el-option>
          <el-option label="已结束" value="ended">
            <el-tag type="danger" size="small">已结束</el-tag>
          </el-option>
          <el-option label="已满" value="full">
            <el-tag type="warning" size="small">已满</el-tag>
          </el-option>
        </el-select>
      </div>

      <!-- 操作按钮 -->
      <div class="filter-actions">
        <el-button type="primary" @click="handleSearch">
          <el-icon><Search /></el-icon>
          <span>搜索</span>
        </el-button>
        <el-button @click="handleReset">
          <el-icon><RefreshRight /></el-icon>
          <span>重置</span>
        </el-button>
      </div>
    </div>
  </el-card>
</template>

<script setup lang="ts">
import { reactive, watch } from "vue";
import { Search, RefreshRight } from "@element-plus/icons-vue";
import type { ActivityFilter } from "@/types/activity";

interface Props {
  modelValue: ActivityFilter;
  locationOptions?: string[];
}

const props = withDefaults(defineProps<Props>(), {
  locationOptions: () => ["心理咨询中心", "团体辅导室", "线上活动"],
});

const emit = defineEmits<{
  "update:modelValue": [filter: ActivityFilter];
  search: [];
  reset: [];
}>();

// 本地筛选状态
const localFilter = reactive({
  title: props.modelValue.title || "",
  location: props.modelValue.location || "",
  dateRange: props.modelValue.startDate && props.modelValue.endDate
    ? [props.modelValue.startDate, props.modelValue.endDate]
    : ([] as string[]),
  status: props.modelValue.status || ([] as string[]),
});

// 监听外部变化
watch(
  () => props.modelValue,
  (newVal) => {
    localFilter.title = newVal.title || "";
    localFilter.location = newVal.location || "";
    localFilter.dateRange =
      newVal.startDate && newVal.endDate
        ? [newVal.startDate, newVal.endDate]
        : [];
    localFilter.status = newVal.status || [];
  },
  { deep: true }
);

// 搜索
const handleSearch = () => {
  const filter: ActivityFilter = {};
  if (localFilter.title) filter.title = localFilter.title;
  if (localFilter.location) filter.location = localFilter.location;
  if (localFilter.dateRange && localFilter.dateRange.length === 2) {
    filter.startDate = localFilter.dateRange[0];
    filter.endDate = localFilter.dateRange[1];
  }
  if (localFilter.status && localFilter.status.length > 0) {
    filter.status = localFilter.status;
  }
  emit("update:modelValue", filter);
  emit("search");
};

// 重置
const handleReset = () => {
  localFilter.title = "";
  localFilter.location = "";
  localFilter.dateRange = [];
  localFilter.status = [];
  emit("update:modelValue", {});
  emit("reset");
};
</script>

<style scoped lang="scss">
.filter-card {
  margin-bottom: 24px;
  border-radius: 12px;

  :deep(.el-card__body) {
    padding: 20px;
  }
}

.filter-row {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
}

.filter-item {
  flex: 1;
  min-width: 140px;

  &.filter-title {
    flex: 2;
    min-width: 200px;
  }

  &.filter-date {
    flex: 2;
    min-width: 280px;
  }
}

.filter-actions {
  display: flex;
  gap: 8px;
  margin-left: auto;

  .el-button {
    display: flex;
    align-items: center;
    gap: 4px;
  }
}

// 响应式适配
@media (max-width: 768px) {
  .filter-row {
    flex-direction: column;
    align-items: stretch;
  }

  .filter-item {
    width: 100%;
    min-width: auto;

    &.filter-title,
    &.filter-date {
      flex: 1;
      min-width: auto;
    }
  }

  .filter-actions {
    margin-left: 0;
    justify-content: flex-end;
  }
}
</style>
