import { Response } from "express";
import { AuthRequest } from "../middleware/auth";
import { createAchievementRepository } from "../repositories/achievementRepository";
import logger from "../utils/logger";

const achievementRepo = createAchievementRepository();

export const getAchievementsHandler = async (
  _req: AuthRequest,
  res: Response,
) => {
  try {
    const data = await achievementRepo.getAllDefinitions();
    res.json({ code: 0, data });
  } catch (error) {
    logger.error("获取成就列表失败", { error });
    res
      .status(500)
      .json({ code: 500, message: "获取成就列表失败，请稍后重试" });
  }
};

export const getUserAchievementsHandler = async (
  req: AuthRequest,
  res: Response,
) => {
  try {
    const data = await achievementRepo.getUserAchievements(req.user!.userId);
    res.json({ code: 0, data });
  } catch (error) {
    logger.error("获取用户成就失败", { userId: req.user?.userId, error });
    res
      .status(500)
      .json({ code: 500, message: "获取用户成就失败，请稍后重试" });
  }
};

export const checkAchievementsHandler = async (
  req: AuthRequest,
  res: Response,
) => {
  try {
    const data = await achievementRepo.checkAndUnlock(req.user!.userId);
    res.json({ code: 0, data });
  } catch (error) {
    logger.error("检查成就失败", { userId: req.user?.userId, error });
    res.status(500).json({ code: 500, message: "检查成就失败，请稍后重试" });
  }
};

export const getAchievementProgressHandler = async (
  req: AuthRequest,
  res: Response,
) => {
  try {
    const data = await achievementRepo.getAchievementProgress(req.user!.userId);
    res.json({ code: 0, data });
  } catch (error) {
    logger.error("获取成就进度失败", { userId: req.user?.userId, error });
    res
      .status(500)
      .json({ code: 500, message: "获取成就进度失败，请稍后重试" });
  }
};