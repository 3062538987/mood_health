/**
 * E2E 隔离测试账号工具。
 *
 * 每个测试通过 registerUniqueAccount 创建独立账号，测试结束后调用 deleteCurrentAccount 清理，
 * 避免测试间数据串扰，也不依赖 demo seed 中的预置账号。
 */

import { APIRequestContext } from '@playwright/test'

export type TestAccount = {
  username: string
  password: string
  email: string
}

let counter = 0

function makeUniqueHandle(): string {
  counter += 1
  // 用户名需 3-20 位且仅含中文、字母、数字、下划线
  // 使用 36 进制时间戳（约 7 位）+ 3 位随机 + 计数器保持唯一且不超过 20 位
  const time = Date.now().toString(36)
  const random = Math.floor(Math.random() * 1000)
    .toString()
    .padStart(3, '0')
  return `e2e_${time}${random}_${counter}`
}

export function makeUniqueAccount(): TestAccount {
  const handle = makeUniqueHandle()
  return {
    username: handle,
    password: `E2ePass_${handle}!`,
    email: `${handle}@qq.com`,
  }
}

const CSRF_HEADER = 'x-csrf-token'
const CSRF_COOKIE = 'csrf_token'

async function ensureCsrfToken(
  request: APIRequestContext,
  baseURL: string,
): Promise<string> {
  // CSRF 中间件只对 /api 路由生效；GET /api/auth/me 会种下 token 并返回 401
  await request.get(`${baseURL}/api/auth/me`, {
    failOnStatusCode: false,
  })
  const state = await request.storageState()
  const allCookies = state.cookies
  const csrfCookie = allCookies.find(
    (c) => c.name === CSRF_COOKIE,
  )
  if (!csrfCookie) {
    throw new Error('CSRF token cookie not found after warming up')
  }
  return csrfCookie.value
}

export async function registerUniqueAccount(
  request: APIRequestContext,
  baseURL: string,
): Promise<TestAccount> {
  const account = makeUniqueAccount()
  const csrfToken = await ensureCsrfToken(request, baseURL)
  const response = await request.post(`${baseURL}/api/auth/register`, {
    data: {
      username: account.username,
      password: account.password,
      email: account.email,
    },
    headers: {
      [CSRF_HEADER]: csrfToken,
    },
    failOnStatusCode: false,
  })

  if (!response.ok()) {
    const body = await response.text()
    throw new Error(
      `Failed to register E2E account: ${response.status()} ${body.slice(0, 200)}`,
    )
  }

  return account
}

export async function deleteAccount(
  request: APIRequestContext,
  baseURL: string,
  account: TestAccount,
): Promise<void> {
  const csrfToken = await ensureCsrfToken(request, baseURL)

  // 先登录拿到 Cookie
  const loginResponse = await request.post(`${baseURL}/api/auth/login`, {
    data: {
      username: account.username,
      password: account.password,
    },
    headers: {
      [CSRF_HEADER]: csrfToken,
    },
    failOnStatusCode: false,
  })

  if (!loginResponse.ok()) {
    // 账号可能未成功创建，忽略清理失败
    return
  }

  const deleteResponse = await request.delete(`${baseURL}/api/auth/me`, {
    headers: {
      [CSRF_HEADER]: csrfToken,
    },
    failOnStatusCode: false,
  })

  if (!deleteResponse.ok() && deleteResponse.status() !== 401) {
    const body = await deleteResponse.text()
    throw new Error(
      `Failed to delete E2E account: ${deleteResponse.status()} ${body.slice(0, 200)}`,
    )
  }
}
