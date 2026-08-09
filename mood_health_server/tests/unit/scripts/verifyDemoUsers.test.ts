export {}

type DemoUserRole = 'super_admin' | 'admin' | 'user'

type DemoUserScriptModule = {
  createDemoUserLoginClient: (
    baseUrl: string,
    timeoutValue?: string
  ) => {
    login: (username: string, password: string) => Promise<DemoUserRole>
  }
  runPermissionChecks: () => { ok: boolean; logs: string[] }
}

const fetchMock = jest.fn() as jest.MockedFunction<typeof fetch>

const loadModule = (): DemoUserScriptModule =>
  require('../../../src/scripts/verifyDemoUsers') as DemoUserScriptModule

const loginResponse = (role: DemoUserRole): Response =>
  new Response(JSON.stringify({ code: 0, data: { user: { role } } }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })

describe('demo-user verification script', () => {
  const originalExitCode = process.exitCode

  beforeEach(() => {
    jest.clearAllMocks()
    fetchMock.mockRejectedValue(new Error('offline'))
    jest.useRealTimers()
    global.fetch = fetchMock
    process.exitCode = undefined
  })

  afterAll(() => {
    process.exitCode = originalExitCode
    jest.restoreAllMocks()
  })

  test('importing the script performs no HTTP request or exit-state change', async () => {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined)

    loadModule()
    await new Promise<void>((resolve) => setImmediate(resolve))
    await new Promise<void>((resolve) => setImmediate(resolve))

    expect(fetchMock).not.toHaveBeenCalled()
    expect(process.exitCode).toBeUndefined()
    consoleSpy.mockRestore()
  })

  test('posts credentials to the fixed same-origin login path with redirects disabled', async () => {
    fetchMock.mockResolvedValueOnce(loginResponse('admin'))
    const client = loadModule().createDemoUserLoginClient('https://api.example.test/base/path')

    await expect(client.login('admin_test1', 'test-password')).resolves.toBe('admin')

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.example.test/api/auth/login',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'admin_test1', password: 'test-password' }),
        redirect: 'error',
        signal: expect.any(AbortSignal),
      })
    )
  })

  test('rejects non-success HTTP responses without exposing their body', async () => {
    fetchMock.mockResolvedValueOnce(new Response('private-response-body', { status: 503 }))
    const client = loadModule().createDemoUserLoginClient('http://localhost:3000')

    const pending = client.login('student_test1', 'private-password')

    await expect(pending).rejects.toThrow('Demo user login request was rejected')
    await expect(pending).rejects.not.toThrow('private-response-body')
    await expect(pending).rejects.not.toThrow('private-password')
  })

  test('rejects non-zero business codes with a static safe error', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ code: 401, message: 'private-business-detail' }), { status: 200 })
    )
    const client = loadModule().createDemoUserLoginClient('http://localhost:3000')

    const pending = client.login('student_test1', 'private-password')

    await expect(pending).rejects.toThrow('Demo user login was rejected')
    await expect(pending).rejects.not.toThrow('private-business-detail')
  })

  test.each([undefined, 'operator', ''])('rejects missing or unknown roles: %p', async (role) => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ code: 0, data: { user: { role } } }), { status: 200 })
    )
    const client = loadModule().createDemoUserLoginClient('http://localhost:3000')

    await expect(client.login('student_test1', 'private-password')).rejects.toThrow(
      'Demo user login returned an invalid role'
    )
  })

  test('rejects invalid JSON with a static safe error', async () => {
    fetchMock.mockResolvedValueOnce(new Response('private-not-json', { status: 200 }))
    const client = loadModule().createDemoUserLoginClient('http://localhost:3000')

    const pending = client.login('student_test1', 'private-password')

    await expect(pending).rejects.toThrow('Demo user login response is invalid')
    await expect(pending).rejects.not.toThrow('private-not-json')
  })

  test('aborts a request after the configured finite timeout', async () => {
    jest.useFakeTimers()
    fetchMock.mockImplementationOnce(
      (_input, init) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new Error('private-network-detail')))
        })
    )
    const client = loadModule().createDemoUserLoginClient('http://localhost:3000', '5')

    const pending = client.login('student_test1', 'private-password')
    const rejection = expect(pending).rejects.toThrow('Demo user login request timed out')
    await jest.advanceTimersByTimeAsync(5)

    await rejection
  })

  test('rejects a streamed response larger than one MiB without exposing its body', async () => {
    const privateBody = `private-${'x'.repeat(1024 * 1024)}`
    fetchMock.mockResolvedValueOnce(new Response(privateBody, { status: 200 }))
    const client = loadModule().createDemoUserLoginClient('http://localhost:3000')

    const pending = client.login('student_test1', 'private-password')

    await expect(pending).rejects.toThrow('Demo user login response exceeds 1 MiB')
    await expect(pending).rejects.not.toThrow('private-')
  })

  test.each([
    ['ftp://api.example.test', undefined],
    ['https://user:secret@api.example.test', undefined],
    ['http://localhost:3000', '0'],
    ['http://localhost:3000', 'not-a-number'],
    ['http://localhost:3000', 'Infinity'],
  ])('rejects invalid URL or timeout configuration', (baseUrl, timeoutValue) => {
    expect(() => loadModule().createDemoUserLoginClient(baseUrl, timeoutValue)).toThrow(
      'Invalid demo user verification configuration'
    )
    expect(fetchMock).not.toHaveBeenCalled()
  })

  test('caps configured timeouts at thirty seconds', async () => {
    jest.useFakeTimers()
    let requestSignal: AbortSignal | null = null
    fetchMock.mockImplementationOnce(
      (_input, init) =>
        new Promise<Response>((_resolve, reject) => {
          requestSignal = init?.signal ?? null
          requestSignal?.addEventListener('abort', () => reject(new Error('aborted')))
        })
    )
    const client = loadModule().createDemoUserLoginClient('http://localhost:3000', '60000')

    const pending = client.login('student_test1', 'private-password')
    const rejection = expect(pending).rejects.toThrow('Demo user login request timed out')
    await jest.advanceTimersByTimeAsync(29999)
    expect(requestSignal).not.toBeNull()
    expect((requestSignal as unknown as AbortSignal).aborted).toBe(false)
    await jest.advanceTimersByTimeAsync(1)

    await rejection
  })

  test('converts raw network failures to a static safe error', async () => {
    fetchMock.mockRejectedValueOnce(new Error('private-network-detail'))
    const client = loadModule().createDemoUserLoginClient('http://localhost:3000')

    const pending = client.login('student_test1', 'private-password')

    await expect(pending).rejects.toThrow('Demo user login request failed')
    await expect(pending).rejects.not.toThrow('private-network-detail')
  })

  test('keeps the super-admin grants and admin denial boundaries enforced', () => {
    expect(loadModule().runPermissionChecks()).toEqual({
      ok: false,
      logs: ['admin 不应拥有权限: user.manage'],
    })
  })
})
