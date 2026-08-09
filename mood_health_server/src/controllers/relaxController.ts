import { HTTP_STATUS } from '../utils/httpStatus'
import { Response } from "express";
import { AuthRequest } from "../middleware/auth";
import { createRelaxRepository } from "../repositories/relaxRepository";
import logger from "../utils/logger";
import { apiFailure, apiSuccess, API_ERROR_CODES } from "../utils/apiResponse";

const relaxRepo = createRelaxRepository();

export const saveRelaxRecordHandler = async (
  req: AuthRequest,
  res: Response,
) => {
  try {
    const userId = req.user!.userId;
    const { activityType, startTime, endTime, metrics, moodTag, clientId, clientTimestamp } = req.body;

    if (!activityType || !startTime || !endTime) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json(apiFailure(400, "放松记录参数不完整"));
    }

    // 时长上限校验
    const start = new Date(startTime).getTime()
    const end = new Date(endTime).getTime()
    if (isNaN(start) || isNaN(end) || end <= start) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json(apiFailure(400, "时间参数无效"));
    }
    const durationMs = end - start
    const maxDurationMs = 4 * 60 * 60 * 1000 // 4小时上限
    if (durationMs > maxDurationMs) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json(apiFailure(400, "放松时长不能超过4小时"));
    }

    const record = await relaxRepo.createOrUpsert(userId, {
      activityType,
      startTime,
      endTime,
      metrics,
      moodTag,
      clientId: clientId || null,
      clientTimestamp: clientTimestamp || 0,
    });
    res.status(HTTP_STATUS.CREATED).json(apiSuccess(record, "保存放松记录成功"));
  } catch (error) {
    logger.error("保存放松记录失败", { error, userId: req.user?.userId });
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(apiFailure(500, "保存放松记录失败，请稍后重试"));
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
    res.json(apiSuccess(data, "获取放松记录成功"));
  } catch (error) {
    logger.error("获取放松记录失败", { error, userId: req.user?.userId });
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(apiFailure(500, "获取放松记录失败，请稍后重试"));
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
    res.json(apiSuccess(data, "获取放松统计成功"));
  } catch (error) {
    logger.error("获取放松统计失败", { error, userId: req.user?.userId });
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(apiFailure(500, "获取放松统计失败，请稍后重试"));
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
      return res.status(HTTP_STATUS.BAD_REQUEST).json(apiFailure(400, "无效的记录 ID"));
    }

    const record = await relaxRepo.findById(userId, id);
    if (!record) {
      return res.status(HTTP_STATUS.NOT_FOUND).json(apiFailure(API_ERROR_CODES.NOT_FOUND, "放松记录不存在"));
    }

    res.json(apiSuccess(record, "获取放松记录详情成功"));
  } catch (error) {
    logger.error("获取放松记录详情失败", { error, userId: req.user?.userId, id: req.params.id });
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(apiFailure(500, "获取放松记录详情失败，请稍后重试"));
  }
};