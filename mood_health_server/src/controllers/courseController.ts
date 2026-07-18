import { Request, Response, NextFunction } from "express";
import { createCourseRepository } from "../repositories/courseRepository";
import { apiFailure, API_ERROR_CODES } from "../utils/apiResponse";

const courseRepo = createCourseRepository();

// 获取课程列表
export const getCourses = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { category } = req.query;
    const courses = await courseRepo.findAll(category as string | undefined);
    res.json(courses);
  } catch (error) {
    next(error);
  }
};

// 获取课程详情
export const getCourseById = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { id } = req.params;
    const course = await courseRepo.findById(parseInt(id as string));

    if (!course) {
      res.status(404).json(apiFailure(API_ERROR_CODES.NOT_FOUND, '课程不存在'));
      return;
    }

    // 增加学习人数
    await courseRepo.incrementStudyCount(parseInt(id as string));

    res.json(course);
  } catch (error) {
    next(error);
  }
};

// 创建课程（管理员功能）
export const createCourse = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { title, description, coverUrl, content, category, type } = req.body;

    const newCourse = await courseRepo.create({
      title,
      description,
      coverUrl,
      content,
      category,
      type,
    });

    res.status(201).json(newCourse);
  } catch (error) {
    next(error);
  }
};

// 更新课程（管理员功能）
export const updateCourse = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { id } = req.params;
    const { title, description, coverUrl, content, category, type } = req.body;

    const updated = await courseRepo.update(parseInt(id as string), {
      title,
      description,
      coverUrl,
      content,
      category,
      type,
    });

    if (!updated) {
      res.status(404).json(apiFailure(API_ERROR_CODES.NOT_FOUND, '课程不存在'));
      return;
    }

    res.json(updated);
  } catch (error) {
    next(error);
  }
};

// 删除课程（管理员功能）
export const deleteCourse = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { id } = req.params;

    const deleted = await courseRepo.remove(parseInt(id as string));

    if (!deleted) {
      res.status(404).json(apiFailure(API_ERROR_CODES.NOT_FOUND, '课程不存在'));
      return;
    }

    res.json({ message: "Course deleted successfully" });
  } catch (error) {
    next(error);
  }
};