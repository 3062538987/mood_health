/**
 * 情绪记录接口
 * @interface MoodRecord
 * @property {string} id - 情绪记录ID
 * @property {string} userId - 用户ID
 * @property {number} intensity - 情绪强度(1-10)
 * @property {string[]} moodType - 情绪类型，支持多选
 * @property {number[]} moodRatio - 情绪占比
 * @property {string} event - 触发事件
 * @property {string[]} tags - 事件标签
 * @property {string} trigger - 触发因素
 * @property {string} createTime - 记录时间
 */
export interface MoodRecord {
  id: string;
  userId: string;
  intensity: number; // 情绪强度(1-10)
  moodType: string[]; // 情绪类型，支持多选
  moodRatio: number[]; // 情绪占比
  event: string; // 触发事件
  tags: string[]; // 事件标签
  trigger: string; // 触发因素
  createTime: string; // 记录时间
}

/**
 * 情绪记录列表响应接口
 * @interface MoodListResponse
 * @property {MoodRecord[]} list - 情绪记录列表
 * @property {number} total - 总记录数
 */
export interface MoodListResponse {
  list: MoodRecord[]; // 接口返回的列表数据
  total: number; // 补充总条数字段
}

/**
 * 情绪周报接口
 * @interface MoodWeeklyReport
 * @property {number} averageIntensity - 平均情绪强度
 * @property {Array<{date: string, averageIntensity: number, triggers?: string[], anxiousRatio?: number, happyRatio?: number, calmRatio?: number}>} dailyData - 每日数据
 * @property {string} mostFrequentMood - 最常见的情绪类型
 * @property {string} summary - 情绪总结
 */
export interface MoodWeeklyReport {
  averageIntensity: number;
  dailyData: Array<{
    date: string;
    averageIntensity: number;
    triggers?: string[];
    anxiousRatio?: number;
    happyRatio?: number;
    calmRatio?: number;
  }>;
  mostFrequentMood: string;
  summary: string;
}

/**
 * 情绪趋势响应接口
 * @interface MoodTrendResponse
 * @property {string[]} labels - 时间标签
 * @property {Array<{name: string, data: number[]}>} datasets - 数据集
 * @property {string} summary - 情绪总结
 * @property {Array<{date: string, intensity: number, moodType?: string[], note?: string, triggers?: string[]}>} data - 详细数据
 */
export interface MoodTrendResponse {
  labels: string[];
  datasets: Array<{ name: string; data: number[] }>;
  summary: string;
  data?: Array<{
    date: string;
    intensity: number;
    moodType?: string[];
    note?: string;
    triggers?: string[];
  }>;
}

/**
 * 情绪类型枚举接口
 * @interface MoodTypeEnum
 * @property {string} value - 情绪类型值
 * @property {string} label - 情绪类型标签
 */
export interface MoodTypeEnum {
  value: string;
  label: string;
}
