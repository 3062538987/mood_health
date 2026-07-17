const fetch = require('node-fetch')
import { rolePermissions } from '../middleware/auth'
import type { PermissionCode } from '../middleware/auth'

interface DemoAccount {
  username: string
  expectedRole: 'super_admin' | 'admin' | 'user'
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

const hasPermission = (role: 'super_admin' | 'admin' | 'user', permission: PermissionCode) => {
  const conf = rolePermissions[role]
  if (conf.forbidden.includes(permission)) {
    return false
  }
  return conf.granted.includes(permission)
}

const runPermissionChecks = () => {
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
    return {
      ok: false,
      logs: failures,
    }
  }

  return {
    ok: true,
    logs: [
      'super_admin 权限校验通过（user.manage/role.manage/system.config/incident.fix/audit.record.view_all）',
      'admin 权限边界校验通过（无法访问 user.manage/role.manage/system.config/incident.fix）',
    ],
  }
}

const login = async (username: string, password: string) => {
  const response = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ username, password }),
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`)
  }

  const body = (await response.json()) as LoginResponse
  if (body.code !== 0) {
    throw new Error(`业务码异常: ${body.code}`)
  }

  return body
}

const main = async () => {
  console.log(`开始校验演示账号，API: ${BASE_URL}`)
  console.log('校验内容: 账号登录 + 角色一致性 + 权限边界')

  const failures: string[] = []
  const roleStats = {
    super_admin: 0,
    admin: 0,
    user: 0,
  }

  for (const account of demoAccounts) {
    try {
      const body = await login(account.username, PASSWORD)
      const actualRole = (body.data?.user?.role || 'user') as 'super_admin' | 'admin' | 'user'
      if (actualRole !== account.expectedRole) {
        failures.push(
          `${account.username}: 角色不匹配，期望 ${account.expectedRole}，实际 ${actualRole}`
        )
        console.log(`❌ ${account.username} 登录成功但角色不匹配: ${actualRole}`)
        continue
      }

      roleStats[actualRole] += 1

      console.log(`✅ ${account.username} 登录成功，角色 ${actualRole}`)
    } catch (error: any) {
      failures.push(`${account.username}: 登录失败 (${error?.message || '未知错误'})`)
      console.log(`❌ ${account.username} 登录失败: ${error?.message || '未知错误'}`)
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

void main()
