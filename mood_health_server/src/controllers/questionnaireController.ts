import { Response, NextFunction } from "express";
import { body } from "express-validator";
import { AuthRequest } from "../middleware/auth";
import { API_ERROR_CODES, apiFailure, apiSuccess } from "../utils/apiResponse";
import { createAssessmentService } from "../services/assessmentService";
import { HttpException } from "../utils/errors";

const assessmentService = createAssessmentService();

/**
 * 验证提交测评答案的参数
 */
export const validateSubmitAssessment = [
  body("questionnaire_id").isInt({ min: 1 }).withMessage("问卷ID必须是正整数"),
  body("answers").isArray().withMessage("答案必须是数组"),
  body("answers.*.itemId").isInt({ min: 1 }).withMessage("题目ID必须是正整数"),
  body("answers.*.score").isInt({ min: 0, max: 4 }).withMessage("每个答案分数必须是0-4之间的整数"),
];

/**
 * 获取量表列表
 */
export const getQuestionnaireList = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const questionnaires = await assessmentService.listQuestionnaires();
    res.json(apiSuccess(questionnaires, "获取问卷列表成功"));
  } catch (error) {
    next(error);
  }
};

/**
 * 获取量表详情
 */
export const getQuestionnaireDetail = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const questionnaireId = parseInt(req.params.id as string);
    const questionnaire = await assessmentService.getQuestionnaireById(questionnaireId);
    if (!questionnaire) {
      return res.status(404).json(apiFailure(404, "量表不存在"));
    }
    res.json(apiSuccess(questionnaire, "获取问卷详情成功"));
  } catch (error) {
    next(error);
  }
};

/**
 * 获取量表问题列表
 */
export const getQuestionnaireQuestions = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const questionnaireId = parseInt(req.params.id as string);
    const questionnaire = await assessmentService.getQuestionnaireById(questionnaireId);
    if (!questionnaire) {
      return res.status(404).json(apiFailure(404, "量表不存在"));
    }
    const questions = await assessmentService.listQuestionsByQuestionnaireId(questionnaireId);
    const parsedQuestions = questions.map((q) => ({
      ...q,
      options: JSON.parse(q.options),
    }));
    res.json(apiSuccess(parsedQuestions, "获取问卷题目成功"));
  } catch (error) {
    next(error);
  }
};

/**
 * 提交测评答案
 * 按照 API 契约规范（docs/tech-design/03-api-contract.md）实现：
 * - 请求体: { questionnaire_id, answers: [{ itemId, score }] }
 * - 响应: { code: 0, data: { sessionId, totalScore, riskLevel, suggestion } }
 */
export const submitAssessment = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userId = req.user!.userId;
    const { questionnaire_id, answers } = req.body;

    if (!questionnaire_id || !answers || !Array.isArray(answers) || answers.length === 0) {
      return res.status(400).json(apiFailure(80001, "请提供完整的测评答案"));
    }

    const result = await assessmentService.submitAssessment({
      userId,
      questionnaireId: questionnaire_id,
      answers: answers.map((a: { itemId: number; score: number }) => ({
        itemId: a.itemId,
        score: a.score,
      })),
    });

    res.status(201).json(apiSuccess(result, "测评提交成功"));
  } catch (error) {
    if (error instanceof HttpException) {
      return res.status(error.statusCode).json(apiFailure(error.statusCode, error.message));
    }
    next(error);
  }
};

/**
 * 获取测评结果详情
 * 按照 API 契约规范实现
 */
export const getAssessmentDetail = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const sessionId = parseInt(req.params.id as string);
    const detail = await assessmentService.getSessionDetail(sessionId);

    if (!detail) {
      return res.status(404).json(apiFailure(40002, "测评会话不存在"));
    }

    res.json(apiSuccess(detail, "获取测评详情成功"));
  } catch (error) {
    next(error);
  }
};

/**
 * 获取用户的问卷历史记录
 */
export const getUserAssessmentHistoryController = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userId = req.user!.userId;
    const history = await assessmentService.listUserAssessmentHistory(userId);
    res.json(apiSuccess(history, "获取筛查历史成功"));
  } catch (error) {
    next(error);
  }
};