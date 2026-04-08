/**
 * AI模块配置文件
 * 定义AI相关的配置项，包括模型类型、API地址、参数等
 */

// AI模型类型
export enum AiModelType {
  OPENAI = 'openai',
  LOCAL = 'local',
  DEEPSEEK = 'deepseek'
}

// AI配置接口
export interface AiConfig {
  modelType: AiModelType;
  apiBaseUrl: string;
  apiKey: string;
  timeout: number;
  maxRetries: number;
  cacheTTL: number;
  enableCache: boolean;
  enableRateLimit: boolean;
  rateLimit: {
    maxRequests: number;
    windowMs: number;
  };
  models: {
    moodAnalysis: string;
    contentAudit: string;
    recommendation: string;
  };
}

// 环境变量获取函数
const getEnv = (key: string, defaultValue: string): string => {
  return process.env[key] || defaultValue;
};

const getEnvNumber = (key: string, defaultValue: number): number => {
  const value = process.env[key];
  return value ? parseInt(value, 10) : defaultValue;
};

const getEnvBoolean = (key: string, defaultValue: boolean): boolean => {
  const value = process.env[key];
  return value ? value.toLowerCase() === 'true' : defaultValue;
};

// AI配置
const aiConfig: AiConfig = {
  modelType: (getEnv('AI_MODEL_TYPE', 'local') as AiModelType) || AiModelType.LOCAL,
  apiBaseUrl: getEnv('AI_API_BASE_URL', 'http://localhost:8000/api'),
  apiKey: getEnv('AI_API_KEY', ''),
  timeout: getEnvNumber('AI_TIMEOUT', 30000),
  maxRetries: getEnvNumber('AI_MAX_RETRIES', 3),
  cacheTTL: getEnvNumber('AI_CACHE_TTL', 3600), // 1小时
  enableCache: getEnvBoolean('AI_ENABLE_CACHE', true),
  enableRateLimit: getEnvBoolean('AI_ENABLE_RATE_LIMIT', true),
  rateLimit: {
    maxRequests: getEnvNumber('AI_RATE_LIMIT_MAX_REQUESTS', 60), // 60次/分钟
    windowMs: getEnvNumber('AI_RATE_LIMIT_WINDOW_MS', 60000) // 1分钟
  },
  models: {
    moodAnalysis: getEnv('AI_MODEL_MOOD_ANALYSIS', 'gpt-4o-mini'),
    contentAudit: getEnv('AI_MODEL_CONTENT_AUDIT', 'gpt-4o-mini'),
    recommendation: getEnv('AI_MODEL_RECOMMENDATION', 'gpt-4o-mini')
  }
};

export default aiConfig;
