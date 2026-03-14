import type {
  Activity,
  ActivityStatus,
  ActivityStatusConfig,
} from "@/types/activity";

/**
 * 状态配置映射
 */
const statusConfigMap: Record<ActivityStatus, ActivityStatusConfig> = {
  full: {
    label: "已满",
    type: "danger",
    color: "#ff6b6b",
  },
  ongoing: {
    label: "进行中",
    type: "success",
    color: "#42b983",
  },
  upcoming: {
    label: "即将开始",
    type: "info",
    color: "#3498db",
  },
  ended: {
    label: "已结束",
    type: "danger",
    color: "#909399",
  },
};

/**
 * 计算活动状态
 * 优先级：已满 > 已结束 > 进行中 > 即将开始
 * @param activity 活动对象
 * @returns 活动状态
 */
export const calculateActivityStatus = (
  activity: Activity,
): ActivityStatus => {
  const now = new Date().getTime();
  const startTime = new Date(activity.startTime).getTime();
  const endTime = new Date(activity.endTime).getTime();

  // 优先级1：已满（人数已满）
  if (activity.currentParticipants >= activity.maxParticipants) {
    return "full";
  }

  // 优先级2：已结束
  if (now > endTime) {
    return "ended";
  }

  // 优先级3：进行中
  if (now >= startTime && now <= endTime) {
    return "ongoing";
  }

  // 优先级4：即将开始
  return "upcoming";
};

/**
 * 获取状态配置
 * @param status 活动状态
 * @returns 状态配置对象
 */
export const getActivityStatusConfig = (
  status: ActivityStatus,
): ActivityStatusConfig => {
  return statusConfigMap[status];
};

/**
 * 获取活动状态（包含配置）
 * @param activity 活动对象
 * @returns 状态和配置对象
 */
export const getActivityStatus = (
  activity: Activity,
): { status: ActivityStatus; config: ActivityStatusConfig } => {
  const status = calculateActivityStatus(activity);
  const config = getActivityStatusConfig(status);
  return { status, config };
};
