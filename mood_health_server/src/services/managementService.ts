import {
  createManagementRepository,
  ManagementRepository,
} from '../repositories/managementRepository'

export interface ManagementServiceDependencies {
  repository?: ManagementRepository
}

export const createManagementService = (dependencies: ManagementServiceDependencies = {}) => {
  const repository = dependencies.repository ?? createManagementRepository()

  const listAdminUsers = async () => repository.listAdminUsers()

  const findAdminUserById = async (userId: number) => repository.findAdminUserById(userId)

  const updateUserRole = async (
    userId: number,
    role: Parameters<ManagementRepository['updateUserRole']>[1]
  ) => repository.updateUserRole(userId, role)

  const deleteUserById = async (userId: number) => repository.deleteUserById(userId)

  const disableUser = async (userId: number) => repository.disableUser(userId)

  const listAdminMoods = async (
    options: Parameters<ManagementRepository['listAdminMoods']>[0]
  ) => repository.listAdminMoods(options)

  const getKpiStats = async (startDate?: string, endDate?: string) =>
    repository.getKpiStats(startDate, endDate)

  const getMoodTrend = async (startDate: string, endDate: string, granularity: 'day' | 'week' = 'day') =>
    repository.getMoodTrend(startDate, endDate, granularity)

  const getMoodDistribution = async (startDate: string, endDate: string) =>
    repository.getMoodDistribution(startDate, endDate)

  const getAssessmentDistribution = async (startDate: string, endDate: string, instrumentId?: number) =>
    repository.getAssessmentDistribution(startDate, endDate, instrumentId)

  const getModuleUsage = async (startDate: string, endDate: string) =>
    repository.getModuleUsage(startDate, endDate)

  return {
    listAdminUsers,
    findAdminUserById,
    updateUserRole,
    deleteUserById,
    disableUser,
    listAdminMoods,
    getKpiStats,
    getMoodTrend,
    getMoodDistribution,
    getAssessmentDistribution,
    getModuleUsage,
  }
}

export type ManagementService = ReturnType<typeof createManagementService>
