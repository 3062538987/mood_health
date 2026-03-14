import { Response, NextFunction } from "express";
import { body, validationResult } from "express-validator";
import { AuthRequest } from "../middleware/auth";
import {
  getQuestionnaires,
  getQuestionnaireById,
  getQuestionsByQuestionnaireId,
  createUserAssessment,
  getUserAssessmentHistory,
} from "../models/questionnaireModel";

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
    const questionnaires = await getQuestionnaires();
    res.json({ code: 0, data: questionnaires });
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
    const questionnaire = await getQuestionnaireById(questionnaireId);
    if (!questionnaire) {
      return res.status(404).json({ code: 404, message: "量表不存在" });
    }
    res.json({ code: 0, data: questionnaire });
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
    const questionnaire = await getQuestionnaireById(questionnaireId);
    if (!questionnaire) {
      return res.status(404).json({ code: 404, message: "量表不存在" });
    }
    const questions = await getQuestionsByQuestionnaireId(questionnaireId);
    // 解析选项JSON
    const parsedQuestions = questions.map((q) => ({
      ...q,
      options: JSON.parse(q.options),
    }));
    res.json({ code: 0, data: parsedQuestions });
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
        .json({ code: 400, message: "参数验证失败", details: errors.array() });
    }

    const userId = req.user!.userId;
    const { questionnaire_id, answers } = req.body;

    const questionnaire = await getQuestionnaireById(questionnaire_id);
    if (!questionnaire) {
      return res.status(404).json({ code: 404, message: "量表不存在" });
    }

    const questions = await getQuestionsByQuestionnaireId(questionnaire_id);
    if (questions.length !== answers.length) {
      return res
        .status(400)
        .json({ code: 400, message: "答案数量与问题数量不符" });
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

    // 生成结果文本
    let resultText = "";
    if (questionnaire.type === "SDS") {
      // SDS评分标准
      if (score < 53) {
        resultText =
          "正常：您的情绪状态良好，没有明显的抑郁症状。继续保持积极的生活态度。";
      } else if (score < 63) {
        resultText =
          "轻度抑郁：您有轻度的抑郁症状，建议适当调整生活方式，多参加社交活动，保持规律的作息。";
      } else if (score < 73) {
        resultText =
          "中度抑郁：您有中度的抑郁症状，建议寻求心理咨询师的帮助，必要时寻求专业治疗。";
      } else {
        resultText =
          "重度抑郁：您有重度的抑郁症状，建议立即寻求专业心理治疗或精神科医生的帮助。";
      }
    } else if (questionnaire.type === "SAS") {
      // SAS评分标准
      if (score < 50) {
        resultText =
          "正常：您的焦虑水平正常，没有明显的焦虑症状。继续保持良好的心态。";
      } else if (score < 60) {
        resultText =
          "轻度焦虑：您有轻度的焦虑症状，建议学习一些放松技巧，如深呼吸、冥想等。";
      } else if (score < 70) {
        resultText =
          "中度焦虑：您有中度的焦虑症状，建议寻求心理咨询师的帮助，学习焦虑管理技巧。";
      } else {
        resultText =
          "重度焦虑：您有重度的焦虑症状，建议立即寻求专业心理治疗或精神科医生的帮助。";
      }
    }

    // 保存测评记录
    await createUserAssessment(userId, questionnaire_id, score, resultText);

    res.json({
      code: 0,
      data: {
        score: score,
        result_text: resultText,
      },
    });
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
    res.json({ code: 0, data: history });
  } catch (error) {
    next(error);
  }
};
