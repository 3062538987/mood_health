import { HTTP_STATUS } from '../utils/httpStatus'
import { Request, Response } from "express";
import { createMusicRepository } from "../repositories/musicRepository";
import { apiFailure, apiSuccess, API_ERROR_CODES } from "../utils/apiResponse";
import logger from "../utils/logger";

const musicRepo = createMusicRepository();

const requiredText = (value: unknown, maximum: number): string | null => {
  if (typeof value !== 'string' || !value.trim()) return null
  const normalized = value.trim()
  return normalized.length <= maximum ? normalized : null
}

const safeHttpsUrl = (value: unknown): string | null => {
  const normalized = requiredText(value, 512)
  if (!normalized) return null
  try {
    const url = new URL(normalized)
    return url.protocol === 'https:' && !url.username && !url.password ? normalized : null
  } catch {
    return null
  }
}

// 获取音乐列表
export const getMusicList = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { category } = req.query;
    const musicList = await musicRepo.findAll(category as string | undefined);

    res.status(HTTP_STATUS.OK).json(apiSuccess(musicList, "获取音乐列表成功"));
  } catch (error) {
    logger.error("获取音乐列表失败:", error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(
      apiFailure(API_ERROR_CODES.INTERNAL_ERROR, "服务器错误"),
    );
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
      res.status(HTTP_STATUS.NOT_FOUND).json(apiFailure(API_ERROR_CODES.NOT_FOUND, '音乐不存在'));
      return;
    }

    res.status(HTTP_STATUS.OK).json(apiSuccess(music, "获取音乐详情成功"));
  } catch (error) {
    logger.error("获取音乐详情失败:", error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(
      apiFailure(API_ERROR_CODES.INTERNAL_ERROR, "服务器错误"),
    );
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
      res.status(HTTP_STATUS.NOT_FOUND).json(apiFailure(API_ERROR_CODES.NOT_FOUND, '音乐不存在'));
      return;
    }

    res.status(HTTP_STATUS.OK).json(apiSuccess(music, "更新音乐成功"));
  } catch (error) {
    logger.error("更新音乐失败:", error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(
      apiFailure(API_ERROR_CODES.INTERNAL_ERROR, "服务器错误"),
    );
  }
};

export const createMusic = async (req: Request, res: Response): Promise<void> => {
  try {
    const title = requiredText(req.body?.title, 255)
    const artist = requiredText(req.body?.artist, 255)
    const url = safeHttpsUrl(req.body?.url)
    const duration = requiredText(req.body?.duration, 32)
    const category = requiredText(req.body?.category, 64)
    const cover = req.body?.cover ? safeHttpsUrl(req.body.cover) : null

    if (!title || !artist || !url || !duration || !category || (req.body?.cover && !cover)) {
      res.status(HTTP_STATUS.BAD_REQUEST).json(
        apiFailure(API_ERROR_CODES.BAD_REQUEST, '请填写完整信息，音乐和封面必须使用 HTTPS 地址')
      )
      return
    }

    const music = await musicRepo.create({ title, artist, url, duration, category, cover })
    res.status(HTTP_STATUS.CREATED).json(apiSuccess(music, '添加音乐成功'))
  } catch (error) {
    logger.error('添加音乐失败:', error)
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json(
      apiFailure(API_ERROR_CODES.INTERNAL_ERROR, '服务器错误')
    )
  }
}
