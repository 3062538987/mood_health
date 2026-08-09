/**
 * AI 情绪分析闭环联调（集成测试）
 *
 * 目标：端到端验证「触发分析 → 调用 AI 服务(真实 DeepSeek) → 结果落库 mood_analysis_versions
 *       → 读回」这条链路在代码改动后仍然打通。
 *
 * 前置依赖（需本机已起）：
 *   - Docker MySQL/Redis（moodCrud 集成测试已用到）
 *   - AI 服务监听 127.0.0.1:8001 且 AI_SERVICE_INTERNAL_TOKEN 与后端一致、DeepSeek Key 有效
 *
 * 若 AI 服务未起或 Key 失效，本测试会如实失败（网络/500），但不会污染其他套件。
 */
import dotenv from 'dotenv'
dotenv.config()

import { getMysqlPool } from '../../src/config/mysql'
import { createMoodAnalysisDataService } from '../../src/services/moodAnalysisDataService'
import { analyzeMood } from '../../src/services/analysisDispatcher'
import type { RowDataPacket } from 'mysql2'

type Period = '7d' | '1m' | '3m' | '6m' | '1y'

describe('AI 分析闭环联调', () => {
  it(
    '为近期有情绪记录的用户触发分析并落库真实结果',
    async () => {
      const pool = getMysqlPool()

      // 1. 找全表最新一条情绪记录（按 recorded_at，与产品聚合口径一致），确定用户
      const [latest] = (await pool.query(
        `SELECT user_id, recorded_at FROM moods ORDER BY recorded_at DESC LIMIT 1`,
      )) as [RowDataPacket[], unknown]
      if (!latest || latest.length === 0) {
        throw new Error('moods 表无数据，无法联调；请先准备测试情绪数据')
      }
      const userId = Number(latest[0].user_id)

      const dataService = createMoodAnalysisDataService()

      // 2. 选定一个「确有情绪记录」的统计周期（7d→1m→3m→6m→1y 依次尝试），
      //    创建/复用分析版本（pending → 后续 completed）。
      //    注意：产品聚合与列表均按 recorded_at 过滤，必须用真实有数据的周期，否则会 NO_RECORDS。
      const periods: Period[] = ['7d', '1m', '3m', '6m', '1y']
      let version: { id: number } | null = null
      let period: Period = '7d'
      let lastErr: unknown = null
      for (const p of periods) {
        try {
          const res = await dataService.createOrReuseAnalysis(userId, p)
          version = res.version
          period = p
          break
        } catch (e) {
          lastErr = e
          const code = (e as { code?: string })?.code
          if (code === 'NO_RECORDS') continue
          throw e
        }
      }
      if (!version) {
        throw new Error(
          `用户 ${userId} 在各周期均无情绪记录，无法联调: ${String(lastErr)}`,
        )
      }
      // eslint-disable-next-line no-console
      console.log(`[联调] userId=${userId} 选用 period=${period} versionId=${version.id}`)

      // 3. 触发真实 AI 分析并落库（dispatchAnalysis 现已在落库失败时抛出）
      const result = await analyzeMood({
        userId,
        period,
        versionId: version.id,
      })
      expect(typeof result.summary).toBe('string')
      expect(result.summary.trim().length).toBeGreaterThan(0)

      // 4. 读回落库内容并断言
      const saved = await dataService.getAnalysisById(version.id, userId)
      const content = saved?.analysisContent as
        | { summary?: string; provider?: string; model?: string }
        | null
      expect(content).toBeTruthy()
      expect(content?.summary?.trim().length ?? 0).toBeGreaterThan(0)

      // eslint-disable-next-line no-console
      console.log(
        `[联调] ✅ 闭环通过 mood_analysis_versions.id=${version.id} | provider=${content?.provider} model=${content?.model}`,
      )
      // eslint-disable-next-line no-console
      console.log(`[联调] summary: ${String(content?.summary).slice(0, 200)}`)

      await pool.end()
    },
    90000,
  )
})
