import { Response } from "express";
import { AuthRequest } from "../middleware/auth";
import {
  checkAchievements,
  getAchievementProgress,
  getAllAchievements,
  getUserAchievements,
} from "../models/achievementModel";
import logger from "../utils/logger";

export const getAchievementsHandler = async (
  _req: AuthRequest,
  res: Response,
) => {
  try {
    const data = await getAllAchievements();
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
    const data = await getUserAchievements(req.user!.userId);
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
    const data = await checkAchievements(req.user!.userId);
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
    const data = await getAchievementProgress(req.user!.userId);
    res.json({ code: 0, data });
  } catch (error) {
    logger.error("获取成就进度失败", { userId: req.user?.userId, error });
    res
      .status(500)
      .json({ code: 500, message: "获取成就进度失败，请稍后重试" });
  }
};
