import { Router } from "express";
import { body } from "express-validator";
import { authenticate } from "../middleware/auth";
import { validateRequest } from "../middleware/validateRequest";
import {
  getQuestionnaireList,
  getQuestionnaireDetail,
  getQuestionnaireQuestions,
  submitAssessment,
  getUserAssessmentHistoryController,
} from "../controllers/questionnaireController";

const router = Router();

// 所有量表路由都需要认证
router.use(authenticate);

// 获取量表列表
router.get("/", getQuestionnaireList);

// 获取量表详情
router.get("/:id", getQuestionnaireDetail);

// 获取量表问题列表
router.get("/:id/questions", getQuestionnaireQuestions);

// 提交测评答案
router.post(
  "/assessments",
  [
    body("questionnaire_id").isInt().withMessage("量表 ID 必须是整数"),
    body("answers").isArray().withMessage("答案必须是数组"),
    body("answers.*")
      .isInt({ min: 0, max: 3 })
      .withMessage("答案必须是 0-3 之间的整数"),
  ],
  validateRequest,
  submitAssessment,
);

// 获取用户测评历史记录
router.get("/history", getUserAssessmentHistoryController);

export default router;
