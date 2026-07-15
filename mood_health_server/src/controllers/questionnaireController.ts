import { Response, NextFunction } from "express";
import { body } from "express-validator";
import { AuthRequest } from "../middleware/auth";
import { API_ERROR_CODES, apiFailure, apiSuccess } from "../utils/apiResponse";
import { createAssessmentService } from "../services/assessmentService";

const assessmentService = createAssessmentService();

/**
 * 验证提交测评答案的参数
 */
export const validateSubmitAssessment = [
  body("questionnaire_id").isInt({ min: 1 }).withMessage("问卷ID必须是正整数"),
  body("answers").isArray().withMessage("答案必须是数组"),
  body("answers.*")
    .isInt({ min: 0, max: 4 })
    .withMessage("每个答案必须是0-4之间的整数"),
];

/**
 * 获取量表列表
 * @param req 请求对象
 * @param res 响应对象
 * @param next 下一个中间件
 * @returns 200状态码表示成功，500表示服务器错误
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
 * @param req 请求对象，包含量表ID
 * @param res 响应对象
 * @param next 下一个中间件
 * @returns 200状态码表示成功，404表示量表不存在，500表示服务器错误
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
 * @param req 请求对象，包含量表ID
 * @param res 响应对象
 * @param next 下一个中间件
 * @returns 200状态码表示成功，404表示量表不存在，500表示服务器错误
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
    // 解析选项JSON
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
 * @param req 请求对象，包含量表ID和答案数组
 * @param res 响应对象
 * @param next 下一个中间件
 * @returns 200状态码表示成功，400表示参数错误，404表示量表不存在，500表示服务器错误
 */
export const submitAssessment = async (
  _req: AuthRequest,
  res: Response,
  _next: NextFunction,
) => {
  res
    .status(503)
    .json(
      apiFailure(
        API_ERROR_CODES.FEATURE_DISABLED,
        "心理测评量表尚未完成选型与审核，暂不开放提交",
      ),
    );
};

/**
 * 获取用户的问卷历史记录
 * @param req 请求对象
 * @param res 响应对象
 * @param next 下一个中间件
 * @returns 200 状态码表示成功，500 表示服务器错误
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
