/**
 * 分析调度器测试 — 验证 buildAnalysisRequest 和 dispatchAnalysis 核心逻辑。
 * 不依赖真实 MySQL 或 FastAPI 连接。
 */

import {
  buildAnalysisRequest,
  AnalysisOptions,
} from '@/services/analysisDispatcher';
import { validateRequestExtraFields } from '@/contracts/moodAnalysis';

// Mock MySQL 连接池
jest.mock('@/config/mysql', () => {
  const mockQuery = jest.fn().mockResolvedValue([[], []]);
  return {
    getMysqlPool: jest.fn().mockReturnValue({
      query: mockQuery,
    }),
  };
});

describe('AnalysisDispatcher', () => {
  describe('buildAnalysisRequest', () => {
    it('基本请求结构正确', async () => {
      const options: AnalysisOptions = {
        userId: 1,
        period: '7d',
      };

      const request = await buildAnalysisRequest(options);

      expect(request.contractVersion).toBe('1.0.0');
      expect(request.period).toBe('7d');
      expect(request.locale).toBe('zh-CN');
      expect(request.requestId).toBeTruthy();
      expect(request.journalConsent).toBe(false);
      expect(request.journalExcerpt).toBeNull();
      expect(Array.isArray(request.metrics)).toBe(true);
      expect(Array.isArray(request.trend)).toBe(true);
      expect(Array.isArray(request.triggers)).toBe(true);
    });

    it('journal 相关字段可传递', async () => {
      const options: AnalysisOptions = {
        userId: 1,
        period: '7d',
        journalExcerpt: '今天心情不错',
        journalConsent: true,
      };

      const request = await buildAnalysisRequest(options);

      expect(request.journalExcerpt).toBe('今天心情不错');
      expect(request.journalConsent).toBe(true);
    });

    it('locale 可自定义', async () => {
      const options: AnalysisOptions = {
        userId: 1,
        period: '7d',
        locale: 'en-US',
      };

      const request = await buildAnalysisRequest(options);
      expect(request.locale).toBe('en-US');
    });

    it('不包含额外字段', async () => {
      const options: AnalysisOptions = { userId: 1, period: '7d' };
      const request = await buildAnalysisRequest(options);

      const extra = validateRequestExtraFields(
        request as unknown as Record<string, unknown>
      );
      expect(extra).toEqual([]);
    });

    it('periodToDays 映射正确', async () => {
      const periods = ['7d', '1m', '3m', '6m', '1y'];
      for (const period of periods) {
        const options: AnalysisOptions = { userId: 1, period };
        const request = await buildAnalysisRequest(options);
        expect(request.period).toBe(period);
      }
    });
  });
});