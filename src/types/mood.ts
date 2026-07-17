/**
 * 情绪记录接口
 * @interface MoodRecord
 */
export interface MoodRecord {
  id: string
  userId: string
  intensity: number
  moodType: string[]
  moodRatio: number[]
  event: string
  tags: string[]
  trigger: string
  createTime: string
}

/**
 * 创建情绪记录的输入参数
 * 与 MoodRecord 分离，避免将响应模型用作输入类型
 */
export interface CreateMoodRecordInput {
  moodType: string[]
  moodRatio: number[]
  intensity: number
  event: string
  tags: string[]
  trigger: string
}

/**
 * 情绪记录列表响应接口
 * @interface MoodListResponse
 * @property {MoodRecord[]} list - 情绪记录列表
 * @property {number} total - 总记录数
 */
export interface MoodListResponse {
  list: MoodRecord[] // 接口返回的列表数据
  total: number // 补充总条数字段
  page: number
  limit: number
}

export interface MoodListParams {
  page: number
  size: number
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
  averageIntensity: number
  dailyData: Array<{
    date: string
    averageIntensity: number
    triggers?: string[]
    anxiousRatio?: number
    happyRatio?: number
    calmRatio?: number
  }>
  mostFrequentMood: string
  summary: string
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
  labels: string[]
  datasets: Array<{ name: string; data: number[] }>
  summary: string
  data?: Array<{
    date: string
    intensity: number
    moodType?: string[]
    note?: string
    triggers?: string[]
  }>
}

/**
 * 情绪类型枚举接口
 * @interface MoodTypeEnum
 * @property {string} value - 情绪类型值
 * @property {string} label - 情绪类型标签
 */
export interface MoodTypeEnum {
  value: string
  label: string
}
