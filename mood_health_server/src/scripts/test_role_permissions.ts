import axios, { AxiosRequestConfig, AxiosResponse, Method } from 'axios'
import fs from 'fs/promises'
import path from 'path'

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

const requestWithFallback = async (
  method: Method,
  candidatePaths: string[],
  config: AxiosRequestConfig
): Promise<{ response: AxiosResponse; usedPath: string }> => {
  let lastResponse: AxiosResponse | null = null

  for (const p of candidatePaths) {
    const response = await axios.request({
      method,
      url: `${BASE_URL}${p}`,
      validateStatus: () => true,
      ...config,
    })

    if (response.status !== 404) {
      return { response, usedPath: p }
    }

    lastResponse = response
  }

  if (!lastResponse) {
    throw new Error('未执行任何请求')
  }

  return { response: lastResponse, usedPath: candidatePaths[candidatePaths.length - 1] }
}

const login = async (username: string): Promise<LoginData> => {
  const response = await axios.post(
    `${BASE_URL}/api/auth/login`,
    { username, password: PASSWORD },
    { validateStatus: () => true }
  )

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

const findFirstId = (value: any): number | null => {
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
    if (typeof value.id === 'number') {
      return value.id
    }

    for (const child of Object.values(value)) {
      const found = findFirstId(child)
      if (found !== null) {
        return found
      }
    }
  }

  return null
}

const fetchAuditLogs = async (token: string, params: Record<string, any> = {}) => {
  const { response, usedPath } = await requestWithFallback(
    'GET',
    ['/api/audit/all', '/api/audit/operation-logs'],
    {
      headers: operationHeaders(token),
      params: { page: 1, pageSize: 50, ...params },
    }
  )

  return { response, usedPath }
}

const generateReport = async (results: ScenarioResult[]) => {
  const passedCount = results.filter((r) => r.passed).length
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

  results.forEach((r) => {
    reportLines.push(
      `| ${r.scenario} | ${r.expected} | ${r.actual.replace(/\|/g, '\\|')} | ${r.passed ? '通过' : '失败'} |`
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

    // 场景1：admin 访问 role.manage -> 403
    {
      const { response, usedPath } = await requestWithFallback(
        'POST',
        ['/api/roles', '/api/roles/manage'],
        {
          headers: operationHeaders(admin.token),
          data: { targetUserId: user.userId || 1, targetRole: 'admin' },
        }
      )

      const passed = response.status === 403
      results.push({
        scenario: '场景1：admin 访问 /api/roles（role.manage）',
        expected: '403 错误',
        actual: `status=${response.status}, path=${usedPath}`,
        passed,
      })
    }

    // 场景2：super_admin 调用 user.manage 成功并写日志
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
        const { response: auditResp } = await fetchAuditLogs(superAdmin.token, {
          permission: 'user.manage',
          role: 'super_admin',
        })
        const list = auditResp.data?.data?.list || []
        logRecorded =
          Array.isArray(list) && list.some((item: any) => item.permission_code === 'user.manage')
      }

      const passed = response.status >= 200 && response.status < 300 && logRecorded
      results.push({
        scenario: '场景2：super_admin 调用 /api/users/update-role（user.manage）',
        expected: '操作成功并记录日志',
        actual: `status=${response.status}, path=${usedPath}, logRecorded=${logRecorded}`,
        passed,
      })
    }

    // 场景3：admin 调用 post.audit 成功并写审核日志
    {
      const pendingResp = await axios.get(`${BASE_URL}/api/posts/admin/pending`, {
        headers: operationHeaders(admin.token),
        validateStatus: () => true,
      })

      const pendingId = findFirstId(pendingResp.data?.data)
      let auditStatus = 0
      let usedPath = ''
      let logRecorded = false

      if (pendingResp.status === 200 && pendingId !== null) {
        const auditResp = await requestWithFallback(
          'POST',
          [`/api/posts/audit/${pendingId}`, `/api/posts/admin/audit/${pendingId}`],
          {
            headers: operationHeaders(admin.token),
            data: { status: 1, audit_remark: 'smoke test audit' },
          }
        )

        auditStatus = auditResp.response.status
        usedPath = auditResp.usedPath

        if (auditStatus >= 200 && auditStatus < 300) {
          const { response: auditLogsResp } = await fetchAuditLogs(superAdmin.token, {
            permission: 'post.audit',
          })
          const list = auditLogsResp.data?.data?.list || []
          logRecorded =
            Array.isArray(list) && list.some((item: any) => item.permission_code === 'post.audit')
        }
      }

      const passed =
        pendingResp.status === 200 &&
        pendingId !== null &&
        auditStatus >= 200 &&
        auditStatus < 300 &&
        logRecorded
      results.push({
        scenario: '场景3：admin 调用 /api/posts/audit（post.audit）',
        expected: '操作成功并记录审核日志',
        actual: `pendingStatus=${pendingResp.status}, pendingId=${pendingId}, auditStatus=${auditStatus}, path=${usedPath || '-'}, logRecorded=${logRecorded}`,
        passed,
      })
    }

    // 场景4：user 尝试删除活动（activity.manage）-> 403
    {
      const listResp = await axios.get(`${BASE_URL}/api/activities/list`, {
        validateStatus: () => true,
      })
      const activityId = findFirstId(listResp.data?.data) || 1

      const { response, usedPath } = await requestWithFallback(
        'DELETE',
        [`/api/activities/delete/${activityId}`, '/api/activities/delete'],
        {
          headers: operationHeaders(user.token),
        }
      )

      const passed = response.status === 403
      results.push({
        scenario: '场景4：user 尝试访问 /api/activities/delete（activity.manage）',
        expected: '403 错误',
        actual: `status=${response.status}, path=${usedPath}, activityId=${activityId}`,
        passed,
      })
    }

    // 场景5：super_admin 可查全量审计；admin 403
    {
      const superResp = await fetchAuditLogs(superAdmin.token)
      const adminResp = await fetchAuditLogs(admin.token)

      const superHasData =
        superResp.response.status === 200 && Array.isArray(superResp.response.data?.data?.list)
      const adminDenied = adminResp.response.status === 403

      const passed = superHasData && adminDenied
      results.push({
        scenario: '场景5：super_admin 查看 /api/audit/all；admin 访问同接口',
        expected: 'super_admin 返回数据，admin 返回 403',
        actual: `superStatus=${superResp.response.status}, superPath=${superResp.usedPath}, adminStatus=${adminResp.response.status}, adminPath=${adminResp.usedPath}`,
        passed,
      })
    }

    // 场景6：admin 调用 /api/music/create（music.manage）
    {
      const body = {
        title: `Smoke Music ${Date.now()}`,
        artist: 'Smoke Bot',
        url: 'https://example.com/smoke-test.mp3',
        duration: 120,
        category: 'relax',
        cover: 'https://example.com/smoke-cover.jpg',
      }

      const { response, usedPath } = await requestWithFallback(
        'POST',
        ['/api/music/create', '/api/music'],
        {
          headers: operationHeaders(admin.token),
          data: body,
        }
      )

      const passed = response.status === 201 || response.status === 200
      results.push({
        scenario: '场景6：admin 调用 /api/music/create（music.manage）',
        expected: '操作成功',
        actual: `status=${response.status}, path=${usedPath}`,
        passed,
      })
    }
  } catch (error: any) {
    results.push({
      scenario: '脚本执行异常',
      expected: '脚本完整执行',
      actual: error?.message || '未知错误',
      passed: false,
    })
  }

  const reportPath = await generateReport(results)
  const passedCount = results.filter((r) => r.passed).length
  log(`测试完成：${passedCount}/${results.length} 通过`)
  log(`报告文件：${reportPath}`)

  if (passedCount !== results.length) {
    process.exitCode = 1
  }
}

void main()
