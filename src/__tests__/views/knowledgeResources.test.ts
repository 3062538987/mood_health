import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import Knowledge from '@/views/improve/Knowledge.vue'
import {
  getKnowledgeFolders,
  getKnowledgeResources,
  setKnowledgeResourceFavorite,
} from '@/api/knowledgeResources'

vi.mock('@/api/knowledgeResources', () => ({
  getKnowledgeFolders: vi.fn(),
  getKnowledgeResources: vi.fn(),
  setKnowledgeResourceFavorite: vi.fn(),
}))

const getFoldersMock = vi.mocked(getKnowledgeFolders)
const getResourcesMock = vi.mocked(getKnowledgeResources)
const setFavoriteMock = vi.mocked(setKnowledgeResourceFavorite)

const builtinResource = {
  id: 10,
  folderId: 1,
  folderSlug: 'builtin',
  title: '压力时期的重要行动',
  summary: '世界卫生组织压力管理指南',
  resourceType: 'document' as const,
  sourceUrl: 'https://www.who.int/publications/b/53604',
  downloadUrl: null,
  licenseCode: 'CC-BY-NC-SA-3.0-IGO',
  isBuiltin: true,
  ingestionStatus: 'ready' as const,
  reviewedAt: '2026-08-13',
  favorited: false,
  createdAt: '2026-08-13T00:00:00.000Z',
  updatedAt: '2026-08-13T00:00:00.000Z',
}

describe('Knowledge resources page', () => {
  beforeEach(() => {
    getFoldersMock.mockReset().mockResolvedValue([
      {
        id: 1,
        slug: 'builtin',
        name: '内置资料',
        description: '平台审核的权威资料',
        isBuiltin: true,
        ownerUserId: null,
        createdAt: '2026-08-13T00:00:00.000Z',
        updatedAt: '2026-08-13T00:00:00.000Z',
      },
    ])
    getResourcesMock.mockReset().mockResolvedValue({
      items: [builtinResource],
      total: 1,
      page: 1,
      pageSize: 20,
    })
    setFavoriteMock.mockReset().mockResolvedValue({ favorite: true })
  })

  it('renders the built-in folder and traceable official resources from the API', async () => {
    const wrapper = mount(Knowledge)
    await flushPromises()

    expect(wrapper.text()).toContain('内置资料')
    expect(wrapper.text()).toContain('压力时期的重要行动')
    expect(wrapper.text()).toContain('世界卫生组织压力管理指南')
    expect(wrapper.get('[data-test="resource-source"]').attributes('href')).toBe(
      'https://www.who.int/publications/b/53604'
    )
    expect(wrapper.text()).not.toContain('video-url-001')
  })

  it('persists favorites through the API and updates the card state', async () => {
    const wrapper = mount(Knowledge)
    await flushPromises()

    await wrapper.get('[data-test="favorite-10"]').trigger('click')
    await flushPromises()

    expect(setFavoriteMock).toHaveBeenCalledWith(10, true)
    expect(wrapper.get('[data-test="favorite-10"]').attributes('aria-pressed')).toBe('true')
  })

  it('shows an explicit retry state when the resource list fails', async () => {
    getResourcesMock.mockRejectedValueOnce(new Error('请求的资源不存在'))
    const wrapper = mount(Knowledge)
    await flushPromises()

    expect(wrapper.get('[role="alert"]').text()).toContain('资源列表加载失败')
    expect(wrapper.find('[data-test="retry-resources"]').exists()).toBe(true)

    await wrapper.get('[data-test="retry-resources"]').trigger('click')
    await flushPromises()
    expect(getResourcesMock).toHaveBeenCalledTimes(2)
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
  })
})
