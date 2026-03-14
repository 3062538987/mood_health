import express from "express";
import {
  getCourses,
  getCourseById,
  createCourse,
  updateCourse,
  deleteCourse,
} from "../controllers/courseController";
import { authenticate } from "../middleware/auth";

const router = express.Router();

// 公开路由
router.get("/", getCourses);
router.get("/:id", getCourseById);

// 需要认证的路由（管理员）
router.post("/", authenticate, createCourse);
router.put("/:id", authenticate, updateCourse);
router.delete("/:id", authenticate, deleteCourse);

export default router;
