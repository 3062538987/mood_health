/**
 * AI模块类型定义
 */

/**
 * 情绪分析结果接口
 * @interface MoodAIAnalysisResult
 * @property {string} mood - 情绪标签（开心/焦虑/抑郁等）
 * @property {number} confidence - 置信度（0-1）
 * @property {Array<{tag: string, score: number}>} emotions - 情绪分布
 * @property {string} suggestion - 情绪建议
 */
export interface MoodAIAnalysisResult {
  mood: string
  confidence: number
  emotions: Array<{ tag: string; score: number }>
  suggestion: string
}

/**
 * 情绪趋势预测结果接口
 * @interface MoodTrendPrediction
 * @property {string[]} labels - 时间标签
 * @property {number[]} data - 预测数据
 * @property {string} trend - 趋势描述
 */
export interface MoodTrendPrediction {
  labels: string[]
  data: number[]
  trend: string
}

/**
 * AI内容审核结果接口
 * @interface AIContentFilterResult
 * @property {boolean} isSafe - 是否安全
 * @property {string[]} detectedIssues - 检测到的问题
 * @property {string} severity - 严重程度（low/medium/high）
 * @property {string} suggestion - 处理建议
 */
export interface AIContentFilterResult {
  isSafe: boolean
  detectedIssues: string[]
  severity: 'low' | 'medium' | 'high'
  suggestion: string
}

/**
 * AI推荐项接口
 * @interface AIRecommendItem
 * @property {string} id - 推荐项ID
 * @property {string} type - 推荐类型（music/course/activity）
 * @property {string} title - 推荐项标题
 * @property {string} description - 推荐项描述
 * @property {string} url - 推荐项链接
 * @property {string} cover - 封面图片
 * @property {number} relevance - 相关度（0-1）
 */
export interface AIRecommendItem {
  id: string
  type: 'music' | 'course' | 'activity'
  title: string
  description: string
  url: string
  cover: string
  relevance: number
}

/**
 * AI推荐结果接口
 * @interface AIRecommendResult
 * @property {AIRecommendItem[]} items - 推荐项列表
 * @property {string} strategy - 推荐策略
 * @property {string} explanation - 推荐说明
 */
export interface AIRecommendResult {
  items: AIRecommendItem[]
  strategy: string
  explanation: string
}
