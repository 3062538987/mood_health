/**
 * 情绪分析服务
 * 提供情绪文本解析和趋势预测功能
 */

import aiClient from "./aiClient";
import logger from "../logger";
import { setCache, getCache } from "../cache";
import {
  MoodAnalysisRequest,
  MoodAnalysisResult,
  MoodPredictionRequest,
  MoodPredictionResponse,
  getAICacheKey,
} from "../../models/aiModel";
import { AiServiceError } from "../errors";
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
 * 安全兜底 - 四段式分析
 */
export const SAFE_FALLBACK_ANALYSIS: FourSectionAnalysis = {
  summary: '暂时无法生成分析，请稍后重试。',
  possibleCauses: 'AI 服务暂时不可用，无法分析可能原因。',
  todayActions: ['深呼吸，放松身心', '回顾今天的感受，写下来', '做一件让自己开心的小事'],
  whenToSeekHelp: '如果持续感到不适，建议联系专业心理咨询师。',
}

/**
 * 校验并解析四段式 JSON
 */
export const parseFourSection = (raw: string): FourSectionAnalysis => {
  // 尝试提取 JSON
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

    // 尝试从缓存获取
    if (aiConfig.enableCache && cacheKey) {
      const cached = await getCache<MoodAnalysisResult>(cacheKey);
      if (cached) {
        logger.info(`Mood analysis cache hit for user ${request.userId}`);
        return cached;
      }
    }

    try {
      // 调用AI接口
      const result = await aiClient.callByModelType<MoodAnalysisResult>(
        "/analyze-mood",
        {
          text: request.text,
          historicalData: request.historicalData,
        },
        {
          model: aiConfig.models.moodAnalysis,
        },
      );

      // 添加时间戳
      const analysisResult: MoodAnalysisResult = {
        ...result,
        timestamp: new Date().toISOString(),
      };

      // 缓存结果
      if (aiConfig.enableCache && cacheKey) {
        await setCache(cacheKey, analysisResult, aiConfig.cacheTTL);
      }

      const endTime = Date.now();
      logger.info(`Mood analysis completed in ${endTime - startTime}ms`);
      return analysisResult;
    } catch (error) {
      logger.error("Mood analysis failed:", error);

      // 本地fallback方案
      return this.getLocalMoodAnalysis(request.text);
    }
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
      ? getAICacheKey(
          "trend",
          request.userId,
          JSON.stringify(request.historicalData),
        )
      : null;

    // 尝试从缓存获取
    if (aiConfig.enableCache && cacheKey) {
      const cached = await getCache<MoodPredictionResponse>(cacheKey);
      if (cached) {
        logger.info(
          `Mood trend prediction cache hit for user ${request.userId}`,
        );
        return cached;
      }
    }

    try {
      // 调用AI接口
      const result = await aiClient.callByModelType<MoodPredictionResponse>(
        "/predict-mood-trend",
        {
          historicalData: request.historicalData,
          days: request.days,
        },
        {
          model: aiConfig.models.moodAnalysis,
        },
      );

      // 添加时间戳
      const predictionResult: MoodPredictionResponse = {
        ...result,
        timestamp: new Date().toISOString(),
      };

      // 缓存结果
      if (aiConfig.enableCache && cacheKey) {
        await setCache(cacheKey, predictionResult, aiConfig.cacheTTL);
      }

      const endTime = Date.now();
      logger.info(
        `Mood trend prediction completed in ${endTime - startTime}ms`,
      );
      return predictionResult;
    } catch (error) {
      logger.error("Mood trend prediction failed:", error);

      // 本地fallback方案
      return this.getLocalMoodTrend(request.historicalData, request.days);
    }
  }

  /**
   * 分析用户情绪
   * @param userId 用户ID
   * @param moodRecords 情绪记录
   * @returns 情绪分析结果
   */
  async analyzeUserMood(
    userId: number,
    moodRecords: Array<{
      date: string;
      intensity: number;
      moodType: string[];
    }>,
  ): Promise<MoodAnalysisResult> {
    // 构建情绪分析请求
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

    try {
      const rawResponse = await aiClient.callByModelType<string>(
        '/analyze-structured',
        {
          systemPrompt,
          userPrompt,
        },
        {
          model: aiConfig.models.moodAnalysis,
        },
      )

      const result = parseFourSection(typeof rawResponse === 'string' ? rawResponse : JSON.stringify(rawResponse))

      const endTime = Date.now()
      logger.info(`Four-section analysis completed in ${endTime - startTime}ms`)
      return result
    } catch (error) {
      logger.error('Four-section analysis failed:', error)
      return SAFE_FALLBACK_ANALYSIS
    }
  }

  /**
   * 生成情绪摘要
   * @param moodRecords 情绪记录
   * @returns 情绪摘要文本
   */
  private generateMoodSummary(
    moodRecords: Array<{
      date: string;
      intensity: number;
      moodType: string[];
    }>,
  ): string {
    if (moodRecords.length === 0) {
      return "用户没有情绪记录";
    }

    // 统计情绪分布
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

  /**
   * 本地情绪分析fallback方案
   * @param text 待分析的文本
   * @returns 情绪分析结果
   */
  private getLocalMoodAnalysis(text: string): MoodAnalysisResult {
    // 简单的关键词匹配逻辑
    const happyKeywords = ["开心", "快乐", "高兴", "兴奋", "喜悦"];
    const anxiousKeywords = ["焦虑", "紧张", "担心", "害怕", "恐惧"];
    const depressedKeywords = ["抑郁", "难过", "伤心", "悲伤", "绝望"];

    let happyScore = 0;
    let anxiousScore = 0;
    let depressedScore = 0;

    happyKeywords.forEach((keyword) => {
      if (text.includes(keyword)) happyScore += 1;
    });

    anxiousKeywords.forEach((keyword) => {
      if (text.includes(keyword)) anxiousScore += 1;
    });

    depressedKeywords.forEach((keyword) => {
      if (text.includes(keyword)) depressedScore += 1;
    });

    const totalScore = happyScore + anxiousScore + depressedScore;
    let mood = "平静";
    let confidence = 0.5;

    if (totalScore > 0) {
      if (happyScore > anxiousScore && happyScore > depressedScore) {
        mood = "开心";
        confidence = happyScore / totalScore;
      } else if (anxiousScore > happyScore && anxiousScore > depressedScore) {
        mood = "焦虑";
        confidence = anxiousScore / totalScore;
      } else if (depressedScore > happyScore && depressedScore > anxiousScore) {
        mood = "抑郁";
        confidence = depressedScore / totalScore;
      }
    }

    return {
      mood,
      confidence,
      emotions: [
        { tag: "开心", score: happyScore / (totalScore || 1) },
        { tag: "焦虑", score: anxiousScore / (totalScore || 1) },
        { tag: "抑郁", score: depressedScore / (totalScore || 1) },
        { tag: "平静", score: totalScore === 0 ? 1 : 0 },
      ],
      suggestion: this.getMoodSuggestion(mood),
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * 本地情绪趋势预测fallback方案
   * @param historicalData 历史情绪数据
   * @param days 预测天数
   * @returns 情绪趋势预测结果
   */
  private getLocalMoodTrend(
    historicalData: Array<{
      date: string;
      intensity: number;
    }>,
    days: number,
  ): MoodPredictionResponse {
    if (historicalData.length === 0) {
      return {
        labels: Array.from({ length: days }, (_, i) => {
          const date = new Date();
          date.setDate(date.getDate() + i + 1);
          return date.toISOString().split("T")[0];
        }),
        data: Array(days).fill(5),
        trend: "数据不足，无法预测",
        timestamp: new Date().toISOString(),
      };
    }

    // 简单的线性预测
    const recentData = historicalData.slice(-7);
    const averageIntensity =
      recentData.reduce((sum, item) => sum + item.intensity, 0) /
      recentData.length;

    const labels = Array.from({ length: days }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() + i + 1);
      return date.toISOString().split("T")[0];
    });

    const data = Array(days).fill(averageIntensity);
    const trend =
      averageIntensity > 6
        ? "情绪趋于积极"
        : averageIntensity < 4
          ? "情绪趋于消极"
          : "情绪趋于稳定";

    return {
      labels,
      data,
      trend,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * 根据情绪类型获取建议
   * @param mood 情绪类型
   * @returns 建议文本
   */
  private getMoodSuggestion(mood: string): string {
    const suggestions = {
      开心: "保持积极的心态，继续享受美好的时光！",
      焦虑: "尝试深呼吸和冥想，缓解焦虑情绪。",
      抑郁: "建议多与朋友交流，适当运动，必要时寻求专业帮助。",
      平静: "保持当前的良好状态，继续享受平静的生活。",
    };

    return (
      suggestions[mood as keyof typeof suggestions] ||
      "保持良好的心态，积极面对生活。"
    );
  }
}

// 导出单例实例
const moodAnalysisService = new MoodAnalysisService();
export default moodAnalysisService;
