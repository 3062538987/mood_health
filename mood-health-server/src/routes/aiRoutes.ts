/**
 * AI路由
 * 定义标准化AI接口协议（RESTful），接口路径统一前缀/api/ai
 */

import express from "express";
import aiController from "../controllers/aiController";
import { authenticate } from "../middleware/auth";

const router = express.Router();

/**
 * AI接口路由
 * 所有接口路径统一前缀：/api/ai
 */

// 情绪分析相关接口
router.post("/analyze-mood", aiController.analyzeMood);
router.post("/predict-mood-trend", aiController.predictMoodTrend);
router.post("/analyze-user-mood", authenticate, aiController.analyzeUserMood); // 需要登录

// 心理咨询相关接口
router.post("/counseling", aiController.counseling);
router.post("/counseling-with-context", aiController.counseling);

export default router;
