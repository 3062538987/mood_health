import { rolePermissions } from '../middleware/auth'
import type { PermissionCode } from '../middleware/auth'

type DemoUserRole = 'super_admin' | 'admin' | 'user'

interface DemoAccount {
  username: string
  expectedRole: DemoUserRole
}

interface LoginResponse {
  code: number
  data?: {
    user?: {
      role?: string
    }
  }
}

const BASE_URL =
  process.env.API_BASE_URL || process.env.DEMO_API_BASE_URL || 'http://localhost:3000'
const PASSWORD = process.argv[2] || process.env.DEMO_USER_PASSWORD || '123456'
const TIMEOUT_VALUE = process.env.DEMO_API_TIMEOUT_MS
const DEFAULT_TIMEOUT_MS = 10_000
const MAX_TIMEOUT_MS = 30_000
const MAX_RESPONSE_BYTES = 1024 * 1024

class SafeDemoUserVerificationError extends Error {}

const configurationError = () =>
  new SafeDemoUserVerificationError('Invalid demo user verification configuration')

const parseBaseUrl = (value: string): URL => {
  let parsed: URL
  try {
    parsed = new URL(value)
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

  return parsed
}

const parseTimeout = (value?: string): number => {
  if (value === undefined) {
    return DEFAULT_TIMEOUT_MS
  }

  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw configurationError()
  }

  return Math.min(parsed, MAX_TIMEOUT_MS)
}

const readBoundedResponseBody = async (response: Response): Promise<string> => {
  const declaredLength = Number(response.headers.get('content-length'))
  if (Number.isFinite(declaredLength) && declaredLength > MAX_RESPONSE_BYTES) {
    throw new SafeDemoUserVerificationError('Demo user login response exceeds 1 MiB')
  }

  if (!response.body) {
    return ''
  }

  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let totalBytes = 0

  while (true) {
    const { done, value } = await reader.read()
    if (done) {
      break
    }

    totalBytes += value.byteLength
    if (totalBytes > MAX_RESPONSE_BYTES) {
      await reader.cancel().catch(() => undefined)
      throw new SafeDemoUserVerificationError('Demo user login response exceeds 1 MiB')
    }
    chunks.push(value)
  }

  return Buffer.concat(chunks, totalBytes).toString('utf8')
}

const isDemoUserRole = (value: unknown): value is DemoUserRole =>
  value === 'super_admin' || value === 'admin' || value === 'user'

export const createDemoUserLoginClient = (baseUrl: string, timeoutValue?: string) => {
  const parsedBaseUrl = parseBaseUrl(baseUrl)
  const timeoutMs = parseTimeout(timeoutValue)
  const loginUrl = new URL('/api/auth/login', parsedBaseUrl).toString()

  return {
    login: async (username: string, password: string): Promise<DemoUserRole> => {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), timeoutMs)

      try {
        const response = await fetch(loginUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ username, password }),
          redirect: 'error',
          signal: controller.signal,
        })

        if (!response.ok) {
          throw new SafeDemoUserVerificationError('Demo user login request was rejected')
        }

        const responseText = await readBoundedResponseBody(response)
        let body: LoginResponse
        try {
          body = JSON.parse(responseText) as LoginResponse
        } catch {
          throw new SafeDemoUserVerificationError('Demo user login response is invalid')
        }

        if (body.code !== 0) {
          throw new SafeDemoUserVerificationError('Demo user login was rejected')
        }

        const role = body.data?.user?.role
        if (!isDemoUserRole(role)) {
          throw new SafeDemoUserVerificationError('Demo user login returned an invalid role')
        }

        return role
      } catch (error: unknown) {
        if (error instanceof SafeDemoUserVerificationError) {
          throw error
        }
        if (controller.signal.aborted) {
          throw new SafeDemoUserVerificationError('Demo user login request timed out')
        }
        throw new SafeDemoUserVerificationError('Demo user login request failed')
      } finally {
        clearTimeout(timeout)
      }
    },
  }
}

const demoAccounts: DemoAccount[] = [
  { username: 'super_admin_test1', expectedRole: 'super_admin' },
  { username: 'super_admin_test2', expectedRole: 'super_admin' },
  { username: 'admin_test1', expectedRole: 'admin' },
  { username: 'admin_test2', expectedRole: 'admin' },
  { username: 'admin_test3', expectedRole: 'admin' },
  { username: 'admin_test4', expectedRole: 'admin' },
  { username: 'student_test1', expectedRole: 'user' },
  { username: 'student_test2', expectedRole: 'user' },
  { username: 'student_test3', expectedRole: 'user' },
  { username: 'student_test4', expectedRole: 'user' },
]

const hasPermission = (role: DemoUserRole, permission: PermissionCode) => {
  const conf = rolePermissions[role]
  if (conf.forbidden.includes(permission)) {
    return false
  }
  return conf.granted.includes(permission)
}

export const runPermissionChecks = () => {
  const failures: string[] = []

  const superAdminRequired: PermissionCode[] = [
    'user.manage',
    'role.manage',
    'system.config',
    'incident.fix',
    'audit.record.view_all',
  ]

  superAdminRequired.forEach((permission) => {
    if (!hasPermission('super_admin', permission)) {
      failures.push(`super_admin 缺少权限: ${permission}`)
    }
  })

  const adminDenied: PermissionCode[] = [
    'user.manage',
    'role.manage',
    'system.config',
    'incident.fix',
  ]
  adminDenied.forEach((permission) => {
    if (hasPermission('admin', permission)) {
      failures.push(`admin 不应拥有权限: ${permission}`)
    }
  })

  if (failures.length > 0) {
    return { ok: false, logs: failures }
  }

  return {
    ok: true,
    logs: [
      'super_admin 权限校验通过（user.manage/role.manage/system.config/incident.fix/audit.record.view_all）',
      'admin 权限边界校验通过（无法访问 user.manage/role.manage/system.config/incident.fix）',
    ],
  }
}

const main = async () => {
  const loginClient = createDemoUserLoginClient(BASE_URL, TIMEOUT_VALUE)
  console.log(`开始校验演示账号，API: ${new URL(BASE_URL).origin}`)
  console.log('校验内容: 账号登录 + 角色一致性 + 权限边界')

  const failures: string[] = []
  const roleStats = { super_admin: 0, admin: 0, user: 0 }

  for (const account of demoAccounts) {
    try {
      const actualRole = await loginClient.login(account.username, PASSWORD)
      if (actualRole !== account.expectedRole) {
        failures.push(
          `${account.username}: 角色不匹配，期望 ${account.expectedRole}，实际 ${actualRole}`
        )
        console.log(`❌ ${account.username} 登录成功但角色不匹配: ${actualRole}`)
        continue
      }

      roleStats[actualRole] += 1
      console.log(`✅ ${account.username} 登录成功，角色 ${actualRole}`)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '未知错误'
      failures.push(`${account.username}: 登录失败 (${message})`)
      console.log(`❌ ${account.username} 登录失败: ${message}`)
    }
  }

  console.log('')
  console.log('权限边界校验：')
  const permissionCheck = runPermissionChecks()
  permissionCheck.logs.forEach((log) => {
    if (permissionCheck.ok) {
      console.log(`✅ ${log}`)
    } else {
      console.log(`❌ ${log}`)
      failures.push(log)
    }
  })

  console.log('')
  console.log(
    `角色统计: super_admin=${roleStats.super_admin}, admin=${roleStats.admin}, user=${roleStats.user}`
  )

  const expectedStats = { super_admin: 2, admin: 4, user: 4 }
  if (
    roleStats.super_admin !== expectedStats.super_admin ||
    roleStats.admin !== expectedStats.admin ||
    roleStats.user !== expectedStats.user
  ) {
    failures.push(
      `角色分布异常，期望 super_admin=${expectedStats.super_admin}, admin=${expectedStats.admin}, user=${expectedStats.user}`
    )
  }

  console.log('')
  if (failures.length > 0) {
    console.log('校验结果: 失败')
    failures.forEach((item) => console.log(`- ${item}`))
    process.exitCode = 1
    return
  }

  console.log('校验结果: 全部通过')
}

if (require.main === module) {
  void main()
}
