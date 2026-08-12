import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AdminKnowledgeResources from '@/views/admin/KnowledgeResources.vue'
import { getKnowledgeFolders, getKnowledgeResources } from '@/api/knowledgeResources'

vi.mock('@/api/knowledgeResources', () => ({
  getKnowledgeFolders: vi.fn(),
  getKnowledgeResources: vi.fn(),
  uploadKnowledgeResource: vi.fn(),
}))

const foldersMock = vi.mocked(getKnowledgeFolders)
const resourcesMock = vi.mocked(getKnowledgeResources)

describe('Admin knowledge resources', () => {
  beforeEach(() => {
    foldersMock.mockReset().mockResolvedValue([
      {
        id: 1,
        slug: 'builtin',
        name: '内置资料',
        description: '平台审核资料',
        isBuiltin: true,
        ownerUserId: null,
        createdAt: '2026-08-13',
        updatedAt: '2026-08-13',
      },
    ])
    resourcesMock.mockReset().mockResolvedValue({
      items: [
        {
          id: 10,
          folderId: 1,
          folderSlug: 'builtin',
          title: 'WHO 压力管理指南',
          summary: '权威资料',
          resourceType: 'document',
          sourceUrl: 'https://www.who.int/example',
          downloadUrl: null,
          licenseCode: 'CC-BY-NC-SA',
          isBuiltin: true,
          ingestionStatus: 'ready',
          reviewedAt: '2026-08-13',
          favorited: false,
          createdAt: '2026-08-13',
          updatedAt: '2026-08-13',
        },
      ],
      total: 1,
      page: 1,
      pageSize: 100,
    })
  })

  it('renders uploaded/built-in resources and provides the real upload form', async () => {
    const wrapper = mount(AdminKnowledgeResources)
    await flushPromises()

    expect(wrapper.text()).toContain('资料管理')
    expect(wrapper.text()).toContain('内置资料')
    expect(wrapper.text()).toContain('WHO 压力管理指南')
    expect(wrapper.findComponent({ name: 'KnowledgeUploadForm' }).exists()).toBe(true)
  })
})
