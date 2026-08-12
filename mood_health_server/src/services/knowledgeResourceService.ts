import {
  createKnowledgeResourceRepository,
  KnowledgeResourceDto,
  KnowledgeResourceRepository,
} from '../repositories/knowledgeResourceRepository'

export type KnowledgeResourceServiceErrorCode = 'BAD_REQUEST' | 'FORBIDDEN' | 'NOT_FOUND'

export class KnowledgeResourceServiceError extends Error {
  constructor(
    public readonly code: KnowledgeResourceServiceErrorCode,
    public readonly statusCode: number,
    message: string
  ) {
    super(message)
    this.name = 'KnowledgeResourceServiceError'
  }
}

export interface KnowledgeResourceServiceDependencies {
  repository?: KnowledgeResourceRepository
}

const normalizePositiveInteger = (value: number, field: string, maximum?: number): number => {
  if (!Number.isInteger(value) || value <= 0 || (maximum !== undefined && value > maximum)) {
    throw new KnowledgeResourceServiceError('BAD_REQUEST', 400, `${field}参数无效`)
  }
  return value
}

export const createKnowledgeResourceService = (
  dependencies: KnowledgeResourceServiceDependencies = {}
) => {
  const repository = dependencies.repository ?? createKnowledgeResourceRepository()

  const listFolders = (userId: number) =>
    repository.listFolders(normalizePositiveInteger(userId, '用户'))

  const listResources = (input: {
    userId: number
    page?: number
    pageSize?: number
    folderId?: number
    search?: string
  }) => {
    const search = input.search?.trim()
    return repository.listResources({
      userId: normalizePositiveInteger(input.userId, '用户'),
      page: normalizePositiveInteger(input.page ?? 1, '页码'),
      pageSize: normalizePositiveInteger(input.pageSize ?? 20, '每页数量', 100),
      folderId:
        input.folderId === undefined
          ? undefined
          : normalizePositiveInteger(input.folderId, '文件夹'),
      search: search || undefined,
    })
  }

  const getResource = async (input: { userId: number; resourceId: number }) => {
    const resource = await repository.findById(
      normalizePositiveInteger(input.resourceId, '资料'),
      normalizePositiveInteger(input.userId, '用户')
    )
    if (!resource) {
      throw new KnowledgeResourceServiceError('NOT_FOUND', 404, '请求的资料不存在')
    }
    return resource
  }

  const setFavorite = async (input: {
    userId: number
    resourceId: number
    favorite: boolean
  }) => {
    await getResource(input)
    return repository.setFavorite(input.userId, input.resourceId, input.favorite)
  }

  const assertCanModifyResource = (role: string, resource: KnowledgeResourceDto): void => {
    if (resource.isBuiltin && role !== 'admin' && role !== 'super_admin') {
      throw new KnowledgeResourceServiceError(
        'FORBIDDEN',
        403,
        '内置资料仅允许系统管理员修改'
      )
    }
  }

  return { listFolders, listResources, getResource, setFavorite, assertCanModifyResource }
}

export type KnowledgeResourceService = ReturnType<typeof createKnowledgeResourceService>
