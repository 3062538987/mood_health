/**
 * 推荐系统服务
 * 基于用户情绪数据推荐放松音乐/课程/活动
 */

import aiClient from "./aiClient";
import logger from "../logger";
import { setCache, getCache } from "../cache";
import {
  ContentRecommendationRequest,
  RecommendationResult,
  RecommendationItem,
  getAICacheKey,
} from "../../models/aiModel";
import { AiServiceError } from "../errors";
import aiConfig from "../../config/aiConfig";

/**
 * 推荐系统服务类
 */
export class RecommendService {
  /**
   * 获取推荐
   * @param request 推荐请求
   * @returns 推荐结果
   */
  async getRecommendations(
    request: ContentRecommendationRequest,
  ): Promise<RecommendationResult> {
    const startTime = Date.now();
    const cacheKey = request.userId
      ? getAICacheKey("recommend", request.userId, request.mood)
      : null;

    // 尝试从缓存获取
    if (aiConfig.enableCache && cacheKey) {
      const cached = await getCache<RecommendationResult>(cacheKey);
      if (cached) {
        logger.info(`Recommendation cache hit for user ${request.userId}`);
        return cached;
      }
    }

    try {
      // 调用AI接口
      const result = await aiClient.callByModelType<RecommendationResult>(
        "/recommend",
        {
          mood: request.mood,
          limit: request.limit,
          userPreferences: request.userPreferences,
          recentActivities: request.recentActivities,
        },
        {
          model: aiConfig.models.recommendation,
        },
      );

      // 添加时间戳
      const recommendationResult: RecommendationResult = {
        ...result,
        timestamp: new Date().toISOString(),
      };

      // 缓存结果
      if (aiConfig.enableCache && cacheKey) {
        await setCache(cacheKey, recommendationResult, aiConfig.cacheTTL);
      }

      const endTime = Date.now();
      logger.info(`Recommendations generated in ${endTime - startTime}ms`);
      return recommendationResult;
    } catch (error) {
      logger.error("Recommendation failed:", error);

      // 本地fallback方案
      const mood =
        typeof request.mood === "string"
          ? request.mood
          : request.mood?.[0] || "平静";
      return this.getLocalRecommendations(mood, request.limit || 5);
    }
  }

  /**
   * 本地推荐fallback方案
   * @param mood 情绪类型
   * @param limit 推荐数量
   * @returns 推荐结果
   */
  private getLocalRecommendations(
    mood: string,
    limit: number,
  ): RecommendationResult {
    // 基于情绪类型的本地推荐逻辑
    const recommendationsMap: Record<string, RecommendationItem[]> = {
      开心: [
        {
          id: "1",
          type: "music",
          title: "快乐时光",
          description: "轻快的音乐，适合保持愉悦的心情",
          url: "/api/music/1",
          cover:
            "https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=happy%20music%20album%20cover%20with%20bright%20colors&image_size=square",
          relevance: 0.9,
        },
        {
          id: "2",
          type: "activity",
          title: "户外散步",
          description: "在阳光下散步，享受美好时光",
          url: "/api/activities/2",
          cover:
            "https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=outdoor%20walking%20in%20sunshine&image_size=square",
          relevance: 0.85,
        },
        {
          id: "3",
          type: "course",
          title: "积极心理学",
          description: "学习如何保持积极的心态",
          url: "/api/courses/3",
          cover:
            "https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=positive%20psychology%20course%20cover&image_size=square",
          relevance: 0.8,
        },
      ],
      焦虑: [
        {
          id: "4",
          type: "music",
          title: "静心冥想",
          description: "舒缓的音乐，帮助缓解焦虑",
          url: "/api/music/4",
          cover:
            "https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=calm%20meditation%20music%20album%20cover&image_size=square",
          relevance: 0.9,
        },
        {
          id: "5",
          type: "activity",
          title: "深呼吸练习",
          description: "通过深呼吸缓解焦虑情绪",
          url: "/api/activities/5",
          cover:
            "https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=deep%20breathing%20exercise&image_size=square",
          relevance: 0.85,
        },
        {
          id: "6",
          type: "course",
          title: "压力管理",
          description: "学习有效的压力管理技巧",
          url: "/api/courses/6",
          cover:
            "https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=stress%20management%20course%20cover&image_size=square",
          relevance: 0.8,
        },
      ],
      抑郁: [
        {
          id: "7",
          type: "music",
          title: "希望之光",
          description: "温暖的音乐，给予希望和力量",
          url: "/api/music/7",
          cover:
            "https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=hopeful%20music%20album%20cover%20with%20warm%20light&image_size=square",
          relevance: 0.9,
        },
        {
          id: "8",
          type: "activity",
          title: "社交互动",
          description: "与朋友交流，缓解孤独感",
          url: "/api/activities/8",
          cover:
            "https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=social%20interaction%20with%20friends&image_size=square",
          relevance: 0.85,
        },
        {
          id: "9",
          type: "course",
          title: "情绪管理",
          description: "学习如何管理和改善情绪",
          url: "/api/courses/9",
          cover:
            "https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=emotion%20management%20course%20cover&image_size=square",
          relevance: 0.8,
        },
      ],
      平静: [
        {
          id: "10",
          type: "music",
          title: "宁静致远",
          description: "平和的音乐，保持内心的平静",
          url: "/api/music/10",
          cover:
            "https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=peaceful%20music%20album%20cover%20with%20calm%20landscape&image_size=square",
          relevance: 0.9,
        },
        {
          id: "11",
          type: "activity",
          title: "瑜伽练习",
          description: "通过瑜伽保持身心平衡",
          url: "/api/activities/11",
          cover:
            "https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=yoga%20practice%20in%20peaceful%20setting&image_size=square",
          relevance: 0.85,
        },
        {
          id: "12",
          type: "course",
          title: "Mindfulness",
          description: "学习正念技巧，保持当下",
          url: "/api/courses/12",
          cover:
            "https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=mindfulness%20meditation%20course%20cover&image_size=square",
          relevance: 0.8,
        },
      ],
    };

    const recommendations =
      recommendationsMap[mood] || recommendationsMap["平静"];
    const limitedRecommendations = recommendations.slice(0, limit);

    return {
      items: limitedRecommendations,
      strategy: "基于情绪类型的推荐",
      explanation: `根据您当前的${mood}情绪状态，为您推荐了相关的放松内容`,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * 保存推荐点击记录
   * @param userId 用户ID
   * @param itemId 推荐项ID
   * @param itemType 推荐项类型
   */
  async saveRecommendationClick(
    userId: number,
    itemId: string,
    itemType: string,
  ): Promise<void> {
    try {
      // 这里可以实现推荐点击记录的保存逻辑
      // 例如保存到数据库或日志
      logger.info(
        `Recommendation click saved: user ${userId}, item ${itemId}, type ${itemType}`,
      );
    } catch (error) {
      logger.error("Failed to save recommendation click:", error);
      // 不影响用户体验，静默处理错误
    }
  }

  /**
   * 基于用户历史数据获取推荐
   * @param userId 用户ID
   * @param mood 情绪类型
   * @param limit 推荐数量
   * @param userPreferences 用户偏好
   * @param recentActivities 最近活动
   * @returns 推荐结果
   */
  async getPersonalizedRecommendations(
    userId: number,
    mood: string,
    limit: number = 5,
    userPreferences: string[] = [],
    recentActivities: Array<{
      type: string;
      duration: number;
      timestamp: string;
    }> = [],
  ): Promise<RecommendationResult> {
    const request: ContentRecommendationRequest = {
      userId,
      mood,
      limit,
      userPreferences,
      recentActivities,
    };

    return this.getRecommendations(request);
  }
}

// 导出单例实例
const recommendService = new RecommendService();
export default recommendService;
