import { beforeEach, describe, expect, it, vi } from 'vitest'
import request from '@/utils/request'
import { deleteCurrentAccount } from '@/api/auth'

vi.mock('@/utils/request', () => ({
  default: vi.fn(),
}))

const requestMock = vi.mocked(request)

describe('auth API contract', () => {
  beforeEach(() => {
    requestMock.mockReset()
  })

  it('deletes the authenticated current account through /api/auth/me', async () => {
    requestMock.mockResolvedValueOnce(null)

    await expect(deleteCurrentAccount()).resolves.toBeNull()
    expect(requestMock).toHaveBeenCalledWith({
      url: '/api/auth/me',
      method: 'delete',
    })
  })
})
