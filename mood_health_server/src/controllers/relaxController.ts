import { Response } from "express";
import { AuthRequest } from "../middleware/auth";
import { createRelaxRepository } from "../repositories/relaxRepository";
import logger from "../utils/logger";
import { apiFailure, API_ERROR_CODES } from "../utils/apiResponse";

const relaxRepo = createRelaxRepository();

export const saveRelaxRecordHandler = async (
  req: AuthRequest,
  res: Response,
) => {
  try {
    const userId = req.user!.userId;
    const { activityType, startTime, endTime, metrics, moodTag } = req.body;

    if (!activityType || !startTime || !endTime) {
      return res.status(400).json({ code: 400, message: "放松记录参数不完整" });
    }

    const record = await relaxRepo.create(userId, {
      activityType,
      startTime,
      endTime,
      metrics,
      moodTag,
    });
    res.status(201).json({ code: 0, data: record });
  } catch (error) {
    logger.error("保存放松记录失败", { error, userId: req.user?.userId });
    res
      .status(500)
      .json({ code: 500, message: "保存放松记录失败，请稍后重试" });
  }
};

export const getRelaxRecordsHandler = async (
  req: AuthRequest,
  res: Response,
) => {
  try {
    const userId = req.user!.userId;
    const data = await relaxRepo.findAll(userId, {
      startDate: req.query.startDate as string | undefined,
      endDate: req.query.endDate as string | undefined,
      activityType: req.query.activityType as string | undefined,
      page: req.query.page ? Number(req.query.page) : undefined,
      pageSize: req.query.pageSize ? Number(req.query.pageSize) : undefined,
    });
    res.json({ code: 0, data });
  } catch (error) {
    logger.error("获取放松记录失败", { error, userId: req.user?.userId });
    res
      .status(500)
      .json({ code: 500, message: "获取放松记录失败，请稍后重试" });
  }
};

export const getRelaxStatisticsHandler = async (
  req: AuthRequest,
  res: Response,
) => {
  try {
    const userId = req.user!.userId;
    const data = await relaxRepo.getStatistics(userId, {
      startDate: req.query.startDate as string | undefined,
      endDate: req.query.endDate as string | undefined,
    });
    res.json({ code: 0, data });
  } catch (error) {
    logger.error("获取放松统计失败", { error, userId: req.user?.userId });
    res
      .status(500)
      .json({ code: 500, message: "获取放松统计失败，请稍后重试" });
  }
};

export const getRelaxRecordDetailHandler = async (
  req: AuthRequest,
  res: Response,
) => {
  try {
    const userId = req.user!.userId;
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ code: 400, message: "无效的记录 ID" });
    }

    const record = await relaxRepo.findById(userId, id);
    if (!record) {
      return res.status(404).json(apiFailure(API_ERROR_CODES.NOT_FOUND, "放松记录不存在"));
    }

    res.json({ code: 0, data: record });
  } catch (error) {
    logger.error("获取放松记录详情失败", { error, userId: req.user?.userId, id: req.params.id });
    res
      .status(500)
      .json({ code: 500, message: "获取放松记录详情失败，请稍后重试" });
  }
};