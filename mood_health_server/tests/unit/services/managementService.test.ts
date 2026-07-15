import {
  createManagementRepository,
  ManagementRepository,
} from '../../../src/repositories/managementRepository'
import { createManagementService } from '../../../src/services/managementService'

jest.mock('../../../src/repositories/managementRepository', () => ({
  createManagementRepository: jest.fn(),
}))

const createRepository = (): jest.Mocked<ManagementRepository> => ({
  listAdminUsers: jest.fn(),
  findAdminUserById: jest.fn(),
  updateUserRole: jest.fn(),
  deleteUserById: jest.fn(),
  listAdminMoods: jest.fn(),
})

describe('managementService', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('delegates admin user and mood aggregate reads to the repository boundary', async () => {
    const repository = createRepository()
    repository.listAdminUsers.mockResolvedValue([
      {
        id: 2,
        username: 'student_demo',
        email: 'student@example.com',
        role: 'user',
        createdAt: '2026-07-15T00:00:00.000Z',
      },
    ])
    repository.listAdminMoods.mockResolvedValue({
      list: [],
      total: 0,
      page: 2,
      pageSize: 10,
    })
    jest.mocked(createManagementRepository).mockReturnValue(repository)
    const service = createManagementService()

    await expect(service.listAdminUsers()).resolves.toHaveLength(1)
    await expect(service.listAdminMoods({ page: 2, pageSize: 10 })).resolves.toEqual({
      list: [],
      total: 0,
      page: 2,
      pageSize: 10,
    })

    expect(repository.listAdminUsers).toHaveBeenCalledWith()
    expect(repository.listAdminMoods).toHaveBeenCalledWith({ page: 2, pageSize: 10 })
  })

  it('delegates admin user mutations to the repository boundary', async () => {
    const repository = createRepository()
    repository.findAdminUserById.mockResolvedValue({
      id: 2,
      username: 'student_demo',
      email: 'student@example.com',
      role: 'user',
      createdAt: '2026-07-15T00:00:00.000Z',
    })
    repository.updateUserRole.mockResolvedValue(true)
    repository.deleteUserById.mockResolvedValue(true)
    const service = createManagementService({ repository })

    await expect(service.findAdminUserById(2)).resolves.toMatchObject({ id: 2 })
    await expect(service.updateUserRole(2, 'admin')).resolves.toBe(true)
    await expect(service.deleteUserById(2)).resolves.toBe(true)

    expect(repository.findAdminUserById).toHaveBeenCalledWith(2)
    expect(repository.updateUserRole).toHaveBeenCalledWith(2, 'admin')
    expect(repository.deleteUserById).toHaveBeenCalledWith(2)
  })
})
