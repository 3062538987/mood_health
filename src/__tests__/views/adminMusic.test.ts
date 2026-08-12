import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import Music from '@/views/admin/Music.vue'

const apiMocks = vi.hoisted(() => ({
  getAdminMusic: vi.fn(),
  updateAdminMusic: vi.fn(),
}))

const messageMocks = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
}))

vi.mock('@/api/admin', () => apiMocks)
vi.mock('element-plus', () => ({ ElMessage: messageMocks }))

describe('admin music management', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    apiMocks.getAdminMusic.mockResolvedValue([
      { id: 1, title: '旧标题', artist: '旧作者', updatedAt: '2026-01-01T00:00:00Z' },
    ])
    apiMocks.updateAdminMusic.mockResolvedValue({
      id: 1,
      title: '新标题',
      artist: '新作者',
    })
  })

  it('edits and saves the visible title and artist instead of sending an empty payload', async () => {
    const wrapper = mount(Music)
    await flushPromises()

    await wrapper.get('input[name="title-1"]').setValue('  新标题  ')
    await wrapper.get('input[name="artist-1"]').setValue('新作者')
    await wrapper.get('button.save-btn').trigger('click')
    await flushPromises()

    expect(apiMocks.updateAdminMusic).toHaveBeenCalledWith(1, {
      title: '新标题',
      artist: '新作者',
    })
    expect(messageMocks.success).toHaveBeenCalledWith('保存成功')
  })
})
