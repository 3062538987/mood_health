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
import type { RowDataPacket } from 'mysql2';
import type {
  MoodAnalysisRequest,
  MoodAnalysisResponse,
  MetricPoint,
  TrendPoint,
} from '../contracts/moodAnalysis';
import { validateRequestExtraFields, validateForbiddenFields } from '../contracts/moodAnalysis';
import { callMoodAnalysis } from './fastApiClient';
import logger from '../utils/logger'
import { createMoodAnalysisDataService } from './moodAnalysisDataService';

/**
 * 分析请求选项
 */
export interface AnalysisOptions {
  userId: number;
  period: string;
  locale?: string;
  journalExcerpt?: string | null;
  journalConsent?: boolean;
  /** 关联的分析版本 id，用于把 AI 结果落库到 mood_analysis_versions */
  versionId?: number;
}

/**
 * 从 MySQL 获取用户情绪指标数据
 */
async function fetchMoodMetrics(userId: number, period: string): Promise<MetricPoint[]> {
  const pool = getMysqlPool();
  const days = periodToDays(period);
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT
       DATE_FORMAT(m.recorded_at, '%Y-%m-%d') AS date,
       et.name AS emotionName,
       et.category AS emotionCategory,
       ROUND(AVG(me.intensity), 1) AS intensity,
       COUNT(*) AS count
     FROM mood_emotions me
     JOIN moods m ON me.mood_id = m.id
     JOIN emotion_types et ON me.emotion_type_id = et.id
     WHERE m.user_id = ? AND m.recorded_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
     GROUP BY DATE_FORMAT(m.recorded_at, '%Y-%m-%d'), et.name, et.category
     ORDER BY date`,
    [userId, days]
  );
  return rows.map((r: RowDataPacket) => ({
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
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT
       DATE_FORMAT(m.recorded_at, '%Y-%m-%d') AS date,
       ROUND(AVG(me.intensity), 1) AS avgIntensity,
       COUNT(DISTINCT m.id) AS recordCount,
       (SELECT et.name FROM emotion_types et
        JOIN mood_emotions me2 ON me2.emotion_type_id = et.id
        JOIN moods m2 ON me2.mood_id = m2.id
        WHERE m2.user_id = ? AND DATE(m2.recorded_at) = DATE(m.recorded_at)
        GROUP BY et.name ORDER BY COUNT(*) DESC LIMIT 1) AS dominantEmotion
     FROM moods m
     JOIN mood_emotions me ON me.mood_id = m.id
     WHERE m.user_id = ? AND m.recorded_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
     GROUP BY DATE_FORMAT(m.recorded_at, '%Y-%m-%d')
     ORDER BY date`,
    [userId, userId, days]
  );
  return rows.map((r: RowDataPacket) => ({
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
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT DISTINCT t.name
     FROM mood_tags mt
     JOIN tags t ON mt.tag_id = t.id
     JOIN moods m ON mt.mood_id = m.id
     WHERE m.user_id = ? AND m.recorded_at >= DATE_SUB(NOW(), INTERVAL ? DAY)`,
    [userId, days]
  );
  return rows.map((r: RowDataPacket) => r.name);
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
 * 隐私保护（纵深防御）：未获得用户授权时，绝不把日记原文外发到 AI 服务。
 * 即便调用方误传了 journalExcerpt，只要 journalConsent 为 false 也强制置空，
 * 满足 AI 服务的契约要求（consent=false 时 journalExcerpt 必须为 null）。
 */
export function resolveJournalExcerpt(
  journalExcerpt: string | null | undefined,
  journalConsent: boolean,
): string | null {
  return journalConsent ? (journalExcerpt ?? null) : null;
}

/**
 * 构建分析请求
 */
export async function buildAnalysisRequest(options: AnalysisOptions): Promise<MoodAnalysisRequest> {
  const { userId, period, locale = 'zh-CN', journalExcerpt = null, journalConsent = false } = options;

  const safeJournalExcerpt = resolveJournalExcerpt(journalExcerpt, journalConsent);

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
    journalExcerpt: safeJournalExcerpt,
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
  request: MoodAnalysisRequest,
  versionId?: number
): Promise<MoodAnalysisResponse> {
  logger.info('发送分析请求: requestId=%s, period=%s', request.requestId, request.period);

  const result = await callMoodAnalysis(request);

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

  // 将分析结果落库到 mood_analysis_versions
  if (versionId) {
    try {
      const dataService = createMoodAnalysisDataService()
      await dataService.updateStatus(versionId, 'completed', result as unknown as Record<string, unknown>)
      logger.info('分析结果已落库: versionId=%d', versionId)
    } catch (saveError) {
      logger.error('分析结果落库失败: versionId=%d, error=%s', versionId, saveError)
      // 不再静默吞掉：落库失败必须上浮，让 runAnalysis 走 502 失败分支，
      // 否则会出现「AI 已生成但 analysis_content 为空却返回 200 分析完成」的假成功。
      throw new Error(
        `分析结果落库失败（AI 已生成但写入 mood_analysis_versions 出错）: ${
          saveError instanceof Error ? saveError.message : String(saveError)
        }`
      )
    }
  }

  return result;
}

/**
 * 一键分析：构建请求 + 调度 FastAPI
 * 若传入 versionId，则 AI 结果会自动落库到 mood_analysis_versions（pending → completed）
 */
export async function analyzeMood(options: AnalysisOptions): Promise<MoodAnalysisResponse> {
  const request = await buildAnalysisRequest(options);
  return dispatchAnalysis(request, options.versionId);
}
