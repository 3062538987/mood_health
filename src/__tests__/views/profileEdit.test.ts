import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import Profile from '@/views/user/Profile.vue'
import { useUserStore } from '@/stores/userStore'

const storeState = vi.hoisted(() => ({
  user: {
    id: 7,
    username: 'old_name',
    email: 'old@example.com',
    role: 'student',
    avatarUrl: null as string | null,
  },
  token: 'token',
  updateProfile: vi.fn(),
  fetchUserInfo: vi.fn(),
}))

vi.mock('@/stores/userStore', () => ({ useUserStore: vi.fn(() => storeState) }))
vi.mock('@/api/mood', () => ({ getMoodRecordList: vi.fn().mockResolvedValue({ list: [] }) }))
vi.mock('@/api/activityApi', () => ({ getMyJoinedActivities: vi.fn().mockResolvedValue([]) }))
vi.mock('vue-router', () => ({ useRouter: () => ({ push: vi.fn() }) }))

describe('Profile editing', () => {
  beforeEach(() => {
    vi.mocked(useUserStore).mockClear()
    storeState.updateProfile.mockReset().mockImplementation(async (username, avatarUrl) => {
      storeState.user.username = username
      storeState.user.avatarUrl = avatarUrl
      return true
    })
  })

  it('persists a customized username and avatar and renders the saved result', async () => {
    const wrapper = mount(Profile)
    await flushPromises()

    await wrapper.get('[data-test="edit-profile"]').trigger('click')
    await wrapper.get('[data-test="profile-username"]').setValue('new_name')
    await wrapper.get('[data-test="profile-avatar"]').setValue('https://images.example.com/avatar.png')
    await wrapper.get('[data-test="profile-form"]').trigger('submit')
    await flushPromises()

    expect(storeState.updateProfile).toHaveBeenCalledWith(
      'new_name',
      'https://images.example.com/avatar.png'
    )
    expect(wrapper.get('.username').text()).toBe('new_name')
    expect(wrapper.get('[data-test="profile-avatar-image"]').attributes('src')).toBe(
      'https://images.example.com/avatar.png'
    )
  })
})
