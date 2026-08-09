/**
 * 五周期情绪分析数据版本服务
 * 从用户 MySQL 记录聚合数据，生成稳定 dataVersion/inputHash 实现版本化复用
 */
import crypto from 'crypto'
import { getMysqlPool } from '../config/mysql'
import { createMoodRepository } from '../repositories/moodRepository'
import { ResultSetHeader, RowDataPacket } from 'mysql2'
import logger from '../utils/logger'

export type AnalysisPeriod = '7d' | '1m' | '3m' | '6m' | '1y'

export const VALID_PERIODS: AnalysisPeriod[] = ['7d', '1m', '3m', '6m', '1y']

export interface AnalysisVersion {
  id: number
  userId: number
  period: AnalysisPeriod
  dataVersion: string
  inputHash: string
  recordIds: number[]
  recordCount: number
  dataRangeStart: string
  dataRangeEnd: string
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'stale'
  analysisContent: Record<string, unknown> | null
  errorMessage: string | null
  isStale: boolean
  staleReason: string | null
  createdAt: string
  updatedAt: string
}

export interface CreateAnalysisInput {
  userId: number
  period: AnalysisPeriod
}

export interface AggregatedData {
  recordIds: number[]
  recordCount: number
  dataRangeStart: string
  dataRangeEnd: string
  dataVersion: string
  inputHash: string
  /** 聚合的统计摘要（不包含日记原文） */
  summary: {
    totalRecords: number
    avgIntensity: number
    emotionDistribution: Array<{ name: string; count: number; percentage: number }>
    dominantEmotion: string | null
    positiveRatio: number
    negativeRatio: number
    neutralRatio: number
  }
}

function resolvePeriodRange(period: AnalysisPeriod): { startDate: Date; endDate: Date } {
  const now = new Date()
  const endDate = new Date(now.toISOString().split('T')[0] + 'T23:59:59.999Z')
  const startDate = new Date(now)

  switch (period) {
    case '7d':
      startDate.setUTCDate(startDate.getUTCDate() - 7)
      break
    case '1m':
      startDate.setUTCMonth(startDate.getUTCMonth() - 1)
      break
    case '3m':
      startDate.setUTCMonth(startDate.getUTCMonth() - 3)
      break
    case '6m':
      startDate.setUTCMonth(startDate.getUTCMonth() - 6)
      break
    case '1y':
      startDate.setUTCFullYear(startDate.getUTCFullYear() - 1)
      break
  }

  return { startDate, endDate }
}

export const createMoodAnalysisDataService = () => {
  const pool = getMysqlPool()
  const moodRepo = createMoodRepository()

  /**
   * 聚合用户指定周期的情绪记录，生成 dataVersion 和 inputHash（不含日记原文）
   */
  const aggregateData = async (userId: number, period: AnalysisPeriod): Promise<AggregatedData | null> => {
    const { startDate, endDate } = resolvePeriodRange(period)
    const startStr = startDate.toISOString().split('T')[0]
    const endStr = endDate.toISOString().split('T')[0]

    const rows = await moodRepo.listAnalysisRows(userId, startStr, endStr)

    if (rows.length === 0) return null

    // 去重 recordId 并排序
    const recordIds = [...new Set(rows.map((r) => r.moodId))].sort((a, b) => a - b)
    const recordCount = recordIds.length

    // 统计聚合（不包含日记原文）
    const emotionCounts = new Map<string, number>()
    let totalIntensity = 0
    const categoryCounts = { positive: 0, negative: 0, neutral: 0 }

    for (const row of rows) {
      totalIntensity += row.intensity
      emotionCounts.set(row.emotionName, (emotionCounts.get(row.emotionName) ?? 0) + 1)
      categoryCounts[row.emotionCategory] = (categoryCounts[row.emotionCategory] ?? 0) + 1
    }

    const totalEmotions = rows.length
    const avgIntensity = Math.round((totalIntensity / totalEmotions) * 10) / 10
    const emotionDistribution = Array.from(emotionCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({
        name,
        count,
        percentage: Math.round((count / totalEmotions) * 10000) / 10000,
      }))
    const dominantEmotion = emotionDistribution[0]?.name ?? null

    // 生成 dataVersion: recordIds 哈希
    const versionSource = `${period}:${recordIds.join(',')}`
    const dataVersion = crypto.createHash('sha256').update(versionSource).digest('hex').substring(0, 16)

    // 生成 inputHash: 仅统计摘要哈希（用于复用判断）
    const inputSource = JSON.stringify({
      recordCount,
      avgIntensity,
      emotionDistribution,
      dominantEmotion,
      positiveRatio: Math.round((categoryCounts.positive / totalEmotions) * 10000) / 10000,
      negativeRatio: Math.round((categoryCounts.negative / totalEmotions) * 10000) / 10000,
      neutralRatio: Math.round((categoryCounts.neutral / totalEmotions) * 10000) / 10000,
    })
    const inputHash = crypto.createHash('sha256').update(inputSource).digest('hex').substring(0, 16)

    return {
      recordIds,
      recordCount,
      dataRangeStart: startStr,
      dataRangeEnd: endStr,
      dataVersion,
      inputHash,
      summary: {
        totalRecords: recordCount,
        avgIntensity,
        emotionDistribution,
        dominantEmotion,
        positiveRatio: Math.round((categoryCounts.positive / totalEmotions) * 10000) / 10000,
        negativeRatio: Math.round((categoryCounts.negative / totalEmotions) * 10000) / 10000,
        neutralRatio: Math.round((categoryCounts.neutral / totalEmotions) * 10000) / 10000,
      },
    }
  }

  /**
   * 创建或复用分析版本
   * 0 条记录 → 不建任务，1 条记录 → single_record 标记
   */
  const createOrReuseAnalysis = async (
    userId: number,
    period: AnalysisPeriod,
  ): Promise<{ version: AnalysisVersion; reused: boolean; reason: string }> => {
    const data = await aggregateData(userId, period)

    if (!data || data.recordCount === 0) {
      throw Object.assign(new Error('该周期内无情绪记录，无法创建分析'), { code: 'NO_RECORDS' })
    }

    if (data.recordCount === 1) {
      logger.info(`[moodAnalysis] single_record for user ${userId}, period ${period}`)
    }

    // 检查是否已有相同 dataVersion 的记录
    const [existing] = await pool.query(
      `SELECT * FROM mood_analysis_versions
       WHERE user_id = ? AND period = ? AND data_version = ? AND status = 'completed'
       LIMIT 1`,
      [userId, period, data.dataVersion],
    ) as [RowDataPacket[], unknown]

    if (existing.length > 0) {
      const row = existing[0]
      return {
        version: mapRowToVersion(row),
        reused: true,
        reason: '数据未变更，复用已有分析结果',
      }
    }

    // 标记同周期旧版本为 stale
    await pool.query(
      `UPDATE mood_analysis_versions SET is_stale = 1, stale_reason = '新版本已创建'
       WHERE user_id = ? AND period = ? AND is_stale = 0 AND status = 'completed'`,
      [userId, period],
    )

    // 创建新版本
    const [result] = await pool.query(
      `INSERT INTO mood_analysis_versions
       (user_id, period, data_version, input_hash, record_ids, record_count, data_range_start, data_range_end, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
      [
        userId,
        period,
        data.dataVersion,
        data.inputHash,
        JSON.stringify(data.recordIds),
        data.recordCount,
        data.dataRangeStart,
        data.dataRangeEnd,
      ],
    ) as [ResultSetHeader, unknown]

    const version: AnalysisVersion = {
      id: result.insertId,
      userId,
      period,
      dataVersion: data.dataVersion,
      inputHash: data.inputHash,
      recordIds: data.recordIds,
      recordCount: data.recordCount,
      dataRangeStart: data.dataRangeStart,
      dataRangeEnd: data.dataRangeEnd,
      status: 'pending',
      analysisContent: null,
      errorMessage: null,
      isStale: false,
      staleReason: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    return { version, reused: false, reason: data.recordCount === 1 ? '仅一条记录，标记为单次回顾' : '新分析任务已创建' }
  }

  /**
   * 获取最新分析版本
   */
  const getLatestAnalysis = async (userId: number, period: AnalysisPeriod): Promise<AnalysisVersion | null> => {
    const [rows] = await pool.query(
      `SELECT * FROM mood_analysis_versions
       WHERE user_id = ? AND period = ?
       ORDER BY created_at DESC LIMIT 1`,
      [userId, period],
    ) as [RowDataPacket[], unknown]

    return rows.length > 0 ? mapRowToVersion(rows[0]) : null
  }

  /**
   * 分页列出分析版本
   */
  const listAnalyses = async (
    userId: number,
    period: AnalysisPeriod,
    page: number,
    pageSize: number,
  ): Promise<{ list: AnalysisVersion[]; total: number }> => {
    const offset = (page - 1) * pageSize
    const [countRows] = await pool.query(
      `SELECT COUNT(*) as total FROM mood_analysis_versions WHERE user_id = ? AND period = ?`,
      [userId, period],
    ) as [RowDataPacket[], unknown]
    const total = Number(countRows[0]?.total ?? 0)

    const [rows] = await pool.query(
      `SELECT * FROM mood_analysis_versions
       WHERE user_id = ? AND period = ?
       ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [userId, period, pageSize, offset],
    ) as [RowDataPacket[], unknown]

    return {
      list: rows.map(mapRowToVersion),
      total,
    }
  }

  /**
   * 获取分析详情（按 id + userId 过滤）
   */
  const getAnalysisById = async (id: number, userId: number): Promise<AnalysisVersion | null> => {
    const [rows] = await pool.query(
      `SELECT * FROM mood_analysis_versions WHERE id = ? AND user_id = ?`,
      [id, userId],
    ) as [RowDataPacket[], unknown]

    return rows.length > 0 ? mapRowToVersion(rows[0]) : null
  }

  /**
   * 更新分析状态
   */
  const updateStatus = async (
    id: number,
    status: AnalysisVersion['status'],
    analysisContent?: Record<string, unknown> | null,
    errorMessage?: string | null,
  ): Promise<void> => {
    await pool.query(
      `UPDATE mood_analysis_versions SET status = ?, analysis_content = ?, error_message = ? WHERE id = ?`,
      [status, analysisContent ? JSON.stringify(analysisContent) : null, errorMessage ?? null, id],
    )
  }

  /**
   * 标记旧版本为 stale（当底层记录被编辑/删除时调用）
   */
  const markStaleByRecordIds = async (recordIds: number[]): Promise<void> => {
    if (recordIds.length === 0) return
    const placeholders = recordIds.map(() => '?').join(',')
    await pool.query(
      `UPDATE mood_analysis_versions
       SET is_stale = 1, stale_reason = '底层情绪记录已变更'
       WHERE is_stale = 0 AND status = 'completed' AND ${recordIds.map(() => `JSON_CONTAINS(record_ids, ?)`).join(' OR ')}`,
      recordIds.map((id) => String(id)),
    )
  }

  /**
   * 删除分析版本（仅本人；super_admin 可删任意）
   */
  const deleteAnalysis = async (
    id: number,
    userId: number,
    isSuperAdmin: boolean,
  ): Promise<boolean> => {
    const sql = isSuperAdmin
      ? `DELETE FROM mood_analysis_versions WHERE id = ?`
      : `DELETE FROM mood_analysis_versions WHERE id = ? AND user_id = ?`
    const params = isSuperAdmin ? [id] : [id, userId]
    const [result] = await pool.query<ResultSetHeader>(sql, params)
    return result.affectedRows > 0
  }

  function mapRowToVersion(row: RowDataPacket): AnalysisVersion {
    return {
      id: row.id,
      userId: row.user_id,
      period: row.period,
      dataVersion: row.data_version,
      inputHash: row.input_hash,
      recordIds: typeof row.record_ids === 'string' ? JSON.parse(row.record_ids) : row.record_ids,
      recordCount: row.record_count,
      dataRangeStart: row.data_range_start instanceof Date ? row.data_range_start.toISOString().split('T')[0] : row.data_range_start,
      dataRangeEnd: row.data_range_end instanceof Date ? row.data_range_end.toISOString().split('T')[0] : row.data_range_end,
      status: row.status,
      analysisContent: typeof row.analysis_content === 'string' ? JSON.parse(row.analysis_content) : row.analysis_content,
      errorMessage: row.error_message,
      isStale: Boolean(row.is_stale),
      staleReason: row.stale_reason,
      createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
      updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : row.updated_at,
    }
  }

  return {
    aggregateData,
    createOrReuseAnalysis,
    getLatestAnalysis,
    listAnalyses,
    getAnalysisById,
    updateStatus,
    markStaleByRecordIds,
    deleteAnalysis,
  }
}

export type MoodAnalysisDataService = ReturnType<typeof createMoodAnalysisDataService>