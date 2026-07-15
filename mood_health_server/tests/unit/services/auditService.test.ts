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
})
