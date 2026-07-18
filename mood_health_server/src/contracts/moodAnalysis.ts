/**
 * 情绪分析合同 — Node ↔ FastAPI 唯一接口定义。
 * 与 Python Pydantic 模型 mood_health_ai_service/app/models/contracts.py 严格对齐。
 * 额外字段禁止，禁止 mood_score/confidence/diagnosis。
 */

// ---- 请求 ----

export type Period = '7d' | '1m' | '3m' | '6m' | '1y';

export interface MetricPoint {
  /** ISO 日期 YYYY-MM-DD */
  date: string;
  emotionName: string;
  emotionCategory: 'positive' | 'negative' | 'neutral';
  /** 1-10 */
  intensity: number;
  /** >= 1 */
  count: number;
}

export interface TrendPoint {
  /** ISO 日期 YYYY-MM-DD */
  date: string;
  /** 1-10 */
  avgIntensity: number;
  dominantEmotion: string;
  /** >= 1 */
  recordCount: number;
}

export interface MoodAnalysisRequest {
  contractVersion: string;
  requestId: string;
  period: Period;
  dataVersion: string;
  locale: string;
  metrics: MetricPoint[];
  trend: TrendPoint[];
  triggers: string[];
  journalExcerpt: string | null;
  journalConsent: boolean;
}

/**
 * 验证函数：拒绝请求中携带额外字段
 * 返回被拒绝的额外字段名列表
 */
export function validateRequestExtraFields(payload: Record<string, unknown>): string[] {
  const allowedFields = new Set([
    'contractVersion',
    'requestId',
    'period',
    'dataVersion',
    'locale',
    'metrics',
    'trend',
    'triggers',
    'journalExcerpt',
    'journalConsent',
  ]);
  return Object.keys(payload).filter((k) => !allowedFields.has(k));
}

// ---- 响应 ----

export interface PatternItem {
  title: string;
  observation: string;
  evidence: string;
  caveat?: string | null;
}

export interface ActionItem {
  title: string;
  steps: string[];
  estimatedMinutes?: number | null;
}

export interface MoodAnalysisResponse {
  summary: string;
  patterns: PatternItem[];
  possibleFactors: string[];
  actions: ActionItem[];
  whenToSeekHelp: string | null;
  warnings: string[];
  provider: string;
  model: string;
  promptVersion: string;
}

/**
 * 验证函数：拒绝响应中携带额外字段
 */
export function validateResponseExtraFields(payload: Record<string, unknown>): string[] {
  const allowedFields = new Set([
    'summary',
    'patterns',
    'possibleFactors',
    'actions',
    'whenToSeekHelp',
    'warnings',
    'provider',
    'model',
    'promptVersion',
  ]);
  return Object.keys(payload).filter((k) => !allowedFields.has(k));
}

/**
 * 验证函数：检查是否存在禁止字段 (mood_score, confidence, diagnosis)
 */
export function validateForbiddenFields(payload: Record<string, unknown>): string[] {
  const forbidden = ['mood_score', 'confidence', 'diagnosis'];
  return forbidden.filter((f) => f in payload);
}