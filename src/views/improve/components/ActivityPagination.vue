<template>
  <div v-if="total > 0" class="pagination-wrapper">
    <el-pagination
      v-model:current-page="currentPage"
      v-model:page-size="pageSize"
      :total="total"
      :page-sizes="pageSizes"
      :layout="layout"
      :background="background"
      :pager-count="pagerCount"
      @size-change="handleSizeChange"
      @current-change="handleCurrentChange"
    />
    <div class="pagination-info">
      共 <span class="highlight">{{ total }}</span> 条记录
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";

interface Props {
  currentPage: number;
  pageSize: number;
  total: number;
  pageSizes?: number[];
  layout?: string;
  background?: boolean;
  pagerCount?: number;
}

const props = withDefaults(defineProps<Props>(), {
  pageSizes: () => [12, 24, 48],
  layout: "total, sizes, prev, pager, next, jumper",
  background: true,
  pagerCount: 7,
});

const emit = defineEmits<{
  "update:currentPage": [page: number];
  "update:pageSize": [size: number];
  "change": [page: number, size: number];
}>();

// 使用计算属性实现 v-model
const currentPage = computed({
  get: () => props.currentPage,
  set: (val) => {
    emit("update:currentPage", val);
  },
});

const pageSize = computed({
  get: () => props.pageSize,
  set: (val) => {
    emit("update:pageSize", val);
  },
});

// 处理每页条数变化
const handleSizeChange = (size: number) => {
  emit("update:pageSize", size);
  emit("update:currentPage", 1);
  emit("change", 1, size);
};

// 处理页码变化
const handleCurrentChange = (page: number) => {
  emit("update:currentPage", page);
  emit("change", page, props.pageSize);
};
</script>

<style scoped lang="scss">
.pagination-wrapper {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 24px 0;
  margin-top: 24px;
}

.pagination-info {
  font-size: 14px;
  color: #606266;

  .highlight {
    color: #409eff;
    font-weight: 600;
  }
}

// 响应式适配
@media (max-width: 768px) {
  .pagination-wrapper {
    :deep(.el-pagination) {
      .el-pagination__jump,
      .el-pagination__sizes {
        display: none;
      }
    }
  }
}
</style>
