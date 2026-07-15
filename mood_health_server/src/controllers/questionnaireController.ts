import { Response, NextFunction } from "express";
import { body, validationResult } from "express-validator";
import { AuthRequest } from "../middleware/auth";
import {
  getQuestionnaireById,
  getQuestionsByQuestionnaireId,
  createUserAssessment,
  getUserAssessmentHistory,
} from "../models/questionnaireModel";
import { apiFailure, apiSuccess } from "../utils/apiResponse";
import { createAssessmentService } from "../services/assessmentService";

const assessmentService = createAssessmentService();

type ScreeningRiskLevel = "low" | "mild" | "moderate" | "high" | "unclassified";

const SCREENING_DISCLAIMER =
  "本结果仅用于自我筛查与风险提示，不构成医学诊断，也不能替代心理咨询师或医疗专业人员的评估。";

const buildScreeningResult = (questionnaireType: string, score: number) => {
  let riskLevel: ScreeningRiskLevel = "unclassified";
  let riskLabel = "暂未分层";
  let suggestion = "当前量表与评分规则仍需结合论文方向和导师要求确认，请仅将结果用于自我了解。";

  if (questionnaireType === "SDS") {
    if (score < 53) {
      riskLevel = "low";
      riskLabel = "较低风险";
      suggestion = "建议继续保持规律作息，并持续关注近期情绪变化。";
    } else if (score < 63) {
      riskLevel = "mild";
      riskLabel = "轻度风险提示";
      suggestion = "建议适当调整生活节奏，与信任的人交流，并持续观察情绪困扰是否缓解。";
    } else if (score < 73) {
      riskLevel = "moderate";
      riskLabel = "中度风险提示";
      suggestion = "建议联系学校心理中心或心理咨询师，获得进一步专业评估与支持。";
    } else {
      riskLevel = "high";
      riskLabel = "较高风险提示";
      suggestion = "建议尽快联系学校心理中心、心理咨询师或医疗专业人员获得进一步评估与支持。";
    }
  } else if (questionnaireType === "SAS") {
    if (score < 50) {
      riskLevel = "low";
      riskLabel = "较低风险";
      suggestion = "建议继续保持规律作息，并持续关注近期紧张和担忧感受。";
    } else if (score < 60) {
      riskLevel = "mild";
      riskLabel = "轻度风险提示";
      suggestion = "建议练习放松技巧、调整生活节奏，并持续观察相关困扰是否缓解。";
    } else if (score < 70) {
      riskLevel = "moderate";
      riskLabel = "中度风险提示";
      suggestion = "建议联系学校心理中心或心理咨询师，获得进一步专业评估与支持。";
    } else {
      riskLevel = "high";
      riskLabel = "较高风险提示";
      suggestion = "建议尽快联系学校心理中心、心理咨询师或医疗专业人员获得进一步评估与支持。";
    }
  }

  return {
    riskLevel,
    resultText: `筛查提示：当前得分处于${riskLabel}区间。${suggestion}`,
  };
};

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
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    // 验证请求参数
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res
        .status(400)
        .json(apiFailure(400, "参数验证失败", { details: errors.array() }));
    }

    const userId = req.user!.userId;
    const { questionnaire_id, answers } = req.body;

    const questionnaire = await getQuestionnaireById(questionnaire_id);
    if (!questionnaire) {
      return res.status(404).json(apiFailure(404, "量表不存在"));
    }

    const questions = await getQuestionsByQuestionnaireId(questionnaire_id);
    if (questions.length !== answers.length) {
      return res.status(400).json(apiFailure(400, "答案数量与问题数量不符"));
    }

    // 计算得分
    let score = 0;
    for (let i = 0; i < questions.length; i++) {
      const question = questions[i];
      const answer = answers[i];
      let questionScore = answer + 1; // 选项从0开始，得分从1开始

      // 处理反向计分
      if (question.is_reverse) {
        questionScore = 5 - questionScore;
      }

      score += questionScore;
    }

    const { riskLevel, resultText } = buildScreeningResult(questionnaire.type, score);

    // 保存测评记录
    await createUserAssessment(userId, questionnaire_id, score, resultText);

    res.json(
      apiSuccess(
        {
          score,
          result_text: resultText,
          screening_type: questionnaire.type,
          risk_level: riskLevel,
          disclaimer: SCREENING_DISCLAIMER,
        },
        "筛查结果已保存",
      ),
    );
  } catch (error) {
    next(error);
  }
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
    const history = await getUserAssessmentHistory(userId);
    res.json(apiSuccess(history, "获取筛查历史成功"));
  } catch (error) {
    next(error);
  }
};
