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

  const createSubmittedSession = async (
    input: Parameters<AssessmentRepository['createSubmittedSession']>[0]
  ) => repository.createSubmittedSession(input)

  return {
    listQuestionnaires,
    getQuestionnaireById,
    listQuestionsByQuestionnaireId,
    createSubmittedSession,
  }
}

export type AssessmentService = ReturnType<typeof createAssessmentService>
