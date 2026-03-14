import request from "@/utils/request";

export interface Questionnaire {
  id: number;
  title: string;
  description: string;
  type: string;
  created_at: string;
}

export interface Question {
  id: number;
  questionnaire_id: number;
  question_text: string;
  question_type: string;
  options: string[];
  sort_order: number;
  is_reverse: boolean;
}

export interface AssessmentResult {
  score: number;
  result_text: string;
}

export interface AssessmentAnswers {
  questionnaire_id: number;
  answers: number[];
}

export interface AssessmentHistory {
  id: number;
  user_id: number;
  questionnaire_id: number;
  score: number;
  result_text: string;
  created_at: string;
  title: string;
  type: string;
}

export const getQuestionnaires = () => {
  return request({
    url: "/api/questionnaires",
    method: "get",
  });
};

export const getQuestionnaireDetail = (id: number) => {
  return request({
    url: `/api/questionnaires/${id}`,
    method: "get",
  });
};

export const getQuestionnaireQuestions = (id: number) => {
  return request({
    url: `/api/questionnaires/${id}/questions`,
    method: "get",
  });
};

export const submitAssessment = (data: AssessmentAnswers) => {
  return request({
    url: "/api/questionnaires/assessments",
    method: "post",
    data,
  });
};

export const getAssessmentHistory = () => {
  return request({
    url: "/api/questionnaires/history",
    method: "get",
  });
};
