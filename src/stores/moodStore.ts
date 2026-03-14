import { defineStore } from "pinia";
import { ref, computed } from "vue";
import {
  submitMoodRecord,
  getMoodRecordList,
  getMoodWeeklyReport,
} from "@/api/mood";
import { MoodRecord, MoodWeeklyReport } from "@/types/mood";

export const useMoodStore = defineStore("mood", () => {
  const currentMood = ref<string[]>([]);
  const moodRecords = ref<MoodRecord[]>([]);
  const weeklyReport = ref<MoodWeeklyReport | null>(null);
  const loading = ref(false);
  const error = ref("");

  const submitRecord = async (
    data: Omit<MoodRecord, "id" | "userId" | "createTime">,
  ) => {
    loading.value = true;
    error.value = "";
    try {
      await submitMoodRecord(data);
      await fetchMoodList({ page: 1, size: 10 });
    } catch (err: unknown) {
      const errorResponse = err as {
        response?: { data?: { message?: string } };
      };
      error.value = errorResponse.response?.data?.message || "提交失败";
      throw err;
    } finally {
      loading.value = false;
    }
  };

  const fetchMoodList = async (params: { page: number; size: number }) => {
    loading.value = true;
    error.value = "";
    try {
      const res = await getMoodRecordList(params);
      moodRecords.value = res.list;
    } catch (err: unknown) {
      const errorResponse = err as {
        response?: { data?: { message?: string } };
      };
      error.value = errorResponse.response?.data?.message || "获取列表失败";
    } finally {
      loading.value = false;
    }
  };

  const fetchWeeklyReport = async () => {
    loading.value = true;
    error.value = "";
    try {
      const res = await getMoodWeeklyReport();
      weeklyReport.value = res;
    } catch (err: unknown) {
      const errorResponse = err as {
        response?: { data?: { message?: string } };
      };
      error.value = errorResponse.response?.data?.message || "获取周报失败";
    } finally {
      loading.value = false;
    }
  };

  // 计算最近的平均情绪强度
  const recentAvgIntensity = computed(() => {
    // 取最近7条记录
    const recentRecords = [...moodRecords.value].slice(0, 7);
    if (recentRecords.length === 0) return 5; // 默认值

    // 计算平均强度
    const totalIntensity = recentRecords.reduce((sum, record) => {
      return sum + (record.intensity || 5); // 如果没有强度值，默认5
    }, 0);

    return totalIntensity / recentRecords.length;
  });

  return {
    currentMood,
    moodRecords,
    weeklyReport,
    loading,
    error,
    submitRecord,
    fetchMoodList,
    fetchWeeklyReport,
    recentAvgIntensity,
  };
});
