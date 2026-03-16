/**
 * AI数据模型
 * 定义AI请求/响应的TS类型，关联现有moodModel、postModel、courseModel
 */

import type { Mood } from "./moodModel";
import type { Post } from "./postModel";
import type { Course } from "./courseModel";
import type { Music } from "./musicModel";

// 情绪分析请求接口
export interface MoodAnalysisRequest {
  text: string;
  userId?: number;
  historicalData?: Array<{
    date: string;
    intensity: number;
    moodType: string[];
  }>;
}

// 心理咨询对话请求接口
export interface CounselingRequest {
  message: string;
  userId?: number;
  context?: Array<{
    role: "user" | "assistant";
    content: string;
  }>;
  mood?: string[];
}

// 心理咨询对话响应接口
export interface CounselingResponse {
  response: string;
  mood?: string;
  riskLevel?: "low" | "medium" | "high";
  suggestion?: string;
  hasRiskContent?: boolean;
}

// 内容审核请求接口
export interface ContentAuditRequest {
  content: string;
  type?: "post" | "comment" | "message";
  userId?: number;
}

// 内容审核结果接口
export interface ContentAuditResult {
  isSafe: boolean;
  detectedIssues: string[];
  severity: "low" | "medium" | "high";
  suggestion: string;
  timestamp?: string;
}

// 情绪分析响应接口
export interface MoodAnalysisResponse {
  text: string;
  emotionType: string[];
  emotionScore: number;
  suggestion: string;
  moodTrend?: string;
  resources?: Array<{
    type: "music" | "article" | "video" | "course";
    id: number;
    title: string;
    reason: string;
  }>;
}

// 情绪分析结果（AI服务内部使用）
export interface MoodAnalysisResult {
  mood: string;
  confidence: number;
  emotions: Array<{
    tag: string;
    score: number;
  }>;
  suggestion: string;
  timestamp?: string;
}

// 情绪预测请求接口
export interface MoodPredictionRequest {
  userId: number;
  days: number;
  historicalData: Array<{
    date: string;
    intensity: number;
    moodType: string[];
  }>;
}

// 情绪预测响应接口
export interface MoodPredictionResponse {
  predictions?: Array<{
    date: string;
    predictedMood: string[];
    intensity: number;
    confidence: number;
  }>;
  suggestions?: string[];
  riskLevel?: "low" | "medium" | "high";
  labels?: string[];
  data?: number[];
  trend?: string;
  timestamp?: string;
}

// 帖子分析请求接口
export interface PostAnalysisRequest {
  postId: number;
  content: string;
  userId?: number;
}

// 帖子分析响应接口
export interface PostAnalysisResponse {
  sentiment: "positive" | "neutral" | "negative";
  emotionType: string[];
  topics: string[];
  riskLevel: "low" | "medium" | "high";
  suggestion: string;
  resources?: Array<{
    type: "article" | "course" | "music";
    id: number;
    title: string;
    reason: string;
  }>;
}

// 个性化内容推荐请求接口
export interface ContentRecommendationRequest {
  userId: number;
  contentType?: "all" | "music" | "article" | "course";
  mood?: string | string[];
  topics?: string[];
  limit?: number;
  userPreferences?: string[];
  recentActivities?: Array<{
    type: string;
    duration: number;
    timestamp: string;
  }>;
}

// 推荐项接口
export interface RecommendationItem {
  id: string;
  type: "music" | "course" | "activity" | "article" | "video";
  title: string;
  description: string;
  url: string;
  cover?: string;
  relevance: number;
}

// 推荐结果接口
export interface RecommendationResult {
  items: RecommendationItem[];
  strategy: string;
  explanation: string;
  timestamp?: string;
}

// AI缓存键工具
export const getAICacheKey = (
  prefix: string,
  userId: number,
  payload?: unknown,
): string => {
  const payloadText = payload === undefined ? "" : JSON.stringify(payload);
  return `ai:${prefix}:${userId}:${payloadText}`;
};

// 个性化内容推荐响应接口
export interface ContentRecommendationResponse {
  recommendations: Array<{
    id: number;
    type: "music" | "article" | "course";
    title: string;
    description: string;
    relevanceScore: number;
    reason: string;
  }>;
  totalCount: number;
}

// 对话式AI请求接口
export interface ChatRequest {
  userId: number;
  message: string;
  context?: Array<{
    role: "user" | "assistant";
    content: string;
  }>;
  topic?: string;
}

// 对话式AI响应接口
export interface ChatResponse {
  response: string;
  moodDetection?: {
    detectedMood: string[];
    confidence: number;
  };
  resources?: Array<{
    type: "article" | "music" | "course";
    id: number;
    title: string;
    reason: string;
  }>;
  followUpQuestions?: string[];
}

// AI模型配置接口
export interface AIModelConfig {
  modelName: string;
  apiKey: string;
  baseUrl: string;
  timeout: number;
  maxTokens: number;
  temperature: number;
  topP: number;
  frequencyPenalty: number;
  presencePenalty: number;
}

// AI请求日志接口
export interface AIRequestLog {
  id: number;
  userId: number;
  requestType: string;
  requestData: string;
  responseData: string;
  responseTime: number;
  status: "success" | "error";
  errorMessage?: string;
  createdAt: Date;
}

// 情绪识别结果接口
export interface EmotionRecognitionResult {
  primaryEmotion: string;
  secondaryEmotions: string[];
  intensity: number;
  confidence: number;
  suggestions: string[];
}

// 心理评估请求接口
export interface PsychologicalAssessmentRequest {
  userId: number;
  answers: Array<{
    questionId: number;
    score: number;
    response?: string;
  }>;
  assessmentType: string;
}

// 心理评估响应接口
export interface PsychologicalAssessmentResponse {
  assessmentType: string;
  score: number;
  result: string;
  interpretation: string;
  recommendations: string[];
  riskLevel: "low" | "medium" | "high";
  followUpActions: string[];
}

// 压力分析请求接口
export interface StressAnalysisRequest {
  userId: number;
  content: string;
  historicalData?: Array<{
    date: string;
    stressLevel: number;
    triggers: string[];
  }>;
}

// 压力分析响应接口
export interface StressAnalysisResponse {
  stressLevel: number;
  triggers: string[];
  copingStrategies: string[];
  resources: Array<{
    type: "article" | "music" | "course";
    id: number;
    title: string;
    reason: string;
  }>;
}

// 睡眠质量分析请求接口
export interface SleepAnalysisRequest {
  userId: number;
  sleepData: Array<{
    date: string;
    duration: number;
    quality: number;
    disturbances: number;
  }>;
  moodData?: Array<{
    date: string;
    moodType: string[];
    intensity: number;
  }>;
}

// 睡眠质量分析响应接口
export interface SleepAnalysisResponse {
  averageDuration: number;
  averageQuality: number;
  trends: Array<{
    date: string;
    duration: number;
    quality: number;
  }>;
  recommendations: string[];
  resources: Array<{
    type: "article" | "music";
    id: number;
    title: string;
    reason: string;
  }>;
}

// 社交互动分析请求接口
export interface SocialInteractionRequest {
  userId: number;
  interactionData: Array<{
    date: string;
    type: "positive" | "negative" | "neutral";
    frequency: number;
    duration: number;
  }>;
}

// 社交互动分析响应接口
export interface SocialInteractionResponse {
  interactionPattern: string;
  sentimentAnalysis: {
    positive: number;
    neutral: number;
    negative: number;
  };
  recommendations: string[];
  resources: Array<{
    type: "article" | "course";
    id: number;
    title: string;
    reason: string;
  }>;
}

// 学习效率分析请求接口
export interface LearningEfficiencyRequest {
  userId: number;
  studyData: Array<{
    date: string;
    duration: number;
    subjects: string[];
    productivity: number;
    mood: string[];
  }>;
}

// 学习效率分析响应接口
export interface LearningEfficiencyResponse {
  averageProductivity: number;
  bestStudyTimes: string[];
  subjectAnalysis: Array<{
    subject: string;
    averageProductivity: number;
    recommendations: string[];
  }>;
  moodCorrelation: Array<{
    mood: string;
    averageProductivity: number;
  }>;
  recommendations: string[];
  resources: Array<{
    type: "article" | "course";
    id: number;
    title: string;
    reason: string;
  }>;
}

// 整体心理健康评估请求接口
export interface MentalHealthAssessmentRequest {
  userId: number;
  assessmentData: {
    mood: Array<{
      date: string;
      type: string[];
      intensity: number;
    }>;
    sleep: Array<{
      date: string;
      duration: number;
      quality: number;
    }>;
    social: Array<{
      date: string;
      interactionCount: number;
      sentiment: "positive" | "neutral" | "negative";
    }>;
    stress: Array<{
      date: string;
      level: number;
      triggers: string[];
    }>;
  };
}

// 整体心理健康评估响应接口
export interface MentalHealthAssessmentResponse {
  overallScore: number;
  categories: {
    mood: number;
    sleep: number;
    social: number;
    stress: number;
  };
  strengths: string[];
  areasForImprovement: string[];
  recommendations: string[];
  resources: Array<{
    type: "article" | "music" | "course";
    id: number;
    title: string;
    reason: string;
  }>;
  followUpActions: string[];
}

// 情绪识别标签接口
export interface EmotionTag {
  id: number;
  name: string;
  category: string;
  description: string;
  icon: string;
}

// 情绪管理策略接口
export interface EmotionManagementStrategy {
  id: number;
  emotion: string;
  strategies: string[];
  resources: Array<{
    type: "article" | "music" | "course";
    id: number;
    title: string;
  }>;
}

// 资源推荐接口
export interface ResourceRecommendation {
  id: number;
  type: "music" | "article" | "course" | "video";
  title: string;
  description: string;
  tags: string[];
  suitableFor: string[];
  effectiveness: number;
  duration: number;
  createdAt: Date;
  updatedAt: Date;
}

// 用户情绪档案接口
export interface UserEmotionProfile {
  userId: number;
  dominantEmotions: string[];
  emotionTriggers: string[];
  copingMechanisms: string[];
  recommendedResources: Array<{
    type: "music" | "article" | "course";
    id: number;
    title: string;
  }>;
  lastUpdated: Date;
}

// AI模型性能指标接口
export interface AIModelPerformance {
  modelName: string;
  requestCount: number;
  successRate: number;
  averageResponseTime: number;
  errorRate: number;
  accuracy: number;
  lastUpdated: Date;
}

// 情绪识别准确率接口
export interface EmotionRecognitionAccuracy {
  modelName: string;
  emotionType: string;
  accuracy: number;
  precision: number;
  recall: number;
  f1Score: number;
  testCount: number;
  lastUpdated: Date;
}

// 心理健康趋势接口
export interface MentalHealthTrend {
  userId: number;
  period: "week" | "month" | "year";
  trends: Array<{
    date: string;
    moodScore: number;
    sleepScore: number;
    socialScore: number;
    stressScore: number;
    overallScore: number;
  }>;
  recommendations: string[];
  areasForImprovement: string[];
  createdAt: Date;
}

// 情绪预测模型接口
export interface EmotionPredictionModel {
  id: number;
  modelName: string;
  version: string;
  trainingDataSize: number;
  accuracy: number;
  precision: number;
  recall: number;
  f1Score: number;
  createdAt: Date;
  updatedAt: Date;
}

// 情绪干预计划接口
export interface EmotionInterventionPlan {
  id: number;
  userId: number;
  targetEmotion: string;
  strategies: string[];
  resources: Array<{
    type: "music" | "article" | "course";
    id: number;
    title: string;
  }>;
  startDate: Date;
  endDate: Date;
  progress: number;
  status: "active" | "completed" | "cancelled";
  createdAt: Date;
  updatedAt: Date;
}

// 情绪数据导出接口
export interface EmotionDataExport {
  userId: number;
  exportType: "csv" | "json" | "pdf";
  dateRange: {
    startDate: string;
    endDate: string;
  };
  includeResources: boolean;
  includeAnalysis: boolean;
  status: "pending" | "completed" | "failed";
  downloadUrl?: string;
  createdAt: Date;
  completedAt?: Date;
}

// 情绪提醒接口
export interface EmotionReminder {
  id: number;
  userId: number;
  reminderType: "mood_check" | "breathing" | "hydration" | "stretching";
  frequency: "daily" | "weekly" | "custom";
  time: string;
  days?: number[];
  message: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// 情绪目标接口
export interface EmotionGoal {
  id: number;
  userId: number;
  goalType:
    | "mood_improvement"
    | "stress_reduction"
    | "sleep_improvement"
    | "social_interaction";
  target: number;
  current: number;
  timeframe: "week" | "month" | "quarter";
  startDate: Date;
  endDate: Date;
  status: "active" | "completed" | "cancelled";
  createdAt: Date;
  updatedAt: Date;
}

// 情绪日记接口
export interface EmotionDiary {
  id: number;
  userId: number;
  date: string;
  content: string;
  emotions: string[];
  intensity: number;
  triggers: string[];
  copingStrategies: string[];
  rating: number;
  createdAt: Date;
  updatedAt: Date;
}

// 情绪统计接口
export interface EmotionStatistics {
  userId: number;
  period: "week" | "month" | "year";
  totalEntries: number;
  averageIntensity: number;
  mostFrequentEmotion: string;
  emotionDistribution: Record<string, number>;
  triggerAnalysis: Record<string, number>;
  copingStrategyAnalysis: Record<string, number>;
  createdAt: Date;
  updatedAt: Date;
}

// 情绪洞察接口
export interface EmotionInsight {
  id: number;
  userId: number;
  insightType: "pattern" | "trend" | "recommendation";
  content: string;
  severity: "low" | "medium" | "high";
  actionRequired: boolean;
  isRead: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// 情绪支持请求接口
export interface EmotionSupportRequest {
  id: number;
  userId: number;
  requestType: "counseling" | "peer_support" | "resource_recommendation";
  content: string;
  urgency: "low" | "medium" | "high";
  status: "pending" | "in_progress" | "completed" | "cancelled";
  assignedTo?: number;
  response?: string;
  createdAt: Date;
  updatedAt: Date;
}

// 情绪支持响应接口
export interface EmotionSupportResponse {
  id: number;
  requestId: number;
  providerId: number;
  response: string;
  resources: Array<{
    type: "article" | "music" | "course";
    id: number;
    title: string;
  }>;
  followUpRequired: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// 情绪教育内容接口
export interface EmotionEducationContent {
  id: number;
  title: string;
  type: "article" | "video" | "infographic";
  content: string;
  tags: string[];
  difficultyLevel: "beginner" | "intermediate" | "advanced";
  duration: number;
  effectiveness: number;
  createdAt: Date;
  updatedAt: Date;
}

// 情绪管理工具接口
export interface EmotionManagementTool {
  id: number;
  name: string;
  type: "breathing" | "meditation" | "journaling" | "exercise";
  description: string;
  duration: number;
  effectiveness: number;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

// 情绪API响应接口
export interface EmotionAPIResponse {
  success: boolean;
  data?: any;
  error?: string;
  message?: string;
  timestamp: number;
  requestId: string;
}

// 情绪分析配置接口
export interface EmotionAnalysisConfig {
  modelName: string;
  threshold: number;
  maxEmotions: number;
  includeSuggestions: boolean;
  includeResources: boolean;
  timeout: number;
  retries: number;
}

// 情绪数据同步接口
export interface EmotionDataSync {
  userId: number;
  platform: "mobile" | "web" | "wearable";
  syncType: "full" | "incremental";
  lastSyncDate: string;
  currentSyncDate: string;
  recordCount: number;
  status: "success" | "failed" | "in_progress";
  errorMessage?: string;
  createdAt: Date;
  updatedAt: Date;
}

// 情绪预测模型训练接口
export interface EmotionModelTraining {
  id: number;
  modelName: string;
  trainingDataSize: number;
  validationDataSize: number;
  testDataSize: number;
  accuracy: number;
  precision: number;
  recall: number;
  f1Score: number;
  trainingDuration: number;
  status: "pending" | "in_progress" | "completed" | "failed";
  errorMessage?: string;
  createdAt: Date;
  completedAt?: Date;
}

// 情绪API使用统计接口
export interface EmotionAPIUsage {
  userId: number;
  endpoint: string;
  requestCount: number;
  averageResponseTime: number;
  errorCount: number;
  lastRequestDate: string;
  createdAt: Date;
  updatedAt: Date;
}

// 情绪数据隐私设置接口
export interface EmotionDataPrivacy {
  userId: number;
  dataSharing: boolean;
  modelTraining: boolean;
  thirdPartyAccess: boolean;
  dataRetention: number; // 天数
  exportAllowed: boolean;
  deleteAllowed: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// 情绪健康报告接口
export interface EmotionHealthReport {
  id: number;
  userId: number;
  reportType: "weekly" | "monthly" | "quarterly" | "yearly";
  period: string;
  content: string;
  summary: string;
  recommendations: string[];
  resources: Array<{
    type: "article" | "music" | "course";
    id: number;
    title: string;
  }>;
  status: "generated" | "viewed" | "shared";
  createdAt: Date;
  updatedAt: Date;
}

// 情绪智能助手配置接口
export interface EmotionAssistantConfig {
  userId: number;
  enabled: boolean;
  reminderFrequency: "daily" | "weekly" | "custom";
  preferredCommunication: "text" | "voice";
  language: string;
  topics: string[];
  excludedTopics: string[];
  createdAt: Date;
  updatedAt: Date;
}

// 情绪API速率限制接口
export interface EmotionAPIRateLimit {
  userId: number;
  endpoint: string;
  limit: number;
  remaining: number;
  resetTime: number;
  createdAt: Date;
  updatedAt: Date;
}

// 情绪数据备份接口
export interface EmotionDataBackup {
  id: number;
  userId: number;
  backupType: "auto" | "manual";
  backupDate: string;
  fileSize: number;
  fileUrl: string;
  status: "completed" | "failed";
  errorMessage?: string;
  createdAt: Date;
  updatedAt: Date;
}

// 情绪API日志接口
export interface EmotionAPILog {
  id: number;
  userId: number;
  endpoint: string;
  requestData: string;
  responseData: string;
  responseTime: number;
  statusCode: number;
  status: "success" | "error";
  errorMessage?: string;
  createdAt: Date;
  updatedAt: Date;
}

// 情绪分析模型接口
export interface EmotionAnalysisModel {
  id: number;
  modelName: string;
  version: string;
  description: string;
  accuracy: number;
  precision: number;
  recall: number;
  f1Score: number;
  trainingDataSize: number;
  createdAt: Date;
  updatedAt: Date;
}

// 情绪识别请求接口
export interface EmotionRecognitionRequest {
  text: string;
  audioUrl?: string;
  imageUrl?: string;
  userId?: number;
}

// 情绪识别响应接口
export interface EmotionRecognitionResponse {
  emotions: Array<{
    emotion: string;
    confidence: number;
  }>;
  primaryEmotion: string;
  intensity: number;
  suggestions: string[];
  resources: Array<{
    type: "article" | "music" | "course";
    id: number;
    title: string;
  }>;
}

// 情绪变化趋势接口
export interface EmotionTrend {
  userId: number;
  period: "week" | "month" | "year";
  trends: Array<{
    date: string;
    primaryEmotion: string;
    intensity: number;
    secondaryEmotions: string[];
  }>;
  dominantEmotion: string;
  averageIntensity: number;
  recommendations: string[];
  createdAt: Date;
  updatedAt: Date;
}

// 情绪管理课程接口
export interface EmotionManagementCourse {
  id: number;
  title: string;
  description: string;
  duration: number;
  level: "beginner" | "intermediate" | "advanced";
  modules: Array<{
    id: number;
    title: string;
    content: string;
    duration: number;
  }>;
  effectiveness: number;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

// 情绪支持小组接口
export interface EmotionSupportGroup {
  id: number;
  name: string;
  description: string;
  type: "peer" | "professional";
  membersCount: number;
  topics: string[];
  meetingFrequency: string;
  moderatorId: number;
  isPublic: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// 情绪支持小组成员接口
export interface EmotionSupportGroupMember {
  id: number;
  groupId: number;
  userId: number;
  role: "member" | "moderator" | "admin";
  joinDate: Date;
  lastActiveDate: Date;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// 情绪支持小组讨论接口
export interface EmotionSupportGroupDiscussion {
  id: number;
  groupId: number;
  userId: number;
  title: string;
  content: string;
  sentiment: "positive" | "neutral" | "negative";
  replyCount: number;
  viewCount: number;
  createdAt: Date;
  updatedAt: Date;
}

// 情绪支持小组讨论回复接口
export interface EmotionSupportGroupReply {
  id: number;
  discussionId: number;
  userId: number;
  content: string;
  sentiment: "positive" | "neutral" | "negative";
  createdAt: Date;
  updatedAt: Date;
}

// 情绪健康挑战接口
export interface EmotionHealthChallenge {
  id: number;
  title: string;
  description: string;
  duration: number;
  difficulty: "easy" | "medium" | "hard";
  participantsCount: number;
  successRate: number;
  tasks: Array<{
    id: number;
    title: string;
    description: string;
    day: number;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

// 情绪健康挑战参与者接口
export interface EmotionHealthChallengeParticipant {
  id: number;
  challengeId: number;
  userId: number;
  progress: number;
  completedTasks: number;
  status: "active" | "completed" | "dropped";
  joinDate: Date;
  completedDate?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// 情绪健康挑战任务完成接口
export interface EmotionHealthChallengeTaskCompletion {
  id: number;
  participantId: number;
  taskId: number;
  completed: boolean;
  completionDate: Date;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

// 情绪健康资源接口
export interface EmotionHealthResource {
  id: number;
  title: string;
  type: "article" | "video" | "audio" | "infographic";
  content: string;
  url: string;
  tags: string[];
  category: string;
  difficultyLevel: "beginner" | "intermediate" | "advanced";
  duration: number;
  effectiveness: number;
  createdAt: Date;
  updatedAt: Date;
}

// 情绪健康资源分类接口
export interface EmotionHealthResourceCategory {
  id: number;
  name: string;
  description: string;
  icon: string;
  parentId?: number;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

// 情绪健康资源标签接口
export interface EmotionHealthResourceTag {
  id: number;
  name: string;
  description: string;
  color: string;
  icon: string;
  usageCount: number;
  createdAt: Date;
  updatedAt: Date;
}

// 情绪健康资源收藏接口
export interface EmotionHealthResourceFavorite {
  id: number;
  userId: number;
  resourceId: number;
  favoriteDate: Date;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

// 情绪健康资源评论接口
export interface EmotionHealthResourceComment {
  id: number;
  userId: number;
  resourceId: number;
  content: string;
  rating: number;
  sentiment: "positive" | "neutral" | "negative";
  createdAt: Date;
  updatedAt: Date;
}

// 情绪健康资源分享接口
export interface EmotionHealthResourceShare {
  id: number;
  userId: number;
  resourceId: number;
  sharePlatform: "social" | "email" | "direct";
  shareDate: Date;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

// 情绪健康资源统计接口
export interface EmotionHealthResourceStatistics {
  resourceId: number;
  viewCount: number;
  downloadCount: number;
  shareCount: number;
  favoriteCount: number;
  commentCount: number;
  averageRating: number;
  lastUpdated: Date;
}

// 情绪健康资源推荐接口
export interface EmotionHealthResourceRecommendation {
  id: number;
  userId: number;
  resourceId: number;
  recommendationScore: number;
  reason: string;
  isViewed: boolean;
  isFavorite: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// 情绪健康资源搜索接口
export interface EmotionHealthResourceSearch {
  id: number;
  userId: number;
  query: string;
  filters: Record<string, any>;
  resultsCount: number;
  clickedResourceId?: number;
  searchDate: Date;
  createdAt: Date;
  updatedAt: Date;
}

// 情绪健康资源反馈接口
export interface EmotionHealthResourceFeedback {
  id: number;
  userId: number;
  resourceId: number;
  feedbackType: "useful" | "not_useful" | "inaccurate" | "inappropriate";
  comments?: string;
  feedbackDate: Date;
  createdAt: Date;
  updatedAt: Date;
}

// 情绪健康资源报告接口
export interface EmotionHealthResourceReport {
  id: number;
  userId: number;
  resourceId: number;
  reportType: "inappropriate" | "inaccurate" | "spam" | "other";
  comments: string;
  reportDate: Date;
  status: "pending" | "reviewed" | "dismissed";
  createdAt: Date;
  updatedAt: Date;
}

// 情绪健康资源审核接口
export interface EmotionHealthResourceReview {
  id: number;
  resourceId: number;
  reviewerId: number;
  reviewStatus: "approved" | "rejected" | "pending";
  comments: string;
  reviewDate: Date;
  createdAt: Date;
  updatedAt: Date;
}

// 情绪健康资源版本接口
export interface EmotionHealthResourceVersion {
  id: number;
  resourceId: number;
  version: string;
  changes: string;
  publishDate: Date;
  createdAt: Date;
  updatedAt: Date;
}

// 情绪健康资源访问接口
export interface EmotionHealthResourceAccess {
  id: number;
  userId: number;
  resourceId: number;
  accessDate: Date;
  duration: number;
  completed: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// 情绪健康资源下载接口
export interface EmotionHealthResourceDownload {
  id: number;
  userId: number;
  resourceId: number;
  downloadDate: Date;
  deviceType: string;
  IPAddress: string;
  createdAt: Date;
  updatedAt: Date;
}

// 情绪健康资源API接口
export interface EmotionHealthResourceAPI {
  id: number;
  name: string;
  endpoint: string;
  method: "GET" | "POST" | "PUT" | "DELETE";
  description: string;
  requiresAuth: boolean;
  rateLimit: number;
  documentationUrl: string;
  createdAt: Date;
  updatedAt: Date;
}

// 情绪健康资源API使用接口
export interface EmotionHealthResourceAPIUsage {
  id: number;
  apiId: number;
  userId: number;
  requestCount: number;
  errorCount: number;
  averageResponseTime: number;
  lastRequestDate: Date;
  createdAt: Date;
  updatedAt: Date;
}

// 情绪健康资源API速率限制接口
export interface EmotionHealthResourceAPIRateLimit {
  id: number;
  apiId: number;
  userId: number;
  limit: number;
  remaining: number;
  resetTime: number;
  createdAt: Date;
  updatedAt: Date;
}

// 情绪健康资源API日志接口
export interface EmotionHealthResourceAPILog {
  id: number;
  apiId: number;
  userId: number;
  requestData: string;
  responseData: string;
  responseTime: number;
  statusCode: number;
  status: "success" | "error";
  errorMessage?: string;
  createdAt: Date;
  updatedAt: Date;
}

// 情绪健康资源API统计接口
export interface EmotionHealthResourceAPIStatistics {
  apiId: number;
  requestCount: number;
  successCount: number;
  errorCount: number;
  averageResponseTime: number;
  peakUsageTime: string;
  lastUpdated: Date;
}

// 情绪健康资源API监控接口
export interface EmotionHealthResourceAPIMonitor {
  id: number;
  apiId: number;
  status: "up" | "down" | "degraded";
  responseTime: number;
  errorRate: number;
  lastCheck: Date;
  createdAt: Date;
  updatedAt: Date;
}

// 情绪健康资源API告警接口
export interface EmotionHealthResourceAPIAlert {
  id: number;
  monitorId: number;
  alertType: "response_time" | "error_rate" | "status_change";
  severity: "low" | "medium" | "high";
  message: string;
  status: "active" | "resolved";
  createdAt: Date;
  resolvedAt?: Date;
}

// 情绪健康资源API维护接口
export interface EmotionHealthResourceAPIMaintenance {
  id: number;
  apiId: number;
  maintenanceType: "scheduled" | "emergency";
  startTime: Date;
  endTime: Date;
  description: string;
  status: "pending" | "in_progress" | "completed";
  createdAt: Date;
  updatedAt: Date;
}

// 情绪健康资源API版本接口
export interface EmotionHealthResourceAPIVersion {
  id: number;
  apiId: number;
  version: string;
  changes: string;
  releaseDate: Date;
  status: "active" | "deprecated" | "retired";
  createdAt: Date;
  updatedAt: Date;
}

// 情绪健康资源API测试接口
export interface EmotionHealthResourceAPITest {
  id: number;
  apiId: number;
  testName: string;
  testData: string;
  expectedResult: string;
  actualResult: string;
  status: "passed" | "failed" | "pending";
  testDate: Date;
  createdAt: Date;
  updatedAt: Date;
}

// 情绪健康资源API文档接口
export interface EmotionHealthResourceAPIDocumentation {
  id: number;
  apiId: number;
  title: string;
  content: string;
  version: string;
  lastUpdated: Date;
  createdAt: Date;
  updatedAt: Date;
}

// 情绪健康资源API示例接口
export interface EmotionHealthResourceAPIExample {
  id: number;
  apiId: number;
  title: string;
  description: string;
  code: string;
  language: string;
  createdAt: Date;
  updatedAt: Date;
}

// 情绪健康资源API客户端接口
export interface EmotionHealthResourceAPIClient {
  id: number;
  name: string;
  apiId: number;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scope: string;
  status: "active" | "inactive";
  createdAt: Date;
  updatedAt: Date;
}

// 情绪健康资源API授权接口
export interface EmotionHealthResourceAPIAuthorization {
  id: number;
  clientId: number;
  userId: number;
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  scope: string;
  status: "active" | "expired" | "revoked";
  createdAt: Date;
  updatedAt: Date;
}

// 情绪健康资源API令牌接口
export interface EmotionHealthResourceAPIToken {
  id: number;
  userId: number;
  token: string;
  tokenType: "access" | "refresh";
  expiresAt: Date;
  scope: string;
  status: "active" | "expired" | "revoked";
  createdAt: Date;
  updatedAt: Date;
}

// 情绪健康资源API统计接口
export interface EmotionHealthResourceAPITokenStatistics {
  userId: number;
  tokenCount: number;
  activeTokens: number;
  expiredTokens: number;
  revokedTokens: number;
  lastTokenCreated: Date;
  lastTokenUsed: Date;
  createdAt: Date;
  updatedAt: Date;
}

// 情绪健康资源API令牌使用接口
export interface EmotionHealthResourceAPITokenUsage {
  id: number;
  tokenId: number;
  userId: number;
  apiId: number;
  requestDate: Date;
  statusCode: number;
  status: "success" | "error";
  errorMessage?: string;
  createdAt: Date;
  updatedAt: Date;
}

// 情绪健康资源API令牌监控接口
export interface EmotionHealthResourceAPITokenMonitor {
  id: number;
  tokenId: number;
  usageCount: number;
  errorCount: number;
  lastUsed: Date;
  createdAt: Date;
  updatedAt: Date;
}

// 情绪健康资源API令牌告警接口
export interface EmotionHealthResourceAPITokenAlert {
  id: number;
  tokenId: number;
  alertType: "usage_spike" | "error_rate" | "expiry";
  severity: "low" | "medium" | "high";
  message: string;
  status: "active" | "resolved";
  createdAt: Date;
  resolvedAt?: Date;
}

// 情绪健康资源API令牌维护接口
export interface EmotionHealthResourceAPITokenMaintenance {
  id: number;
  tokenId: number;
  maintenanceType: "revoke" | "refresh" | "rotate";
  reason: string;
  status: "pending" | "in_progress" | "completed";
  createdAt: Date;
  updatedAt: Date;
}

// 情绪健康资源API令牌版本接口
export interface EmotionHealthResourceAPITokenVersion {
  id: number;
  tokenId: number;
  version: string;
  changes: string;
  releaseDate: Date;
  status: "active" | "deprecated" | "retired";
  createdAt: Date;
  updatedAt: Date;
}

// 情绪健康资源API令牌测试接口
export interface EmotionHealthResourceAPITokenTest {
  id: number;
  tokenId: number;
  testName: string;
  testData: string;
  expectedResult: string;
  actualResult: string;
  status: "passed" | "failed" | "pending";
  testDate: Date;
  createdAt: Date;
  updatedAt: Date;
}

// 情绪健康资源API令牌文档接口
export interface EmotionHealthResourceAPITokenDocumentation {
  id: number;
  tokenId: number;
  title: string;
  content: string;
  version: string;
  lastUpdated: Date;
  createdAt: Date;
  updatedAt: Date;
}

// 情绪健康资源API令牌示例接口
export interface EmotionHealthResourceAPITokenExample {
  id: number;
  tokenId: number;
  title: string;
  description: string;
  code: string;
  language: string;
  createdAt: Date;
  updatedAt: Date;
}

// 情绪健康资源API令牌客户端接口
export interface EmotionHealthResourceAPITokenClient {
  id: number;
  name: string;
  tokenId: number;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scope: string;
  status: "active" | "inactive";
  createdAt: Date;
  updatedAt: Date;
}

// 情绪健康资源API令牌授权接口
export interface EmotionHealthResourceAPITokenAuthorization {
  id: number;
  clientId: number;
  tokenId: number;
  userId: number;
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  scope: string;
  status: "active" | "expired" | "revoked";
  createdAt: Date;
  updatedAt: Date;
}

// 情绪健康资源API令牌统计接口
export interface EmotionHealthResourceAPITokenAuthorizationStatistics {
  userId: number;
  authorizationCount: number;
  activeAuthorizations: number;
  expiredAuthorizations: number;
  revokedAuthorizations: number;
  lastAuthorizationCreated: Date;
  lastAuthorizationUsed: Date;
  createdAt: Date;
  updatedAt: Date;
}

// 情绪健康资源API令牌使用接口
export interface EmotionHealthResourceAPITokenAuthorizationUsage {
  id: number;
  authorizationId: number;
  userId: number;
  tokenId: number;
  apiId: number;
  requestDate: Date;
  statusCode: number;
  status: "success" | "error";
  errorMessage?: string;
  createdAt: Date;
  updatedAt: Date;
}

// 情绪健康资源API令牌监控接口
export interface EmotionHealthResourceAPITokenAuthorizationMonitor {
  id: number;
  authorizationId: number;
  usageCount: number;
  errorCount: number;
  lastUsed: Date;
  createdAt: Date;
  updatedAt: Date;
}

// 情绪健康资源API令牌告警接口
export interface EmotionHealthResourceAPITokenAuthorizationAlert {
  id: number;
  authorizationId: number;
  alertType: "usage_spike" | "error_rate" | "expiry";
  severity: "low" | "medium" | "high";
  message: string;
  status: "active" | "resolved";
  createdAt: Date;
  resolvedAt?: Date;
}

// 情绪健康资源API令牌维护接口
export interface EmotionHealthResourceAPITokenAuthorizationMaintenance {
  id: number;
  authorizationId: number;
  maintenanceType: "revoke" | "refresh" | "rotate";
  reason: string;
  status: "pending" | "in_progress" | "completed";
  createdAt: Date;
  updatedAt: Date;
}

// 情绪健康资源API令牌版本接口
export interface EmotionHealthResourceAPITokenAuthorizationVersion {
  id: number;
  authorizationId: number;
  version: string;
  changes: string;
  releaseDate: Date;
  status: "active" | "deprecated" | "retired";
  createdAt: Date;
  updatedAt: Date;
}

// 情绪健康资源API令牌测试接口
export interface EmotionHealthResourceAPITokenAuthorizationTest {
  id: number;
  authorizationId: number;
  testName: string;
  testData: string;
  expectedResult: string;
  actualResult: string;
  status: "passed" | "failed" | "pending";
  testDate: Date;
  createdAt: Date;
  updatedAt: Date;
}

// 情绪健康资源API令牌文档接口
export interface EmotionHealthResourceAPITokenAuthorizationDocumentation {
  id: number;
  authorizationId: number;
  title: string;
  content: string;
  version: string;
  lastUpdated: Date;
  createdAt: Date;
  updatedAt: Date;
}

// 情绪健康资源API令牌示例接口
export interface EmotionHealthResourceAPITokenAuthorizationExample {
  id: number;
  authorizationId: number;
  title: string;
  description: string;
  code: string;
  language: string;
  createdAt: Date;
  updatedAt: Date;
}

// 情绪健康资源API令牌客户端接口
export interface EmotionHealthResourceAPITokenAuthorizationClient {
  id: number;
  name: string;
  authorizationId: number;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scope: string;
  status: "active" | "inactive";
  createdAt: Date;
  updatedAt: Date;
}
