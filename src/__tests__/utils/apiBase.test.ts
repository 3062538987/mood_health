import { afterEach, describe, expect, it, vi } from 'vitest'

import { getApiBaseUrl } from '@/utils/apiBase'

describe('API base URL host safety', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('uses the same-origin proxy when a loopback API host differs from the page host', () => {
    vi.stubEnv('VITE_API_BASE_URL', 'http://127.0.0.1:3000')

    expect(getApiBaseUrl()).toBe('')
  })
})
