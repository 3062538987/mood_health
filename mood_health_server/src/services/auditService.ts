import { createAuditRepository, AuditRepository } from '../repositories/auditRepository'

export interface AuditServiceDependencies {
  repository?: AuditRepository
}

export const createAuditService = (dependencies: AuditServiceDependencies = {}) => {
  const repository = dependencies.repository ?? createAuditRepository()

  return {
    list: (options: Parameters<AuditRepository['list']>[0]) => repository.list(options),
    record: (input: Parameters<AuditRepository['record']>[0]) => repository.record(input),
  }
}

export type AuditService = ReturnType<typeof createAuditService>
