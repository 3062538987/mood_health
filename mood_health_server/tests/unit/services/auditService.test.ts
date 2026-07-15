import { AuditRepository } from '../../../src/repositories/auditRepository'
import { createAuditService } from '../../../src/services/auditService'

const createRepository = (): jest.Mocked<AuditRepository> => ({
  record: jest.fn(),
  list: jest.fn(),
})

describe('auditService', () => {
  it('delegates filtered audit reads to the repository boundary', async () => {
    const repository = createRepository()
    repository.list.mockResolvedValue({ list: [], total: 0, page: 1, pageSize: 20 })
    const service = createAuditService({ repository })
    const options = { role: 'super_admin', page: 1, pageSize: 20 }

    await expect(service.list(options)).resolves.toEqual({
      list: [],
      total: 0,
      page: 1,
      pageSize: 20,
    })
    expect(repository.list).toHaveBeenCalledWith(options)
  })

  it('delegates audit writes to the repository boundary', async () => {
    const repository = createRepository()
    repository.record.mockResolvedValue(undefined)
    const service = createAuditService({ repository })
    const input = {
      actorUserId: 7,
      actorRoleCode: 'super_admin',
      permissionCode: 'user.manage',
      action: 'USER_LIST',
      targetType: null,
      targetId: null,
      result: 'success' as const,
      summary: 'count=2',
      ipAddress: '127.0.0.1',
      requestId: null,
    }

    await service.record(input)

    expect(repository.record).toHaveBeenCalledWith(input)
  })
})
