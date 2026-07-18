/**
 * 情绪分析服务
 * 通过 callChatCompletion 直接调用 DeepSeek API 进行情绪分析
 */

import { callChatCompletion } from "./aiClient";
import logger from "../logger";
import { setCache, getCache } from "../cache";
import {
  MoodAnalysisRequest,
  MoodAnalysisResult,
  MoodPredictionRequest,
  MoodPredictionResponse,
  getAICacheKey,
} from "../../models/aiModel";
import aiConfig from "../../config/aiConfig";

/**
 * 四段式分析结果
 */
export interface FourSectionAnalysis {
  summary: string
  possibleCauses: string
  todayActions: string[]
  whenToSeekHelp: string
}

/**
 * 安全兜底 - 四段式分析（仅在 AI 响应解析失败时使用）
 * 标记为 fallback 来源，不伪装成模型分析
 */
export const SAFE_FALLBACK_ANALYSIS: FourSectionAnalysis & { source: string; isFallback: boolean; reasonCode: string } = {
  summary: '暂时无法生成分析，请稍后重试。',
  possibleCauses: 'AI 服务暂时不可用，无法分析可能原因。',
  todayActions: ['深呼吸，放松身心', '回顾今天的感受，写下来', '做一件让自己开心的小事'],
  whenToSeekHelp: '如果持续感到不适，建议联系专业心理咨询师。',
  source: 'fallback',
  isFallback: true,
  reasonCode: 'AI_UNAVAILABLE',
}

/**
 * 校验并解析四段式 JSON
 */
export const parseFourSection = (raw: string): FourSectionAnalysis => {
  let jsonStr = raw.trim()
  const jsonMatch = jsonStr.match(/\{[\s\S]*\}/)
  if (jsonMatch) {
    jsonStr = jsonMatch[0]
  }

  try {
    const parsed = JSON.parse(jsonStr)
    return {
      summary: typeof parsed.summary === 'string' && parsed.summary.trim() ? parsed.summary.trim() : SAFE_FALLBACK_ANALYSIS.summary,
      possibleCauses: typeof parsed.possibleCauses === 'string' && parsed.possibleCauses.trim() ? parsed.possibleCauses.trim() : SAFE_FALLBACK_ANALYSIS.possibleCauses,
      todayActions: Array.isArray(parsed.todayActions) && parsed.todayActions.length > 0
        ? parsed.todayActions.filter((a: unknown) => typeof a === 'string' && a.trim())
        : SAFE_FALLBACK_ANALYSIS.todayActions,
      whenToSeekHelp: typeof parsed.whenToSeekHelp === 'string' && parsed.whenToSeekHelp.trim() ? parsed.whenToSeekHelp.trim() : SAFE_FALLBACK_ANALYSIS.whenToSeekHelp,
    }
  } catch {
    return SAFE_FALLBACK_ANALYSIS
  }
}

/**
 * 情绪分析服务类
 */
export class MoodAnalysisService {
  private readonly MOOD_ANALYSIS_SYSTEM_PROMPT = `你是一位专业的心理健康助手，请根据用户提供的情绪描述和历史数据进行分析。

请严格按以下 JSON 格式返回（不要包含 markdown 代码块标记）：
{
  "analysis": "当前情绪状态分析（2-3句话）",
  "suggestions": ["建议1", "建议2", "建议3"],
  "mood": "识别出的情绪类型（如：开心、焦虑、平静、低落等）",
  "mood_score": 5,
  "risk_level": "low"
}

重要规则：
1. 不要给出诊断结论，你只是心理健康助手
2. mood_score 为 1-10 的整数，1 表示极度消极，10 表示极度积极
3. risk_level 为 low/medium/high，根据内容风险判断
4. 如果用户提到自伤、自杀等高风险内容，risk_level 设为 high
5. 保持温和、共情的语气`

  /**
   * 分析情绪文本
   * @param request 情绪分析请求
   * @returns 情绪分析结果
   */
  async analyzeMood(request: MoodAnalysisRequest): Promise<MoodAnalysisResult> {
    const startTime = Date.now();
    const cacheKey = request.userId
      ? getAICacheKey("mood", request.userId, request.text)
      : null;

    if (aiConfig.enableCache && cacheKey) {
      const cached = await getCache<MoodAnalysisResult>(cacheKey);
      if (cached) {
        logger.info(`Mood analysis cache hit for user ${request.userId}`);
        return cached;
      }
    }

    // 构建历史数据文本
    let historyText = '';
    if (request.historicalData && request.historicalData.length > 0) {
      const recent = request.historicalData.slice(-5);
      historyText = '\n近期情绪记录：' + recent.map((r: any) => {
        const date = r.date || r.recorded_at || '';
        const intensity = r.intensity || r.score || '';
        const mood = Array.isArray(r.moodType) ? r.moodType.join('、') : (r.mood || '');
        return `${date} 强度${intensity}/10 ${mood}`;
      }).join('；');
    }

    const messages: Array<{ role: 'system' | 'user'; content: string }> = [
      { role: 'system', content: this.MOOD_ANALYSIS_SYSTEM_PROMPT },
      { role: 'user', content: `用户情绪描述：${request.text}${historyText}` },
    ];

    const rawResponse = await callChatCompletion(messages, {
      temperature: 0.7,
      maxTokens: 800,
    });

    // 解析 JSON 响应
    let parsed: any
    let source = 'model' as 'model' | 'rule' | 'fallback'
    let isFallback = false
    let reasonCode: string | null = null

    try {
      const jsonStr = (rawResponse.match(/\{[\s\S]*\}/) || ['{}'])[0]
      parsed = JSON.parse(jsonStr)

      // A3-04: 禁止默认值伪装完整结果
      if (typeof parsed.risk_level !== 'string' || !['low', 'medium', 'high'].includes(parsed.risk_level)) {
        source = 'rule'
        isFallback = true
        reasonCode = 'INVALID_RISK_LEVEL'
        parsed.risk_level = 'medium' // 解析失败时保守处理
      }
      if (typeof parsed.mood_score !== 'number' || parsed.mood_score < 1 || parsed.mood_score > 10) {
        source = 'rule'
        isFallback = true
        reasonCode = reasonCode || 'INVALID_MOOD_SCORE'
      }
      if (!parsed.analysis || typeof parsed.analysis !== 'string' || !parsed.analysis.trim()) {
        source = 'rule'
        isFallback = true
        reasonCode = reasonCode || 'MISSING_ANALYSIS'
        parsed.analysis = '分析结果不完整，请稍后重试。'
      }
    } catch {
      parsed = {
        analysis: rawResponse.slice(0, 200),
        suggestions: ['保持积极心态', '适当放松身心'],
        mood: '未知',
        mood_score: undefined,
        risk_level: undefined,
      }
      source = 'fallback'
      isFallback = true
      reasonCode = 'JSON_PARSE_FAILED'
    }

    const analysisResult: MoodAnalysisResult = {
      mood: parsed.mood || '',
      confidence: 0.85,
      emotions: [
        { tag: parsed.mood || '', score: 1 },
      ],
      suggestion: (parsed.suggestions || ['保持积极心态']).join('；'),
      analysis: parsed.analysis || '',
      suggestions: parsed.suggestions || [],
      mood_score: parsed.mood_score,
      risk_level: parsed.risk_level,
      timestamp: new Date().toISOString(),
      source,
      isFallback,
      reasonCode,
    };

    if (aiConfig.enableCache && cacheKey) {
      await setCache(cacheKey, analysisResult, aiConfig.cacheTTL);
    }

    const endTime = Date.now();
    logger.info(`Mood analysis completed in ${endTime - startTime}ms`);
    return analysisResult;
  }

  /**
   * 预测情绪趋势
   * @param request 情绪趋势预测请求
   * @returns 情绪趋势预测结果
   */
  async predictMoodTrend(
    request: MoodPredictionRequest,
  ): Promise<MoodPredictionResponse> {
    const startTime = Date.now();
    const cacheKey = request.userId
      ? getAICacheKey("trend", request.userId, JSON.stringify(request.historicalData))
      : null;

    if (aiConfig.enableCache && cacheKey) {
      const cached = await getCache<MoodPredictionResponse>(cacheKey);
      if (cached) {
        logger.info(`Mood trend prediction cache hit for user ${request.userId}`);
        return cached;
      }
    }

    const historySummary = request.historicalData
      .map((r: any) => `${r.date || ''}: 强度${r.intensity || r.score || ''}/10`)
      .join('；');

    const messages: Array<{ role: 'system' | 'user'; content: string }> = [
      {
        role: 'system',
        content: `你是一位专业的心理健康助手。请根据用户的历史情绪数据预测未来 ${request.days} 天的情绪趋势。

请严格按以下 JSON 格式返回（不要包含 markdown 代码块标记）：
{
  "labels": ["日期1", "日期2", ...],
  "data": [5, 6, 4, ...],
  "trend": "趋势描述（一句话）"
}

data 为 1-10 的整数数组，代表预测的情绪强度。`,
      },
      {
        role: 'user',
        content: `历史情绪数据：${historySummary}\n请预测未来 ${request.days} 天的情绪趋势。`,
      },
    ];

    const rawResponse = await callChatCompletion(messages, {
      temperature: 0.5,
      maxTokens: 500,
    });

    let parsed: any;
    try {
      const jsonStr = (rawResponse.match(/\{[\s\S]*\}/) || ['{}'])[0];
      parsed = JSON.parse(jsonStr);
    } catch {
      parsed = {
        labels: [],
        data: [],
        trend: '数据不足，无法预测',
      };
    }

    const predictionResult: MoodPredictionResponse = {
      labels: parsed.labels || [],
      data: parsed.data || [],
      trend: parsed.trend || '数据不足，无法预测',
      timestamp: new Date().toISOString(),
    };

    if (aiConfig.enableCache && cacheKey) {
      await setCache(cacheKey, predictionResult, aiConfig.cacheTTL);
    }

    const endTime = Date.now();
    logger.info(`Mood trend prediction completed in ${endTime - startTime}ms`);
    return predictionResult;
  }

  /**
   * 分析用户情绪
   * @param userId 用户ID
   * @param moodRecords 情绪记录
   * @returns 情绪分析结果
   */
  async analyzeUserMood(
    userId: number,
    moodRecords: Array<{ date: string; intensity: number; moodType: string[] }>,
  ): Promise<MoodAnalysisResult> {
    const request: MoodAnalysisRequest = {
      userId,
      text: this.generateMoodSummary(moodRecords),
      historicalData: moodRecords,
    };
    return this.analyzeMood(request);
  }

  /**
   * 四段式结构化分析
   * @param contextText 上下文文本（含用户情绪记录和测评结果）
   * @param userMessage 用户当前输入
   * @returns 四段式分析结果
   */
  async analyzeWithFourSection(
    contextText: string,
    userMessage: string,
  ): Promise<FourSectionAnalysis> {
    const startTime = Date.now()

    const systemPrompt = `你是一位专业的心理健康助手。请根据用户提供的情绪记录和描述，给出四段式结构化分析。

请严格按以下 JSON 格式返回（不要包含 markdown 代码块标记）：
{
  "summary": "现状概括（2-3句话，描述用户当前的情绪状态）",
  "possibleCauses": "可能原因（2-3句话，分析可能导致当前情绪的原因）",
  "todayActions": ["今日可以尝试的行动1", "行动2", "行动3"],
  "whenToSeekHelp": "何时需要寻求专业帮助的提示"
}

重要规则：
1. 不要给出诊断结论，你只是心理健康助手而非医生
2. 如果用户提到自伤、自杀等高风险内容，在 whenToSeekHelp 中明确建议立即联系专业机构
3. todayActions 必须是具体可执行的行动建议，不要空泛
4. 保持温和、共情的语气`

    const userPrompt = `${contextText}\n\n用户当前描述：${userMessage || '无'}`

    const messages: Array<{ role: 'system' | 'user'; content: string }> = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ]

    const rawResponse = await callChatCompletion(messages, {
      temperature: 0.7,
      maxTokens: 800,
    })

    const result = parseFourSection(rawResponse)

    const endTime = Date.now()
    logger.info(`Four-section analysis completed in ${endTime - startTime}ms`)
    return result
  }

  /**
   * 生成情绪摘要
   */
  private generateMoodSummary(
    moodRecords: Array<{ date: string; intensity: number; moodType: string[] }>,
  ): string {
    if (moodRecords.length === 0) {
      return "用户没有情绪记录";
    }
    const moodCount: Record<string, number> = {};
    let totalIntensity = 0;
    moodRecords.forEach((record) => {
      record.moodType.forEach((mood) => {
        moodCount[mood] = (moodCount[mood] || 0) + 1;
      });
      totalIntensity += record.intensity;
    });
    const averageIntensity = totalIntensity / moodRecords.length;
    const mostFrequentMood =
      Object.entries(moodCount).sort(([, a], [, b]) => b - a)[0]?.[0] || "平静";
    return `用户最近的情绪记录：平均强度${averageIntensity.toFixed(1)}，最常见情绪${mostFrequentMood}，共${moodRecords.length}条记录`;
  }
}

// 导出单例实例
const moodAnalysisService = new MoodAnalysisService();
export default moodAnalysisService;