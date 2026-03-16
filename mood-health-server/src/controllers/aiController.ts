/**
 * AI控制器
 * 封装AI相关接口，供前端调用
 */

import { Request, Response } from "express";
import logger from "../utils/logger";
import { BusinessError, HttpException } from "../utils/errors";
import moodAnalysisService from "../utils/ai/moodAnalysisService";
import contentAuditService from "../utils/ai/contentAuditService";
import recommendService from "../utils/ai/recommendService";
import counselingService from "../utils/ai/counselingService";
import {
  MoodAnalysisRequest,
  MoodPredictionRequest,
  ContentAuditRequest,
  ContentRecommendationRequest,
  CounselingRequest,
} from "../models/aiModel";

/**
 * AI控制器类
 */
export class AIController {
  /**
   * 分析情绪
   * @param req 请求对象
   * @param res 响应对象
   */
  async analyzeMood(req: Request, res: Response): Promise<void> {
    try {
      const request: MoodAnalysisRequest = req.body;

      // 验证请求参数
      if (!request.text) {
        throw new BusinessError("文本内容不能为空", null, req.path);
      }

      // 调用情绪分析服务
      const result = await moodAnalysisService.analyzeMood(request);

      // 返回响应
      res.status(200).json({
        code: 0,
        message: "情绪分析成功",
        data: result,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("Analyze mood error:", error);

      if (error instanceof BusinessError) {
        res.status(error.statusCode).json({
          code: error.statusCode,
          message: error.message,
          data: null,
          timestamp: new Date().toISOString(),
        });
      } else {
        res.status(500).json({
          code: 5001,
          message: "情绪分析失败",
          data: null,
          timestamp: new Date().toISOString(),
        });
      }
    }
  }

  /**
   * 预测情绪趋势
   * @param req 请求对象
   * @param res 响应对象
   */
  async predictMoodTrend(req: Request, res: Response): Promise<void> {
    try {
      const request: MoodPredictionRequest = req.body;

      // 验证请求参数
      if (!request.historicalData || request.historicalData.length === 0) {
        throw new BusinessError("历史数据不能为空", null, req.path);
      }

      if (!request.days || request.days <= 0) {
        throw new BusinessError("预测天数必须大于0", null, req.path);
      }

      // 调用情绪趋势预测服务
      const result = await moodAnalysisService.predictMoodTrend(request);

      // 返回响应
      res.status(200).json({
        code: 0,
        message: "情绪趋势预测成功",
        data: result,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("Predict mood trend error:", error);

      if (error instanceof BusinessError) {
        res.status(error.statusCode).json({
          code: error.statusCode,
          message: error.message,
          data: null,
          timestamp: new Date().toISOString(),
        });
      } else {
        res.status(500).json({
          code: 5001,
          message: "情绪趋势预测失败",
          data: null,
          timestamp: new Date().toISOString(),
        });
      }
    }
  }

  /**
   * 审核内容
   * @param req 请求对象
   * @param res 响应对象
   */
  async auditContent(req: Request, res: Response): Promise<void> {
    try {
      const request: ContentAuditRequest = req.body;

      // 验证请求参数
      if (!request.content) {
        throw new BusinessError("内容不能为空", null, req.path);
      }

      if (!request.type) {
        throw new BusinessError("内容类型不能为空", null, req.path);
      }

      // 调用内容审核服务
      const result = await contentAuditService.auditContent(request);

      // 返回响应
      res.status(200).json({
        code: 0,
        message: "内容审核成功",
        data: result,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("Audit content error:", error);

      if (error instanceof BusinessError) {
        res.status(error.statusCode).json({
          code: error.statusCode,
          message: error.message,
          data: null,
          timestamp: new Date().toISOString(),
        });
      } else {
        res.status(500).json({
          code: 5002,
          message: "内容审核失败",
          data: null,
          timestamp: new Date().toISOString(),
        });
      }
    }
  }

  /**
   * 获取推荐
   * @param req 请求对象
   * @param res 响应对象
   */
  async getRecommendations(req: Request, res: Response): Promise<void> {
    try {
      const request: ContentRecommendationRequest = req.body;

      // 验证请求参数
      if (!request.mood) {
        throw new BusinessError("情绪类型不能为空", null, req.path);
      }

      if (!request.limit || request.limit <= 0) {
        request.limit = 5; // 默认推荐5个
      }

      // 调用推荐服务
      const result = await recommendService.getRecommendations(request);

      // 返回响应
      res.status(200).json({
        code: 0,
        message: "推荐获取成功",
        data: result,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("Get recommendations error:", error);

      if (error instanceof BusinessError) {
        res.status(error.statusCode).json({
          code: error.statusCode,
          message: error.message,
          data: null,
          timestamp: new Date().toISOString(),
        });
      } else {
        res.status(500).json({
          code: 5003,
          message: "推荐获取失败",
          data: null,
          timestamp: new Date().toISOString(),
        });
      }
    }
  }

  /**
   * 保存推荐点击记录
   * @param req 请求对象
   * @param res 响应对象
   */
  async saveRecommendationClick(req: Request, res: Response): Promise<void> {
    try {
      const { itemId, itemType, userId } = req.body;

      // 验证请求参数
      if (!itemId || !itemType) {
        throw new BusinessError("推荐项ID和类型不能为空", null, req.path);
      }

      // 调用推荐服务保存点击记录
      if (userId) {
        await recommendService.saveRecommendationClick(
          userId,
          itemId,
          itemType,
        );
      }

      // 返回响应
      res.status(200).json({
        code: 0,
        message: "推荐点击记录保存成功",
        data: null,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("Save recommendation click error:", error);

      if (error instanceof BusinessError) {
        res.status(error.statusCode).json({
          code: error.statusCode,
          message: error.message,
          data: null,
          timestamp: new Date().toISOString(),
        });
      } else {
        // 不影响用户体验，返回成功
        res.status(200).json({
          code: 0,
          message: "推荐点击记录保存成功",
          data: null,
          timestamp: new Date().toISOString(),
        });
      }
    }
  }

  /**
   * 分析用户情绪
   * @param req 请求对象
   * @param res 响应对象
   */
  async analyzeUserMood(req: Request, res: Response): Promise<void> {
    try {
      const { userId, moodRecords } = req.body;

      // 验证请求参数
      if (!userId) {
        throw new BusinessError("用户ID不能为空", null, req.path);
      }

      if (!moodRecords || moodRecords.length === 0) {
        throw new BusinessError("情绪记录不能为空", null, req.path);
      }

      // 调用情绪分析服务
      const result = await moodAnalysisService.analyzeUserMood(
        userId,
        moodRecords,
      );

      // 返回响应
      res.status(200).json({
        code: 0,
        message: "用户情绪分析成功",
        data: result,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("Analyze user mood error:", error);

      if (error instanceof BusinessError) {
        res.status(error.statusCode).json({
          code: error.statusCode,
          message: error.message,
          data: null,
          timestamp: new Date().toISOString(),
        });
      } else {
        res.status(500).json({
          code: 5001,
          message: "用户情绪分析失败",
          data: null,
          timestamp: new Date().toISOString(),
        });
      }
    }
  }

  /**
   * 心理咨询对话
   * @param req 请求对象
   * @param res 响应对象
   */
  async counseling(req: Request, res: Response): Promise<void> {
    try {
      const request: CounselingRequest = req.body;

      // 验证请求参数
      if (!request.message || !request.message.trim()) {
        throw new BusinessError("消息内容不能为空", null, req.path);
      }

      if (request.message.length > 1000) {
        throw new BusinessError("消息内容不能超过1000字", null, req.path);
      }

      // 验证请求
      if (!counselingService.validateRequest(request)) {
        throw new BusinessError("请求参数无效", null, req.path);
      }

      // 调用心理咨询服务
      const result = await counselingService.generateResponse(request);

      // 返回响应
      res.status(200).json({
        code: 0,
        message: "心理咨询对话成功",
        data: result,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("Counseling error:", error);

      if (error instanceof BusinessError) {
        res.status(error.statusCode).json({
          code: error.statusCode,
          message: error.message,
          data: null,
          timestamp: new Date().toISOString(),
        });
      } else {
        res.status(500).json({
          code: 5001,
          message: "心理咨询对话失败",
          data: null,
          timestamp: new Date().toISOString(),
        });
      }
    }
  }
}

// 导出单例实例
const aiController = new AIController();
export default aiController;
