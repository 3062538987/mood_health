import { Response } from "express";
import { AuthRequest } from "../middleware/auth";
import { createAchievementRepository } from "../repositories/achievementRepository";
import { apiFailure, apiSuccess } from "../utils/apiResponse";
import logger from "../utils/logger";

const achievementRepo = createAchievementRepository();

export const getAchievementsHandler = async (
  _req: AuthRequest,
  res: Response,
) => {
  try {
    const data = await achievementRepo.getAllDefinitions();
    res.json(apiSuccess(data, "获取成就列表成功"));
  } catch (error) {
    logger.error("获取成就列表失败", { error });
    res.status(500).json(apiFailure(500, "获取成就列表失败，请稍后重试"));
  }
};

export const getUserAchievementsHandler = async (
  req: AuthRequest,
  res: Response,
) => {
  try {
    const data = await achievementRepo.getUserAchievements(req.user!.userId);
    res.json(apiSuccess(data, "获取用户成就成功"));
  } catch (error) {
    logger.error("获取用户成就失败", { userId: req.user?.userId, error });
    res.status(500).json(apiFailure(500, "获取用户成就失败，请稍后重试"));
  }
};

export const checkAchievementsHandler = async (
  req: AuthRequest,
  res: Response,
) => {
  try {
    const data = await achievementRepo.checkAndUnlock(req.user!.userId);
    res.json(apiSuccess(data, "检查成就成功"));
  } catch (error) {
    logger.error("检查成就失败", { userId: req.user?.userId, error });
    res.status(500).json(apiFailure(500, "检查成就失败，请稍后重试"));
  }
};

export const getAchievementProgressHandler = async (
  req: AuthRequest,
  res: Response,
) => {
  try {
    const data = await achievementRepo.getAchievementProgress(req.user!.userId);
    res.json(apiSuccess(data, "获取成就进度成功"));
  } catch (error) {
    logger.error("获取成就进度失败", { userId: req.user?.userId, error });
    res.status(500).json(apiFailure(500, "获取成就进度失败，请稍后重试"));
  }
};