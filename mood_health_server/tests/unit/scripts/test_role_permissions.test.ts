export {}

const writeFileMock = jest.fn().mockResolvedValue(undefined)
const mkdirMock = jest.fn().mockResolvedValue(undefined)

jest.mock('fs/promises', () => ({
  __esModule: true,
  default: {
    mkdir: mkdirMock,
    writeFile: writeFileMock,
  },
}))

type RoleSmokeModule = {
  createRoleSmokeHttpClient: (
    baseUrl: string,
    timeoutValue?: string
  ) => {
    request: (
      method: string,
      candidatePath: string,
      config?: {
        headers?: Record<string, string>
        params?: Record<string, unknown>
        data?: unknown
      }
    ) => Promise<{ status: number; data: unknown }>
    requestWithFallback: (
      method: string,
      candidatePaths: string[],
      config?: {
        headers?: Record<string, string>
        params?: Record<string, unknown>
        data?: unknown
      }
    ) => Promise<{ response: { status: number; data: unknown }; usedPath: string }>
  }
}

const loadModule = (): RoleSmokeModule =>
  require('../../../src/scripts/test_role_permissions') as RoleSmokeModule

const fetchMock = jest.fn() as jest.MockedFunction<typeof fetch>

describe('role-permission smoke HTTP boundary', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.useRealTimers()
    global.fetch = fetchMock
  })

  afterAll(() => {
    jest.restoreAllMocks()
  })

  test('importing the script performs no HTTP request or report write', async () => {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined)

    jest.resetModules()
    jest.isolateModules(() => {
      loadModule()
    })
    await new Promise<void>((resolve) => setImmediate(resolve))
    await new Promise<void>((resolve) => setImmediate(resolve))

    expect(fetchMock).not.toHaveBeenCalled()
    expect(writeFileMock).not.toHaveBeenCalled()
    expect(process.exitCode).toBeUndefined()
    consoleSpy.mockRestore()
  })

  test('serializes method, authorization, JSON body and finite query primitives', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ code: 0 }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    )
    const { createRoleSmokeHttpClient } = loadModule()
    const client = createRoleSmokeHttpClient('http://localhost:3000')

    const response = await client.request('POST', '/api/items', {
      headers: { Authorization: 'Bearer test-token' },
      params: { page: 2, active: true, q: 'hello world', skipped: null },
      data: { title: 'safe' },
    })

    expect(response).toEqual({ status: 200, data: { code: 0 } })
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3000/api/items?page=2&active=true&q=hello+world',
      expect.objectContaining({
        method: 'POST',
        redirect: 'error',
        headers: {
          Authorization: 'Bearer test-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ title: 'safe' }),
      })
    )
  })

  test('falls back only when the first candidate returns exactly 404', async () => {
    fetchMock
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ code: 404 }), {
          status: 404,
          headers: { 'content-type': 'application/json' },
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ code: 0 }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      )
    const client = loadModule().createRoleSmokeHttpClient('http://localhost:3000')

    const result = await client.requestWithFallback('GET', ['/api/first', '/api/second'])

    expect(result).toEqual({ response: { status: 200, data: { code: 0 } }, usedPath: '/api/second' })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  test('returns a 403 immediately without trying the fallback candidate', async () => {
    fetchMock.mockResolvedValueOnce(new Response('forbidden', { status: 403 }))
    const client = loadModule().createRoleSmokeHttpClient('http://localhost:3000')

    const result = await client.requestWithFallback('GET', ['/api/first', '/api/second'])

    expect(result).toEqual({ response: { status: 403, data: 'forbidden' }, usedPath: '/api/first' })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  test('returns other non-2xx responses instead of rejecting them', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'unavailable' }), {
        status: 503,
        headers: { 'content-type': 'application/json' },
      })
    )
    const client = loadModule().createRoleSmokeHttpClient('http://localhost:3000')

    await expect(client.request('GET', '/api/status')).resolves.toEqual({
      status: 503,
      data: { error: 'unavailable' },
    })
  })

  test('normalizes empty and non-JSON response bodies deterministically', async () => {
    fetchMock
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(new Response('plain response', { status: 200 }))
    const client = loadModule().createRoleSmokeHttpClient('http://localhost:3000')

    await expect(client.request('GET', '/api/empty')).resolves.toEqual({ status: 204, data: null })
    await expect(client.request('GET', '/api/text')).resolves.toEqual({
      status: 200,
      data: 'plain response',
    })
  })

  test('enforces redirect error policy and same-origin root-relative paths', async () => {
    fetchMock.mockResolvedValueOnce(new Response('{}', { status: 200 }))
    const { createRoleSmokeHttpClient } = loadModule()
    const client = createRoleSmokeHttpClient('https://api.example.test/base')

    await client.request('GET', '/api/status')
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.example.test/api/status',
      expect.objectContaining({ redirect: 'error' })
    )
    await expect(client.request('GET', '//evil.example/status')).rejects.toThrow(
      'Invalid role smoke request configuration'
    )
    expect(() => createRoleSmokeHttpClient('ftp://api.example.test')).toThrow(
      'Invalid role smoke request configuration'
    )
    expect(() => createRoleSmokeHttpClient('https://user:secret@api.example.test')).toThrow(
      'Invalid role smoke request configuration'
    )
  })

  test('rejects unsafe query objects instead of serializing object strings', async () => {
    const client = loadModule().createRoleSmokeHttpClient('http://localhost:3000')

    await expect(
      client.request('GET', '/api/items', { params: { filter: { role: 'admin' } } })
    ).rejects.toThrow('Invalid role smoke request configuration')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  test('aborts requests after the configured finite timeout', async () => {
    jest.useFakeTimers()
    fetchMock.mockImplementationOnce(
      (_input, init) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new Error('aborted')))
        })
    )
    const client = loadModule().createRoleSmokeHttpClient('http://localhost:3000', '5')

    const pending = client.request('GET', '/api/slow')
    const rejection = expect(pending).rejects.toThrow('Role smoke request timed out')
    await jest.advanceTimersByTimeAsync(5)

    await rejection
  })

  test('keeps the timeout active while a response body read is stuck', async () => {
    jest.useFakeTimers()
    const cancelMock = jest.fn(() => {
      throw new Error('private cancellation failure')
    })
    const stream = new ReadableStream<Uint8Array>({
      pull: () => new Promise<void>(() => undefined),
      cancel: cancelMock,
    })
    fetchMock.mockResolvedValueOnce(new Response(stream, { status: 200 }))
    const client = loadModule().createRoleSmokeHttpClient('http://localhost:3000', '5')
    let rejection: unknown

    void client.request('GET', '/api/slow-body').catch((error: unknown) => {
      rejection = error
    })
    await Promise.resolve()
    await jest.advanceTimersByTimeAsync(5)
    await Promise.resolve()

    expect((rejection as Error | undefined)?.message).toBe('Role smoke request timed out')
    expect(cancelMock).toHaveBeenCalledTimes(1)
  })

  test('rejects responses larger than one MiB without exposing their body', async () => {
    const oversizedBody = `private-${'x'.repeat(1024 * 1024)}`
    fetchMock.mockResolvedValueOnce(new Response(oversizedBody, { status: 200 }))
    const client = loadModule().createRoleSmokeHttpClient('http://localhost:3000')

    const pending = client.request('GET', '/api/large')
    await expect(pending).rejects.toThrow(
      'Role smoke response exceeds 1 MiB'
    )
    await expect(pending).rejects.not.toThrow('private-')
  })

  test('keeps the static oversize error when cancelling the response stream fails', async () => {
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(1024 * 1024 + 1))
      },
      cancel() {
        throw new Error('private cancellation failure')
      },
    })
    fetchMock.mockResolvedValueOnce(new Response(stream, { status: 200 }))
    const client = loadModule().createRoleSmokeHttpClient('http://localhost:3000')

    await expect(client.request('GET', '/api/large')).rejects.toThrow(
      'Role smoke response exceeds 1 MiB'
    )
  })

  test('cancels a declared oversized response even when stream cancellation fails', async () => {
    const cancelMock = jest.fn(() => {
      throw new Error('private cancellation failure')
    })
    const stream = new ReadableStream<Uint8Array>({ cancel: cancelMock })
    fetchMock.mockResolvedValueOnce(
      new Response(stream, {
        status: 200,
        headers: { 'content-length': String(1024 * 1024 + 1) },
      })
    )
    const client = loadModule().createRoleSmokeHttpClient('http://localhost:3000')

    await expect(client.request('GET', '/api/large')).rejects.toThrow(
      'Role smoke response exceeds 1 MiB'
    )
    expect(cancelMock).toHaveBeenCalledTimes(1)
  })

  test('rejects invalid timeout values and empty fallback candidate lists', async () => {
    const { createRoleSmokeHttpClient } = loadModule()

    expect(() => createRoleSmokeHttpClient('http://localhost:3000', '0')).toThrow(
      'Invalid role smoke request configuration'
    )
    expect(() => createRoleSmokeHttpClient('http://localhost:3000', 'not-a-number')).toThrow(
      'Invalid role smoke request configuration'
    )
    const client = createRoleSmokeHttpClient('http://localhost:3000')
    await expect(client.requestWithFallback('GET', [])).rejects.toThrow(
      'Invalid role smoke request configuration'
    )
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
