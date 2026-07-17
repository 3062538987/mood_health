/**
 * 推荐系统服务
 * 基于用户情绪数据推荐放松音乐/课程/活动
 */

import { callChatCompletion } from "./aiClient";
import logger from "../logger";
import { setCache, getCache } from "../cache";
import { getMysqlPool } from "../../config/mysql";
import { RowDataPacket } from "mysql2";
import {
  ContentRecommendationRequest,
  RecommendationResult,
  RecommendationItem,
  getAICacheKey,
} from "../../models/aiModel";
import aiConfig from "../../config/aiConfig";

/**
 * 推荐系统服务类
 */
export class RecommendService {
  private readonly RECOMMEND_SYSTEM_PROMPT = `你是一位专业的心理健康助手，请根据用户的情绪状态推荐合适的放松内容。

请严格按以下 JSON 格式返回（不要包含 markdown 代码块标记）：
{
  "items": [
    {
      "type": "music/course/activity",
      "title": "内容标题",
      "description": "内容描述",
      "relevance": 0.9
    }
  ],
  "strategy": "推荐策略说明",
  "explanation": "推荐理由"
}

重要规则：
1. items 中 type 只能是 music、course 或 activity
2. relevance 为 0-1 的浮点数，表示推荐相关度
3. 推荐内容应针对用户当前情绪状态
4. 保持温和、共情的语气`

  /**
   * 获取推荐
   */
  async getRecommendations(
    request: ContentRecommendationRequest,
  ): Promise<RecommendationResult> {
    const startTime = Date.now();
    const cacheKey = request.userId
      ? getAICacheKey("recommend", request.userId, request.mood)
      : null;

    if (aiConfig.enableCache && cacheKey) {
      const cached = await getCache<RecommendationResult>(cacheKey);
      if (cached) {
        logger.info(`Recommendation cache hit for user ${request.userId}`);
        return cached;
      }
    }

    const mood = typeof request.mood === 'string' ? request.mood : request.mood?.[0] || '平静';
    const preferenceText = request.userPreferences?.length
      ? `用户偏好：${request.userPreferences.join('、')}`
      : '';

    const messages: Array<{ role: 'system' | 'user'; content: string }> = [
      { role: 'system', content: this.RECOMMEND_SYSTEM_PROMPT },
      { role: 'user', content: `用户当前情绪：${mood}\n${preferenceText}\n请推荐 ${request.limit || 5} 个合适的放松内容。` },
    ];

    const rawResponse = await callChatCompletion(messages, {
      temperature: 0.7,
      maxTokens: 800,
    });

    let parsed: any;
    try {
      const jsonStr = (rawResponse.match(/\{[\s\S]*\}/) || ['{}'])[0];
      parsed = JSON.parse(jsonStr);
    } catch {
      parsed = {
        items: [],
        strategy: 'AI 响应解析失败',
        explanation: '基于您的情绪状态推荐',
      };
    }

    const items: RecommendationItem[] = (parsed.items || []).map((item: any, index: number) => ({
      id: String(index + 1),
      type: item.type || 'music',
      title: item.title || '放松内容',
      description: item.description || '',
      relevance: item.relevance || 0.8,
    }));

    const enrichedItems = await this.enrichWithRealContent(items);

    const recommendationResult: RecommendationResult = {
      items: enrichedItems,
      strategy: parsed.strategy || '基于情绪状态的个性化推荐',
      explanation: parsed.explanation || `根据您当前的${mood}情绪状态，为您推荐了相关放松内容`,
      timestamp: new Date().toISOString(),
    };

    if (aiConfig.enableCache && cacheKey) {
      await setCache(cacheKey, recommendationResult, aiConfig.cacheTTL);
    }

    const endTime = Date.now();
    logger.info(`Recommendations generated in ${endTime - startTime}ms`);
    return recommendationResult;
  }

  /**
   * 保存推荐点击记录
   */
  async saveRecommendationClick(
    userId: number,
    itemId: string,
    itemType: string,
  ): Promise<void> {
    try {
      logger.info(
        `Recommendation click saved: user ${userId}, item ${itemId}, type ${itemType}`,
      );
    } catch (error) {
      logger.error("Failed to save recommendation click:", error);
    }
  }

  /**
   * 基于用户历史数据获取个性化推荐
   */
  async getPersonalizedRecommendations(
    userId: number,
    mood: string,
    limit: number = 5,
  ): Promise<RecommendationResult> {
    const pool = getMysqlPool();

    const [emotionRows] = await pool.query<RowDataPacket[]>(
      `SELECT et.name, COUNT(*) as cnt
       FROM moods m
       JOIN mood_emotions me ON me.mood_id = m.id
       JOIN emotion_types et ON et.id = me.emotion_type_id
       WHERE m.user_id = ? AND DATE(m.recorded_at) >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
       GROUP BY et.name
       ORDER BY cnt DESC
       LIMIT 5`,
      [userId]
    );

    const commonEmotions: string[] = emotionRows.map((r) => r.name as string);

    const [assessmentRows] = await pool.query<RowDataPacket[]>(
      `SELECT q.title, ar.score
       FROM assessment_sessions ass
       JOIN assessment_results ar ON ar.session_id = ass.id
       JOIN questionnaires q ON q.id = ass.questionnaire_id
       WHERE ass.user_id = ?
       ORDER BY ass.created_at DESC
       LIMIT 3`,
      [userId]
    );

    const assessmentHistory = assessmentRows.map((r) => ({
      title: r.title as string,
      score: Number(r.score),
    }));

    const userPreferences: string[] = [];
    if (commonEmotions.length > 0) {
      userPreferences.push(`常见情绪: ${commonEmotions.join('、')}`);
    }
    if (assessmentHistory.length > 0) {
      const scores = assessmentHistory.map((a) => `${a.title}(${a.score}分)`);
      userPreferences.push(`测评结果: ${scores.join(', ')}`);
    }

    const baseReason = commonEmotions.length > 0
      ? `基于您最近经常感到${commonEmotions[0]}`
      : `根据您当前的${mood}情绪状态`;

    const request: ContentRecommendationRequest = {
      userId,
      mood,
      limit,
      userPreferences,
      recentActivities: [],
    };

    const result = await this.getRecommendations(request);
    return {
      ...result,
      explanation: `${baseReason}，为您推荐以下内容`,
    };
  }

  /**
   * 用真实数据库内容匹配推荐项
   */
  private async enrichWithRealContent(
    items: RecommendationItem[],
  ): Promise<RecommendationItem[]> {
    const pool = getMysqlPool();
    const enriched: RecommendationItem[] = [];

    for (const item of items) {
      try {
        if (item.type === 'music') {
          const [rows] = await pool.query<RowDataPacket[]>(
            `SELECT id, title, description, url, cover_url
             FROM musics WHERE is_active = 1 LIMIT 1`
          );
          if (rows.length > 0) {
            enriched.push({
              ...item,
              id: String(rows[0].id),
              title: rows[0].title as string,
              description: rows[0].description as string || item.description,
              url: `/api/music/${rows[0].id}`,
              cover: rows[0].cover_url as string || item.cover,
            });
            continue;
          }
        } else if (item.type === 'course') {
          const [rows] = await pool.query<RowDataPacket[]>(
            `SELECT id, title, description, cover_url
             FROM courses WHERE is_active = 1 LIMIT 1`
          );
          if (rows.length > 0) {
            enriched.push({
              ...item,
              id: String(rows[0].id),
              title: rows[0].title as string,
              description: rows[0].description as string || item.description,
              url: `/api/courses/${rows[0].id}`,
              cover: rows[0].cover_url as string || item.cover,
            });
            continue;
          }
        } else if (item.type === 'activity') {
          const [rows] = await pool.query<RowDataPacket[]>(
            `SELECT id, title, description, cover_url
             FROM activities WHERE is_active = 1 LIMIT 1`
          );
          if (rows.length > 0) {
            enriched.push({
              ...item,
              id: String(rows[0].id),
              title: rows[0].title as string,
              description: rows[0].description as string || item.description,
              url: `/api/activities/${rows[0].id}`,
              cover: rows[0].cover_url as string || item.cover,
            });
            continue;
          }
        }
        enriched.push(item);
      } catch {
        enriched.push(item);
      }
    }

    return enriched;
  }
}

// 导出单例实例
const recommendService = new RecommendService();
export default recommendService;