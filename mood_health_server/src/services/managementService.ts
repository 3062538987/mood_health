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

  return {
    listAdminUsers,
    findAdminUserById,
    updateUserRole,
    deleteUserById,
    disableUser,
    listAdminMoods,
  }
}

export type ManagementService = ReturnType<typeof createManagementService>
