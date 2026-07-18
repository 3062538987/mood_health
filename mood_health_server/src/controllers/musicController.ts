import { Request, Response } from "express";
import { createMusicRepository } from "../repositories/musicRepository";
import { apiFailure, API_ERROR_CODES } from "../utils/apiResponse";
import logger from "../utils/logger";

const musicRepo = createMusicRepository();

// 获取音乐列表
export const getMusicList = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { category } = req.query;
    const musicList = await musicRepo.findAll(category as string | undefined);

    res.status(200).json({
      success: true,
      data: musicList,
      message: "获取音乐列表成功",
    });
  } catch (error) {
    logger.error("获取音乐列表失败:", error);
    res.status(500).json({
      success: false,
      message: "服务器错误",
    });
  }
};

// 获取单个音乐详情
export const getMusicById = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { id } = req.params;
    const music = await musicRepo.findById(parseInt(id as string));

    if (!music) {
      res.status(404).json(apiFailure(API_ERROR_CODES.NOT_FOUND, '音乐不存在'));
      return;
    }

    res.status(200).json({
      success: true,
      data: music,
      message: "获取音乐详情成功",
    });
  } catch (error) {
    logger.error("获取音乐详情失败:", error);
    res.status(500).json({
      success: false,
      message: "服务器错误",
    });
  }
};

// 创建音乐（管理员功能）
export const createMusic = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { title, artist, url, duration, category, cover } = req.body;

    if (duration != null && (duration < 1 || duration > 36000)) {
      res.status(400).json({ success: false, message: '音乐时长必须在1-36000秒之间' });
      return;
    }

    const music = await musicRepo.create({
      title,
      artist,
      url,
      duration,
      category,
      cover,
    });

    res.status(201).json({
      success: true,
      data: music,
      message: "创建音乐成功",
    });
  } catch (error) {
    logger.error("创建音乐失败:", error);
    res.status(500).json({
      success: false,
      message: "服务器错误",
    });
  }
};

// 更新音乐（管理员功能）
export const updateMusic = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { id } = req.params;
    const { title, artist, url, duration, category, cover } = req.body;
    const music = await musicRepo.update(parseInt(id as string), {
      title,
      artist,
      url,
      duration,
      category,
      cover,
    });

    if (!music) {
      res.status(404).json(apiFailure(API_ERROR_CODES.NOT_FOUND, '音乐不存在'));
      return;
    }

    res.status(200).json({
      success: true,
      data: music,
      message: "更新音乐成功",
    });
  } catch (error) {
    logger.error("更新音乐失败:", error);
    res.status(500).json({
      success: false,
      message: "服务器错误",
    });
  }
};

// 删除音乐（管理员功能）
export const deleteMusic = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { id } = req.params;
    const success = await musicRepo.remove(parseInt(id as string));

    if (!success) {
      res.status(404).json(apiFailure(API_ERROR_CODES.NOT_FOUND, '音乐不存在'));
      return;
    }

    res.status(200).json({
      success: true,
      message: "删除音乐成功",
    });
  } catch (error) {
    logger.error("删除音乐失败:", error);
    res.status(500).json({
      success: false,
      message: "服务器错误",
    });
  }
};