/**
 * 情绪分析合同测试 — Node 端。
 * 与 Python 合同测试 mood_health_ai_service/tests/contract/test_mood_analysis_contract.py 对齐。
 * 两端对同一 JSON 必须产生一致的接受/拒绝结果。
 */

import {
  Period,
  validateRequestExtraFields,
  validateResponseExtraFields,
  validateForbiddenFields,
} from '../../src/contracts/moodAnalysis';

const VALID_REQUEST = {
  contractVersion: '1.0.0',
  requestId: 'req-001',
  period: '7d' as Period,
  dataVersion: 'v1',
  locale: 'zh-CN',
  metrics: [
    {
      date: '2026-07-01',
      emotionName: '开心',
      emotionCategory: 'positive' as const,
      intensity: 7.5,
      count: 2,
    },
  ],
  trend: [
    {
      date: '2026-07-01',
      avgIntensity: 7.5,
      dominantEmotion: '开心',
      recordCount: 2,
    },
  ],
  triggers: ['学业', '社交'],
  journalExcerpt: null,
  journalConsent: false,
};

const VALID_RESPONSE = {
  summary: '最近7天情绪总体平稳。',
  patterns: [
    {
      title: '学业压力',
      observation: '在学业相关记录中情绪强度偏低。',
      evidence: '7天中有3天记录涉及学业触发因素。',
      caveat: '样本量较小，仅供参考。',
    },
  ],
  possibleFactors: ['学业压力', '社交关系'],
  actions: [
    {
      title: '短暂休息',
      steps: ['放下当前任务', '做5分钟深呼吸'],
      estimatedMinutes: 5,
    },
  ],
  whenToSeekHelp: '如果低落情绪持续超过两周，建议联系辅导员。',
  warnings: ['样本量较小 (7天)，分析结论仅供参考。'],
  provider: 'deepseek',
  model: 'deepseek-chat',
  promptVersion: '1.0.0',
};

describe('MoodAnalysis Contract — 请求', () => {
  it('合法请求通过额外字段检查', () => {
    const extra = validateRequestExtraFields(VALID_REQUEST);
    expect(extra).toEqual([]);
  });

  it('拒绝额外字段', () => {
    const extra = validateRequestExtraFields({ ...VALID_REQUEST, userId: 1 });
    expect(extra).toEqual(['userId']);
  });

  it('拒绝 mood_score', () => {
    const forbidden = validateForbiddenFields({ ...VALID_REQUEST, mood_score: 5 });
    expect(forbidden).toEqual(['mood_score']);
  });

  it('拒绝 confidence', () => {
    const forbidden = validateForbiddenFields({ ...VALID_REQUEST, confidence: 0.9 });
    expect(forbidden).toEqual(['confidence']);
  });

  it('拒绝 diagnosis', () => {
    const forbidden = validateForbiddenFields({ ...VALID_REQUEST, diagnosis: 'depression' });
    expect(forbidden).toEqual(['diagnosis']);
  });

  it('合法响应通过额外字段检查', () => {
    const extra = validateResponseExtraFields(VALID_RESPONSE);
    expect(extra).toEqual([]);
  });

  it('拒绝响应额外字段', () => {
    const extra = validateResponseExtraFields({ ...VALID_RESPONSE, extraField: 'nope' });
    expect(extra).toEqual(['extraField']);
  });

  it('拒绝响应 mood_score', () => {
    const forbidden = validateForbiddenFields({ ...VALID_RESPONSE, mood_score: 5 });
    expect(forbidden).toEqual(['mood_score']);
  });

  it('拒绝响应 confidence', () => {
    const forbidden = validateForbiddenFields({ ...VALID_RESPONSE, confidence: 0.85 });
    expect(forbidden).toEqual(['confidence']);
  });

  it('拒绝响应 diagnosis', () => {
    const forbidden = validateForbiddenFields({ ...VALID_RESPONSE, diagnosis: 'anxiety' });
    expect(forbidden).toEqual(['diagnosis']);
  });
});

describe('MoodAnalysis Contract — 跨端一致性', () => {
  it('两端对额外字段的处理一致 — 均拒绝', () => {
    const reqExtra = validateRequestExtraFields({ ...VALID_REQUEST, banned: 42 });
    expect(reqExtra).toEqual(['banned']);
    const respExtra = validateResponseExtraFields({ ...VALID_RESPONSE, banned: 42 });
    expect(respExtra).toEqual(['banned']);
  });

  it('请求不能包含 userId', () => {
    const extra = validateRequestExtraFields({ ...VALID_REQUEST, userId: 123 });
    expect(extra).toEqual(['userId']);
  });

  it('请求不能包含 token/cookie/email', () => {
    for (const field of ['token', 'cookie', 'email']) {
      const extra = validateRequestExtraFields({ ...VALID_REQUEST, [field]: 'secret' });
      expect(extra).toEqual([field]);
    }
  });
});