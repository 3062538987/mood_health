<template>
  <div class="group-activity">
    <div class="page-container">
      <!-- 页面头部 -->
      <div class="page-header">
        <div class="header-content">
          <h1 class="page-title">
            <el-icon><Calendar /></el-icon>
            团体辅导活动
          </h1>
          <p class="page-subtitle">参与心理健康团体活动，共同成长</p>
        </div>
        <el-button
          v-if="isAdmin"
          type="primary"
          size="large"
          @click="showModal = true"
        >
          <el-icon><Plus /></el-icon>
          创建活动
        </el-button>
      </div>

      <!-- 筛选组件 -->
      <ActivityFilterComponent
        v-model="filter"
        :location-options="locationOptions"
        @search="handleSearch"
        @reset="handleReset"
      />

      <!-- 加载状态 -->
      <div v-if="loading" class="loading-wrapper">
        <el-skeleton :rows="3" animated />
        <el-skeleton :rows="3" animated />
        <el-skeleton :rows="3" animated />
      </div>

      <!-- 错误提示 -->
      <el-empty
        v-else-if="error"
        description="加载失败，请稍后重试"
        :image-size="200"
      >
        <el-button type="primary" @click="loadActivities">重新加载</el-button>
      </el-empty>

      <!-- 空状态 -->
      <el-empty
        v-else-if="activities.length === 0"
        description="暂无活动"
        :image-size="200"
      >
        <el-button type="primary" @click="handleReset">查看全部活动</el-button>
      </el-empty>

      <!-- 活动列表 -->
      <div v-else class="activity-grid">
        <ActivityCard
          v-for="activity in activities"
          :key="activity.id"
          :activity="activity"
          :is-admin="isAdmin"
          :is-logged-in="isLoggedIn"
          :is-joined="isJoined(activity.id)"
          @edit="editActivity"
          @delete="confirmDelete"
          @login="$router.push('/login')"
          @joined="handleJoined"
        />
      </div>

      <!-- 分页组件 -->
      <ActivityPagination
        v-if="!loading && !error && activities.length > 0"
        v-model:current-page="pagination.page"
        v-model:page-size="pagination.limit"
        :total="pagination.total"
        @change="handlePageChange"
      />

      <!-- 我的活动记录 -->
      <el-card v-if="isLoggedIn && !isAdmin" class="my-activities-card">
        <template #header>
          <div class="card-header">
            <span class="card-title">
              <el-icon><Star /></el-icon>
              我的活动记录
            </span>
            <el-tag type="info" size="small"
              >{{ myJoinedActivities.length }} 场</el-tag
            >
          </div>
        </template>

        <div v-if="myJoinedActivities.length > 0" class="record-list">
          <el-timeline>
            <el-timeline-item
              v-for="activity in myJoinedActivities"
              :key="activity.id"
              :timestamp="formatDate(activity.startTime)"
              placement="top"
            >
              <el-card class="record-card" shadow="hover">
                <h4 class="record-title">{{ activity.title }}</h4>
                <div class="record-info">
                  <el-icon><Location /></el-icon>
                  <span>{{ activity.location }}</span>
                </div>
              </el-card>
            </el-timeline-item>
          </el-timeline>
        </div>

        <el-empty v-else description="您还没有参加任何活动" :image-size="100" />
      </el-card>
    </div>

    <!-- 创建/编辑活动弹窗 -->
    <el-dialog
      v-model="showModal"
      :title="isEditing ? '编辑活动' : '创建活动'"
      width="600px"
      destroy-on-close
    >
      <el-form
        ref="formRef"
        :model="activityForm"
        :rules="formRules"
        label-width="100px"
        class="activity-form"
      >
        <el-form-item label="活动标题" prop="title">
          <el-input
            v-model="activityForm.title"
            placeholder="请输入活动标题"
            maxlength="100"
            show-word-limit
          />
        </el-form-item>

        <el-form-item label="活动描述" prop="description">
          <el-input
            v-model="activityForm.description"
            type="textarea"
            :rows="3"
            placeholder="请输入活动描述"
            maxlength="500"
            show-word-limit
          />
        </el-form-item>

        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="开始时间" prop="startTime">
              <el-date-picker
                v-model="activityForm.startTime"
                type="datetime"
                placeholder="选择开始时间"
                style="width: 100%"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="结束时间" prop="endTime">
              <el-date-picker
                v-model="activityForm.endTime"
                type="datetime"
                placeholder="选择结束时间"
                style="width: 100%"
              />
            </el-form-item>
          </el-col>
        </el-row>

        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="最大名额" prop="maxParticipants">
              <el-input-number
                v-model="activityForm.maxParticipants"
                :min="1"
                :max="1000"
                style="width: 100%"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="活动地点" prop="location">
              <el-select
                v-model="activityForm.location"
                placeholder="选择地点"
                style="width: 100%"
              >
                <el-option
                  v-for="loc in locationOptions"
                  :key="loc"
                  :label="loc"
                  :value="loc"
                />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>

        <el-form-item label="图片链接" prop="imageUrl">
          <el-input
            v-model="activityForm.imageUrl"
            placeholder="请输入图片URL（可选）"
          />
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="closeModal">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="submitActivity">
          {{ submitting ? "提交中..." : "保存" }}
        </el-button>
      </template>
    </el-dialog>

    <!-- 删除确认弹窗 -->
    <el-dialog v-model="showDeleteModal" title="确认删除" width="400px">
      <p>确定要删除这个活动吗？此操作不可恢复。</p>
      <template #footer>
        <el-button @click="showDeleteModal = false">取消</el-button>
        <el-button
          type="danger"
          :loading="submitting"
          @click="deleteActivityConfirm"
        >
          {{ submitting ? "删除中..." : "删除" }}
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, reactive } from "vue";
import { ElMessage, type FormInstance, type FormRules } from "element-plus";
import { Calendar, Plus, Star, Location } from "@element-plus/icons-vue";
import { useUserStore } from "@/stores/userStore";
import type {
  Activity,
  CreateActivityData,
  ActivityFilter,
} from "@/types/activity";
import type { PaginationInfo } from "@/types/activity";
import {
  getActivities,
  getMyJoinedActivities,
  createActivity,
  updateActivity,
  deleteActivity,
} from "@/api/activityApi";
import ActivityCard from "./components/ActivityCard.vue";
import ActivityFilterComponent from "./components/ActivityFilter.vue";
import ActivityPagination from "./components/ActivityPagination.vue";

const userStore = useUserStore();
const isAdmin = computed(() => userStore.isAdmin);
const isLoggedIn = computed(() => userStore.isLoggedIn);

// 活动列表
const activities = ref<Activity[]>([]);
const myJoinedActivities = ref<Activity[]>([]);
const loading = ref(false);
const error = ref("");

// 筛选
const filter = ref<ActivityFilter>({});
const locationOptions = ref<string[]>([
  "心理咨询中心",
  "团体辅导室",
  "线上活动",
]);

// 分页
const pagination = reactive<PaginationInfo>({
  page: 1,
  limit: 12,
  total: 0,
  totalPages: 0,
});

// 弹窗状态
const showModal = ref(false);
const showDeleteModal = ref(false);
const isEditing = ref(false);
const submitting = ref(false);
const editingActivityId = ref<number | null>(null);
const deletingActivityId = ref<number | null>(null);
const formRef = ref<FormInstance>();

// 表单数据
const activityForm = reactive<CreateActivityData>({
  title: "",
  description: "",
  startTime: "",
  endTime: "",
  maxParticipants: 20,
  location: "",
  imageUrl: "",
});

// 表单验证规则
const formRules: FormRules = {
  title: [{ required: true, message: "请输入活动标题", trigger: "blur" }],
  startTime: [{ required: true, message: "请选择开始时间", trigger: "change" }],
  endTime: [{ required: true, message: "请选择结束时间", trigger: "change" }],
  maxParticipants: [
    { required: true, message: "请输入最大名额", trigger: "blur" },
  ],
  location: [{ required: true, message: "请选择活动地点", trigger: "change" }],
};

// 初始化
onMounted(() => {
  loadActivities();
  if (isLoggedIn.value && !isAdmin.value) {
    loadMyJoinedActivities();
  }
});

// 加载活动列表
const loadActivities = async () => {
  loading.value = true;
  error.value = "";
  try {
    const response = await getActivities(
      pagination.page,
      pagination.limit,
      filter.value,
    );
    activities.value = response.data;
    pagination.total = response.pagination.total;
    pagination.totalPages = response.pagination.totalPages;
  } catch {
    error.value = "加载活动失败";
  } finally {
    loading.value = false;
  }
};

// 搜索
const handleSearch = () => {
  pagination.page = 1;
  loadActivities();
};

// 重置筛选
const handleReset = () => {
  filter.value = {};
  pagination.page = 1;
  loadActivities();
};

// 分页变化
const handlePageChange = (page: number, size: number) => {
  pagination.page = page;
  pagination.limit = size;
  loadActivities();
};

// 加载我已报名的活动
const loadMyJoinedActivities = async () => {
  try {
    myJoinedActivities.value = await getMyJoinedActivities();
  } catch {
    console.error("加载我的活动失败");
  }
};

// 检查是否已报名
const isJoined = (activityId: number) => {
  return myJoinedActivities.value.some((a) => a.id === activityId);
};

// 报名成功回调
const handleJoined = () => {
  loadActivities();
  loadMyJoinedActivities();
};

// 编辑活动
const editActivity = (activity: Activity) => {
  isEditing.value = true;
  editingActivityId.value = activity.id;
  Object.assign(activityForm, {
    title: activity.title,
    description: activity.description,
    startTime: activity.startTime,
    endTime: activity.endTime,
    maxParticipants: activity.maxParticipants,
    location: activity.location,
    imageUrl: activity.imageUrl || "",
  });
  showModal.value = true;
};

// 确认删除
const confirmDelete = (activityId: number) => {
  deletingActivityId.value = activityId;
  showDeleteModal.value = true;
};

// 删除活动
const deleteActivityConfirm = async () => {
  if (!deletingActivityId.value) return;
  submitting.value = true;
  try {
    await deleteActivity(deletingActivityId.value);
    ElMessage.success("删除成功！");
    showDeleteModal.value = false;
    loadActivities();
  } catch {
    // 错误已由拦截器处理
  } finally {
    submitting.value = false;
    deletingActivityId.value = null;
  }
};

// 提交活动（创建/编辑）
const submitActivity = async () => {
  if (!formRef.value) return;

  await formRef.value.validate(async (valid) => {
    if (!valid) return;

    submitting.value = true;
    try {
      if (isEditing.value && editingActivityId.value) {
        await updateActivity(editingActivityId.value, activityForm);
        ElMessage.success("更新成功！");
      } else {
        await createActivity(activityForm);
        ElMessage.success("创建成功！");
      }
      closeModal();
      loadActivities();
    } catch {
      // 错误已由拦截器处理
    } finally {
      submitting.value = false;
    }
  });
};

// 关闭弹窗
const closeModal = () => {
  showModal.value = false;
  isEditing.value = false;
  editingActivityId.value = null;
  formRef.value?.resetFields();
  Object.assign(activityForm, {
    title: "",
    description: "",
    startTime: "",
    endTime: "",
    maxParticipants: 20,
    location: "",
    imageUrl: "",
  });
};

// 格式化日期
const formatDate = (dateStr: string) => {
  const date = new Date(dateStr);
  return date.toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};
</script>

<style scoped lang="scss">
.group-activity {
  min-height: 100vh;
  background: linear-gradient(135deg, #f5f7fa 0%, #e4e7ed 100%);
  padding: 24px;
}

.page-container {
  max-width: 1400px;
  margin: 0 auto;
}

// 页面头部
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
  padding: 24px;
  background: white;
  border-radius: 16px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);

  .header-content {
    .page-title {
      margin: 0 0 8px 0;
      font-size: 28px;
      font-weight: 600;
      color: #303133;
      display: flex;
      align-items: center;
      gap: 12px;

      .el-icon {
        color: #409eff;
        font-size: 32px;
      }
    }

    .page-subtitle {
      margin: 0;
      font-size: 14px;
      color: #909399;
    }
  }
}

// 加载状态
.loading-wrapper {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 24px;
}

// 活动网格
.activity-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 24px;
  margin-bottom: 24px;
}

// 我的活动记录
.my-activities-card {
  margin-top: 32px;
  border-radius: 16px;

  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;

    .card-title {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 16px;
      font-weight: 600;
      color: #303133;

      .el-icon {
        color: #e6a23c;
      }
    }
  }

  .record-list {
    padding: 16px 0;

    .record-card {
      margin-bottom: 8px;

      .record-title {
        margin: 0 0 8px 0;
        font-size: 14px;
        font-weight: 500;
        color: #303133;
      }

      .record-info {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 13px;
        color: #909399;

        .el-icon {
          font-size: 14px;
        }
      }
    }
  }
}

// 响应式适配
@media (max-width: 768px) {
  .group-activity {
    padding: 16px;
  }

  .page-header {
    flex-direction: column;
    gap: 16px;
    text-align: center;

    .header-content {
      .page-title {
        font-size: 24px;
        justify-content: center;
      }
    }
  }

  .activity-grid {
    grid-template-columns: 1fr;
  }
}
</style>
