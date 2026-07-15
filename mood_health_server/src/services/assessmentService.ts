import {
  AssessmentRepository,
  createAssessmentRepository,
} from '../repositories/assessmentRepository'

export interface AssessmentServiceDependencies {
  repository?: AssessmentRepository
}

export const createAssessmentService = (dependencies: AssessmentServiceDependencies = {}) => {
  const repository = dependencies.repository ?? createAssessmentRepository()

  const listQuestionnaires = async () => repository.listQuestionnaires()

  const getQuestionnaireById = async (id: number) => repository.getQuestionnaireById(id)

  const listQuestionsByQuestionnaireId = async (questionnaireId: number) =>
    repository.listQuestionsByQuestionnaireId(questionnaireId)

  return {
    listQuestionnaires,
    getQuestionnaireById,
    listQuestionsByQuestionnaireId,
  }
}

export type AssessmentService = ReturnType<typeof createAssessmentService>
