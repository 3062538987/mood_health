/**
 * 分析调度器 — 将情绪分析请求转发到 FastAPI 微服务。
 *
 * 职责：
 * 1. 从 MySQL 聚合用户情绪数据
 * 2. 构建符合合同的分析请求
 * 3. 调用 FastAPI /api/analyze/mood
 * 4. 返回已验证的分析结果
 *
 * 不直接调用 AI API，所有 AI 调用通过 FastAPI 完成。
 */

import { getMysqlPool } from '../config/mysql';
import type {
  MoodAnalysisRequest,
  MoodAnalysisResponse,
  MetricPoint,
  TrendPoint,
} from '../contracts/moodAnalysis';
import { validateRequestExtraFields, validateForbiddenFields } from '../contracts/moodAnalysis';
import { generateAuthHeaders } from './fastApiClient';
import axios from 'axios';
import logger from '../utils/logger';

const FASTAPI_BASE_URL = process.env.FASTAPI_BASE_URL || 'http://127.0.0.1:8001';
const FASTAPI_TIMEOUT = 30000;

/**
 * 分析请求选项
 */
export interface AnalysisOptions {
  userId: number;
  period: string;
  locale?: string;
  journalExcerpt?: string | null;
  journalConsent?: boolean;
}

/**
 * 从 MySQL 获取用户情绪指标数据
 */
async function fetchMoodMetrics(userId: number, period: string): Promise<MetricPoint[]> {
  const pool = getMysqlPool();
  const days = periodToDays(period);
  const [rows] = await pool.query<any[]>(
    `SELECT
       DATE_FORMAT(mr.recorded_at, '%Y-%m-%d') AS date,
       et.name AS emotionName,
       et.category AS emotionCategory,
       ROUND(AVG(mr.intensity), 1) AS intensity,
       COUNT(*) AS count
     FROM mood_records mr
     JOIN emotion_types et ON mr.emotion_type_id = et.id
     WHERE mr.user_id = ? AND mr.recorded_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
     GROUP BY DATE_FORMAT(mr.recorded_at, '%Y-%m-%d'), et.name, et.category
     ORDER BY date`,
    [userId, days]
  );
  return rows.map((r: any) => ({
    date: r.date,
    emotionName: r.emotionName,
    emotionCategory: r.emotionCategory,
    intensity: Number(r.intensity),
    count: Number(r.count),
  }));
}

/**
 * 从 MySQL 获取用户情绪趋势数据
 */
async function fetchMoodTrend(userId: number, period: string): Promise<TrendPoint[]> {
  const pool = getMysqlPool();
  const days = periodToDays(period);
  const [rows] = await pool.query<any[]>(
    `SELECT
       DATE_FORMAT(mr.recorded_at, '%Y-%m-%d') AS date,
       ROUND(AVG(mr.intensity), 1) AS avgIntensity,
       COUNT(*) AS recordCount,
       (SELECT et.name FROM emotion_types et
        JOIN mood_records mr2 ON mr2.emotion_type_id = et.id
        WHERE mr2.user_id = ? AND DATE(mr2.recorded_at) = DATE(mr.recorded_at)
        GROUP BY et.name ORDER BY COUNT(*) DESC LIMIT 1) AS dominantEmotion
     FROM mood_records mr
     WHERE mr.user_id = ? AND mr.recorded_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
     GROUP BY DATE_FORMAT(mr.recorded_at, '%Y-%m-%d')
     ORDER BY date`,
    [userId, userId, days]
  );
  return rows.map((r: any) => ({
    date: r.date,
    avgIntensity: Number(r.avgIntensity),
    dominantEmotion: r.dominantEmotion || '',
    recordCount: Number(r.recordCount),
  }));
}

/**
 * 从 MySQL 获取用户触发因素
 */
async function fetchTriggers(userId: number, period: string): Promise<string[]> {
  const pool = getMysqlPool();
  const days = periodToDays(period);
  const [rows] = await pool.query<any[]>(
    `SELECT DISTINCT t.name
     FROM mood_record_tags mrt
     JOIN tags t ON mrt.tag_id = t.id
     JOIN mood_records mr ON mrt.mood_record_id = mr.id
     WHERE mr.user_id = ? AND mr.recorded_at >= DATE_SUB(NOW(), INTERVAL ? DAY)`,
    [userId, days]
  );
  return rows.map((r: any) => r.name);
}

function periodToDays(period: string): number {
  switch (period) {
    case '7d': return 7;
    case '1m': return 30;
    case '3m': return 90;
    case '6m': return 180;
    case '1y': return 365;
    default: return 7;
  }
}

/**
 * 构建分析请求
 */
export async function buildAnalysisRequest(options: AnalysisOptions): Promise<MoodAnalysisRequest> {
  const { userId, period, locale = 'zh-CN', journalExcerpt = null, journalConsent = false } = options;

  const [metrics, trend, triggers] = await Promise.all([
    fetchMoodMetrics(userId, period),
    fetchMoodTrend(userId, period),
    fetchTriggers(userId, period),
  ]);

  const request: MoodAnalysisRequest = {
    contractVersion: '1.0.0',
    requestId: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    period: period as MoodAnalysisRequest['period'],
    dataVersion: 'v1',
    locale,
    metrics,
    trend,
    triggers,
    journalExcerpt,
    journalConsent,
  };

  // 发送前验证额外字段
  const extraFields = validateRequestExtraFields(request as unknown as Record<string, unknown>);
  if (extraFields.length > 0) {
    logger.warn('分析请求包含额外字段: %s', extraFields.join(', '));
  }

  return request;
}

/**
 * 调用 FastAPI 执行情绪分析
 */
export async function dispatchAnalysis(
  request: MoodAnalysisRequest
): Promise<MoodAnalysisResponse> {
  const token = process.env.AI_SERVICE_INTERNAL_TOKEN || '';
  const body = JSON.stringify(request);

  // 生成认证头
  const authHeaders = generateAuthHeaders(body, token);

  logger.info('发送分析请求: requestId=%s, period=%s', request.requestId, request.period);

  const response = await axios.post<MoodAnalysisResponse>(
    `${FASTAPI_BASE_URL}/api/analyze/mood`,
    request,
    {
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
      },
      timeout: FASTAPI_TIMEOUT,
    }
  );

  const result = response.data;

  // 验证响应
  const forbiddenFields = validateForbiddenFields(result as unknown as Record<string, unknown>);
  if (forbiddenFields.length > 0) {
    logger.error('AI 响应包含禁止字段: %s', forbiddenFields.join(', '));
    throw new Error(`AI 响应包含禁止字段: ${forbiddenFields.join(', ')}`);
  }

  logger.info(
    '分析完成: requestId=%s, provider=%s, model=%s',
    request.requestId,
    result.provider,
    result.model
  );

  return result;
}

/**
 * 一键分析：构建请求 + 调度 FastAPI
 */
export async function analyzeMood(options: AnalysisOptions): Promise<MoodAnalysisResponse> {
  const request = await buildAnalysisRequest(options);
  return dispatchAnalysis(request);
}