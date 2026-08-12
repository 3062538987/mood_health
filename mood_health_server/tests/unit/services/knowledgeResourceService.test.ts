import {
  createKnowledgeResourceService,
  KnowledgeResourceServiceError,
} from '../../../src/services/knowledgeResourceService'
import type {
  KnowledgeFolderDto,
  KnowledgeResourceDto,
  KnowledgeResourceRepository,
} from '../../../src/repositories/knowledgeResourceRepository'

const now = '2026-08-13T00:00:00.000Z'

const builtinFolder: KnowledgeFolderDto = {
  id: 1,
  slug: 'builtin',
  name: '内置资料',
  description: '平台审核的权威资料',
  isBuiltin: true,
  ownerUserId: null,
  createdAt: now,
  updatedAt: now,
}

const builtinResource: KnowledgeResourceDto = {
  id: 10,
  folderId: 1,
  folderSlug: 'builtin',
  title: '压力管理指南',
  summary: '权威压力管理资料',
  resourceType: 'link',
  sourceUrl: 'https://www.who.int/example',
  licenseCode: 'LINK_ONLY',
  isBuiltin: true,
  ingestionStatus: 'ready',
  reviewedAt: '2026-08-13',
  favorited: false,
  createdAt: now,
  updatedAt: now,
}

const makeRepository = (): KnowledgeResourceRepository => {
  let favorited = false
  return {
    listFolders: async () => [builtinFolder],
    listResources: async (input) => ({
      items: [{ ...builtinResource, favorited }],
      total: 1,
      page: input.page,
      pageSize: input.pageSize,
    }),
    findById: async () => ({ ...builtinResource, favorited }),
    setFavorite: async (_userId, _resourceId, nextFavorite) => {
      favorited = nextFavorite
      return favorited
    },
  }
}

describe('knowledgeResourceService', () => {
  it('returns the immutable built-in folder with visible resources', async () => {
    const service = createKnowledgeResourceService({ repository: makeRepository() })

    const folders = await service.listFolders(7)
    const resources = await service.listResources({ userId: 7, page: 1, pageSize: 20 })

    expect(folders).toContainEqual(expect.objectContaining({ slug: 'builtin', isBuiltin: true }))
    expect(resources.items).toContainEqual(
      expect.objectContaining({ folderSlug: 'builtin', isBuiltin: true })
    )
  })

  it('persists a favorite only for a visible resource', async () => {
    const service = createKnowledgeResourceService({ repository: makeRepository() })

    await expect(service.setFavorite({ userId: 7, resourceId: 10, favorite: true })).resolves.toBe(
      true
    )
    await expect(service.getResource({ userId: 7, resourceId: 10 })).resolves.toMatchObject({
      favorited: true,
    })
  })

  it('returns a typed not-found error instead of fabricating a resource', async () => {
    const repository = makeRepository()
    repository.findById = async () => null
    const service = createKnowledgeResourceService({ repository })

    await expect(service.getResource({ userId: 7, resourceId: 999 })).rejects.toMatchObject<
      Partial<KnowledgeResourceServiceError>
    >({ code: 'NOT_FOUND', statusCode: 404 })
  })

  it('rejects built-in resource modification by non-admin roles', () => {
    const service = createKnowledgeResourceService({ repository: makeRepository() })

    expect(() => service.assertCanModifyResource('counselor', builtinResource)).toThrow(
      '内置资料仅允许系统管理员修改'
    )
    expect(() => service.assertCanModifyResource('admin', builtinResource)).not.toThrow()
  })
})
