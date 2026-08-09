import fs from 'fs/promises'
import path from 'path'

export type SmokeHttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

interface SmokeRequestConfig {
  headers?: Record<string, string>
  params?: Record<string, unknown>
  data?: unknown
}

interface SmokeResponse {
  status: number
  data: any
}

interface RoleSmokeHttpClient {
  request: (
    method: SmokeHttpMethod,
    candidatePath: string,
    config?: SmokeRequestConfig
  ) => Promise<SmokeResponse>
  requestWithFallback: (
    method: SmokeHttpMethod,
    candidatePaths: string[],
    config?: SmokeRequestConfig
  ) => Promise<{ response: SmokeResponse; usedPath: string }>
}

type RoleName = 'super_admin' | 'admin' | 'user'

interface ScenarioResult {
  scenario: string
  expected: string
  actual: string
  passed: boolean
}

interface LoginData {
  token: string
  role: RoleName | string
  userId: number
}

const BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000'
const PASSWORD = process.argv[2] || process.env.DEMO_USER_PASSWORD || '123456'
const REPORT_PATH = path.resolve(process.cwd(), 'logs', 'test_role_permissions_report.md')
const DEFAULT_TIMEOUT_MS = 10_000
const MAX_TIMEOUT_MS = 30_000
const MAX_RESPONSE_BYTES = 1024 * 1024
const CONFIG_ERROR = 'Invalid role smoke request configuration'
const NETWORK_ERROR = 'Role smoke request failed'
const TIMEOUT_ERROR = 'Role smoke request timed out'
const OVERSIZE_ERROR = 'Role smoke response exceeds 1 MiB'

const ACCOUNTS = {
  superAdmin: 'super_admin_test1',
  admin: 'admin_test1',
  user: 'student_test1',
}

const operationHeaders = (token: string) => ({
  Authorization: `Bearer ${token}`,
  'Content-Type': 'application/json',
})

const log = (message: string) => {
  console.log(`[ROLE_SMOKE] ${message}`)
}

const configurationError = () => new Error(CONFIG_ERROR)

const parseTimeout = (value?: string): number => {
  if (value === undefined || value.trim() === '') {
    return DEFAULT_TIMEOUT_MS
  }

  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw configurationError()
  }
  return Math.min(parsed, MAX_TIMEOUT_MS)
}

const parseBaseOrigin = (baseUrl: string): URL => {
  let parsed: URL
  try {
    parsed = new URL(baseUrl)
  } catch {
    throw configurationError()
  }

  if (
    (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') ||
    parsed.username !== '' ||
    parsed.password !== ''
  ) {
    throw configurationError()
  }
  return new URL(parsed.origin)
}

const buildRequestUrl = (
  baseOrigin: URL,
  candidatePath: string,
  params?: Record<string, unknown>
): URL => {
  if (!candidatePath.startsWith('/') || candidatePath.startsWith('//')) {
    throw configurationError()
  }

  const requestUrl = new URL(candidatePath, baseOrigin)
  if (requestUrl.origin !== baseOrigin.origin) {
    throw configurationError()
  }

  const search = new URLSearchParams(requestUrl.search)
  for (const [key, value] of Object.entries(params ?? {})) {
    if (value === null || value === undefined) {
      continue
    }

    if (typeof value === 'number') {
      if (!Number.isFinite(value)) {
        throw configurationError()
      }
      search.set(key, String(value))
      continue
    }

    if (typeof value === 'string' || typeof value === 'boolean') {
      search.set(key, String(value))
      continue
    }
    throw configurationError()
  }
  requestUrl.search = search.toString()
  return requestUrl
}

const readChunkWithAbort = (
  reader: ReadableStreamDefaultReader<Uint8Array>,
  signal: AbortSignal
): Promise<ReadableStreamReadResult<Uint8Array>> =>
  new Promise((resolve, reject) => {
    const onAbort = () => {
      void reader.cancel().catch(() => undefined)
      reject(new Error(TIMEOUT_ERROR))
    }

    if (signal.aborted) {
      onAbort()
      return
    }

    signal.addEventListener('abort', onAbort, { once: true })
    void reader.read().then(resolve, reject).finally(() => {
      signal.removeEventListener('abort', onAbort)
    })
  })

const readResponseData = async (response: Response, signal: AbortSignal): Promise<any> => {
  const declaredLength = Number(response.headers.get('content-length'))
  if (Number.isFinite(declaredLength) && declaredLength > MAX_RESPONSE_BYTES) {
    if (response.body) {
      void response.body.cancel().catch(() => undefined)
    }
    throw new Error(OVERSIZE_ERROR)
  }

  if (!response.body) {
    return null
  }

  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let receivedBytes = 0

  try {
    while (true) {
      const { done, value } = await readChunkWithAbort(reader, signal)
      if (done) {
        break
      }

      receivedBytes += value.byteLength
      if (receivedBytes > MAX_RESPONSE_BYTES) {
        void reader.cancel().catch(() => undefined)
        throw new Error(OVERSIZE_ERROR)
      }
      chunks.push(value)
    }
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message === OVERSIZE_ERROR || error.message === TIMEOUT_ERROR)
    ) {
      throw error
    }
    throw new Error(NETWORK_ERROR)
  }

  if (receivedBytes === 0) {
    return null
  }

  const bytes = new Uint8Array(receivedBytes)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  const text = new TextDecoder().decode(bytes)
  if (text === '') {
    return null
  }

  if (response.headers.get('content-type')?.toLowerCase().includes('json')) {
    try {
      return JSON.parse(text)
    } catch {
      return text
    }
  }
  return text
}

export const createRoleSmokeHttpClient = (
  baseUrl: string,
  timeoutValue?: string
): RoleSmokeHttpClient => {
  const baseOrigin = parseBaseOrigin(baseUrl)
  const timeoutMs = parseTimeout(timeoutValue)

  const request = async (
    method: SmokeHttpMethod,
    candidatePath: string,
    config: SmokeRequestConfig = {}
  ): Promise<SmokeResponse> => {
    const requestUrl = buildRequestUrl(baseOrigin, candidatePath, config.params)
    const headers = { ...(config.headers ?? {}) }
    let body: string | undefined

    if (config.data !== undefined) {
      try {
        body = JSON.stringify(config.data)
      } catch {
        throw configurationError()
      }
      if (body === undefined) {
        throw configurationError()
      }
      if (!Object.keys(headers).some((key) => key.toLowerCase() === 'content-type')) {
        headers['Content-Type'] = 'application/json'
      }
    }

    const controller = new AbortController()
    let timedOut = false
    const timeout = setTimeout(() => {
      timedOut = true
      controller.abort()
    }, timeoutMs)

    try {
      const response = await fetch(requestUrl.toString(), {
        method,
        headers,
        body,
        redirect: 'error',
        signal: controller.signal,
      })
      return {
        status: response.status,
        data: await readResponseData(response, controller.signal),
      }
    } catch (error) {
      if (timedOut || (error instanceof Error && error.message === TIMEOUT_ERROR)) {
        throw new Error(TIMEOUT_ERROR)
      }
      if (error instanceof Error && error.message === OVERSIZE_ERROR) {
        throw error
      }
      throw new Error(NETWORK_ERROR)
    } finally {
      clearTimeout(timeout)
    }
  }

  const requestWithFallback = async (
    method: SmokeHttpMethod,
    candidatePaths: string[],
    config: SmokeRequestConfig = {}
  ): Promise<{ response: SmokeResponse; usedPath: string }> => {
    if (candidatePaths.length === 0) {
      throw configurationError()
    }

    let lastResponse: SmokeResponse | null = null
    for (const candidatePath of candidatePaths) {
      const response = await request(method, candidatePath, config)
      if (response.status !== 404) {
        return { response, usedPath: candidatePath }
      }
      lastResponse = response
    }

    if (lastResponse === null) {
      throw configurationError()
    }
    return {
      response: lastResponse,
      usedPath: candidatePaths[candidatePaths.length - 1],
    }
  }

  return { request, requestWithFallback }
}

let liveHttpClient: RoleSmokeHttpClient | undefined
const getHttpClient = () => {
  liveHttpClient ??= createRoleSmokeHttpClient(BASE_URL, process.env.ROLE_SMOKE_TIMEOUT_MS)
  return liveHttpClient
}

const requestWithFallback = (
  method: SmokeHttpMethod,
  candidatePaths: string[],
  config: SmokeRequestConfig = {}
) => getHttpClient().requestWithFallback(method, candidatePaths, config)

const login = async (username: string): Promise<LoginData> => {
  const response = await getHttpClient().request('POST', '/api/auth/login', {
    data: { username, password: PASSWORD },
  })

  if (response.status !== 200 || response.data?.code !== 0 || !response.data?.data?.token) {
    throw new Error(
      `登录失败 username=${username}, status=${response.status}, body=${JSON.stringify(response.data)}`
    )
  }

  return {
    token: response.data.data.token,
    role: response.data.data.user?.role,
    userId: response.data.data.user?.id,
  }
}

const findFirstId = (value: unknown): number | null => {
  if (value === null || value === undefined) {
    return null
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findFirstId(item)
      if (found !== null) {
        return found
      }
    }
    return null
  }

  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>
    if (typeof obj.id === 'number') {
      return obj.id
    }

    for (const child of Object.values(obj)) {
      const found = findFirstId(child)
      if (found !== null) {
        return found
      }
    }
  }
  return null
}

const fetchAuditLogs = async (token: string, params: Record<string, unknown> = {}) => {
  const { response, usedPath } = await requestWithFallback(
    'GET',
    ['/api/audit/operation-logs'],
    {
      headers: operationHeaders(token),
      params: { page: 1, pageSize: 50, ...params },
    }
  )
  return { response, usedPath }
}

const generateReport = async (results: ScenarioResult[]) => {
  const passedCount = results.filter((result) => result.passed).length
  const totalCount = results.length
  const reportLines = [
    '# 角色权限冒烟测试报告',
    '',
    `- 生成时间: ${new Date().toISOString()}`,
    `- 后端地址: ${BASE_URL}`,
    `- 总场景: ${totalCount}`,
    `- 通过场景: ${passedCount}`,
    `- 失败场景: ${totalCount - passedCount}`,
    '',
    '| 测试场景 | 预期结果 | 实际结果 | 是否通过 |',
    '|---|---|---|---|',
  ]

  results.forEach((result) => {
    reportLines.push(
      `| ${result.scenario} | ${result.expected} | ${result.actual.replace(/\|/g, '\\|')} | ${result.passed ? '通过' : '失败'} |`
    )
  })

  await fs.mkdir(path.dirname(REPORT_PATH), { recursive: true })
  await fs.writeFile(REPORT_PATH, reportLines.join('\n'), 'utf8')
  return REPORT_PATH
}

const main = async () => {
  const results: ScenarioResult[] = []

  try {
    log('开始登录测试账号')
    const superAdmin = await login(ACCOUNTS.superAdmin)
    const admin = await login(ACCOUNTS.admin)
    const user = await login(ACCOUNTS.user)

    log(`登录完成: super_admin=${superAdmin.role}, admin=${admin.role}, user=${user.role}`)

    {
      const { response, usedPath } = await requestWithFallback(
        'POST',
        ['/api/roles', '/api/roles/manage'],
        {
          headers: operationHeaders(admin.token),
          data: { targetUserId: user.userId || 1, targetRole: 'admin' },
        }
      )
      results.push({
        scenario: '场景1：admin 访问 /api/roles（role.manage）',
        expected: '403 错误',
        actual: `status=${response.status}, path=${usedPath}`,
        passed: response.status === 403,
      })
    }

    {
      const { response, usedPath } = await requestWithFallback(
        'POST',
        ['/api/users/update-role', '/api/users/manage'],
        {
          headers: operationHeaders(superAdmin.token),
          data: { targetUserId: admin.userId || 1, action: 'smoke_update_role' },
        }
      )

      let logRecorded = false
      if (response.status >= 200 && response.status < 300) {
        const { response: auditResponse } = await fetchAuditLogs(superAdmin.token, {
          permission: 'user.manage',
          role: 'super_admin',
        })
        const list = auditResponse.data?.data?.list || []
        logRecorded =
          Array.isArray(list) && list.some((item) => item.permission_code === 'user.manage')
      }
      results.push({
        scenario: '场景2：super_admin 调用 /api/users/update-role（user.manage）',
        expected: '操作成功并记录日志',
        actual: `status=${response.status}, path=${usedPath}, logRecorded=${logRecorded}`,
        passed: response.status >= 200 && response.status < 300 && logRecorded,
      })
    }

    {
      const pendingResponse = await getHttpClient().request('GET', '/api/posts/admin/pending', {
        headers: operationHeaders(admin.token),
      })
      const pendingId = findFirstId(pendingResponse.data?.data)
      let auditStatus = 0
      let usedPath = ''
      let logRecorded = false

      if (pendingResponse.status === 200 && pendingId !== null) {
        const auditResponse = await requestWithFallback(
          'POST',
          [`/api/posts/audit/${pendingId}`, `/api/posts/admin/audit/${pendingId}`],
          {
            headers: operationHeaders(admin.token),
            data: { status: 1, audit_remark: 'smoke test audit' },
          }
        )
        auditStatus = auditResponse.response.status
        usedPath = auditResponse.usedPath

        if (auditStatus >= 200 && auditStatus < 300) {
          const { response: auditLogsResponse } = await fetchAuditLogs(superAdmin.token, {
            permission: 'post.audit',
          })
          const list = auditLogsResponse.data?.data?.list || []
          logRecorded =
            Array.isArray(list) && list.some((item) => item.permission_code === 'post.audit')
        }
      }

      results.push({
        scenario: '场景3：admin 调用 /api/posts/audit（post.audit）',
        expected: '操作成功并记录审核日志',
        actual: `pendingStatus=${pendingResponse.status}, pendingId=${pendingId}, auditStatus=${auditStatus}, path=${usedPath || '-'}, logRecorded=${logRecorded}`,
        passed:
          pendingResponse.status === 200 &&
          pendingId !== null &&
          auditStatus >= 200 &&
          auditStatus < 300 &&
          logRecorded,
      })
    }

    {
      const listResponse = await getHttpClient().request('GET', '/api/activities/list')
      const activityId = findFirstId(listResponse.data?.data) || 1
      const { response, usedPath } = await requestWithFallback(
        'DELETE',
        [`/api/activities/delete/${activityId}`, '/api/activities/delete'],
        { headers: operationHeaders(user.token) }
      )
      results.push({
        scenario: '场景4：user 访问 /api/activities/delete（activity.manage）',
        expected: '403 错误',
        actual: `status=${response.status}, path=${usedPath}, activityId=${activityId}`,
        passed: response.status === 403,
      })
    }

    {
      const superResponse = await fetchAuditLogs(superAdmin.token)
      const adminResponse = await fetchAuditLogs(admin.token)
      const superHasData =
        superResponse.response.status === 200 &&
        Array.isArray(superResponse.response.data?.data?.list)
      const adminDenied = adminResponse.response.status === 403
      results.push({
        scenario: '场景5：super_admin 查看 /api/audit/operation-logs，admin 访问同接口',
        expected: 'super_admin 返回数据，admin 返回 403',
        actual: `superStatus=${superResponse.response.status}, superPath=${superResponse.usedPath}, adminStatus=${adminResponse.response.status}, adminPath=${adminResponse.usedPath}`,
        passed: superHasData && adminDenied,
      })
    }

    {
      const { response, usedPath } = await requestWithFallback('PUT', ['/api/music/1'], {
        headers: operationHeaders(admin.token),
        data: { title: `Smoke Music ${Date.now()}` },
      })
      results.push({
        scenario: '场景6：admin 调用 PUT /api/music/1（music.manage）',
        expected: '非 403（拥有 music.manage 权限）',
        actual: `status=${response.status}, path=${usedPath}`,
        passed: response.status !== 403,
      })
    }
  } catch (error: unknown) {
    results.push({
      scenario: '脚本执行异常',
      expected: '脚本完整执行',
      actual: (error as Error)?.message || '未知错误',
      passed: false,
    })
  }

  const reportPath = await generateReport(results)
  const passedCount = results.filter((result) => result.passed).length
  log(`测试完成：${passedCount}/${results.length} 通过`)
  log(`报告文件：${reportPath}`)

  if (passedCount !== results.length) {
    process.exitCode = 1
  }
}

if (require.main === module) {
  void main()
}
