import { Router } from "express";
import { body } from "express-validator";
import { authenticate } from "../middleware/auth";
import { validateRequest } from "../middleware/validateRequest";
import {
  recordMood,
  getMoodList,
  getWeeklyReportHandler,
  updateMoodHandler,
  deleteMoodHandler,
  getMoodTrend,
  getMoodTypes,
  getTagsHandler,
  createTagHandler,
  getMoodAnalysisHandler,
  saveAdviceHandler,
  getAdviceHistoryHandler,
} from "../controllers/moodController";

const router = Router();

router.use(authenticate);

router.post(
  "/record",
  [
    body("emotions").optional().isArray().withMessage("情绪数据必须是数组"),
    body("emotions.*.emotionTypeId")
      .optional()
      .isInt()
      .withMessage("情绪类型ID必须是整数"),
    body("emotions.*.intensity")
      .optional()
      .isInt({ min: 1, max: 10 })
      .withMessage("情绪强度必须在1-10之间"),
    body("tagIds").optional().isArray().withMessage("标签ID必须是数组"),
    body("trigger").optional().isString().withMessage("触发因素必须是字符串"),
    body("event").optional().isString().withMessage("情绪描述必须是字符串"),
  ],
  validateRequest,
  recordMood,
);
router.get("/list", getMoodList);
router.get("/weekly-report", getWeeklyReportHandler);
router.get("/trend", getMoodTrend);
router.get("/analysis", getMoodAnalysisHandler);
router.get("/types", getMoodTypes);
router.get("/tags", getTagsHandler);
router.post(
  "/tags",
  [body("name").notEmpty().withMessage("标签名称不能为空")],
  validateRequest,
  createTagHandler,
);
router.post(
  "/advice/save",
  [
    body("analysis").notEmpty().withMessage("分析内容不能为空"),
    body("suggestions").isArray().withMessage("建议列表必须是数组"),
  ],
  validateRequest,
  saveAdviceHandler,
);
router.get("/advice/history", getAdviceHistoryHandler);
router.put(
  "/:id",
  [
    body("emotions").optional().isArray().withMessage("情绪数据必须是数组"),
    body("emotions.*.emotionTypeId")
      .optional()
      .isInt()
      .withMessage("情绪类型ID必须是整数"),
    body("emotions.*.intensity")
      .optional()
      .isInt({ min: 1, max: 10 })
      .withMessage("情绪强度必须在1-10之间"),
    body("tagIds").optional().isArray().withMessage("标签ID必须是数组"),
    body("trigger").optional().isString().withMessage("触发因素必须是字符串"),
    body("note").optional().isString().withMessage("备注必须是字符串"),
  ],
  validateRequest,
  updateMoodHandler,
);
router.delete("/:id", deleteMoodHandler);

export default router;
