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

  const listAdminMoods = async (
    options: Parameters<ManagementRepository['listAdminMoods']>[0]
  ) => repository.listAdminMoods(options)

  return {
    listAdminUsers,
    listAdminMoods,
  }
}

export type ManagementService = ReturnType<typeof createManagementService>
