import { Request, Response, NextFunction } from "express";
import {
  getCourses as getCoursesModel,
  getCourseById as getCourseByIdModel,
  createCourse as createCourseModel,
  updateCourse as updateCourseModel,
  deleteCourse as deleteCourseModel,
  incrementStudyCount,
} from "../models/courseModel";

// 获取课程列表
export const getCourses = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { category } = req.query;
    const courses = await getCoursesModel(category as string);
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
    const course = await getCourseByIdModel(parseInt(id as string));

    if (!course) {
      res.status(404).json({ error: "Course not found" });
      return;
    }

    // 增加学习人数
    await incrementStudyCount(parseInt(id as string));

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

    const courseId = await createCourseModel({
      title,
      description,
      coverUrl,
      content,
      category,
      type,
    });

    const newCourse = await getCourseByIdModel(courseId);
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

    const updated = await updateCourseModel(parseInt(id as string), {
      title,
      description,
      coverUrl,
      content,
      category,
      type,
    });

    if (!updated) {
      res.status(404).json({ error: "Course not found" });
      return;
    }

    const updatedCourse = await getCourseByIdModel(parseInt(id as string));
    res.json(updatedCourse);
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

    const deleted = await deleteCourseModel(parseInt(id as string));

    if (!deleted) {
      res.status(404).json({ error: "Course not found" });
      return;
    }

    res.json({ message: "Course deleted successfully" });
  } catch (error) {
    next(error);
  }
};
