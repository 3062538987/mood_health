/**
 * 隔离 Playwright 测试夹具。
 *
 * 特性：
 * - 每个测试自动创建唯一账号（testAccount）
 * - 测试结束后自动注销并删除账号
 * - 收集控制台错误与网络失败到 test.info().attachments
 * - 失败时保留 screenshot/trace/video（由 playwright.config.ts 统一配置）
 *
 * 用法：
 *     import { test, expect } from './isolatedTest'
 *
 *     test('示例', async ({ page, testAccount }) => {
 *       await page.goto('/login')
 *       // ...
 *     })
 */

import { test as base, expect, ConsoleMessage, Response } from '@playwright/test'
import { deleteAccount, registerUniqueAccount, TestAccount } from './testAccount'

export type IsolatedFixtures = {
  testAccount: TestAccount
  observedConsoleErrors: ConsoleMessage[]
  observedNetworkFailures: { url: string; status: number; statusText: string }[]
  consoleAndNetworkCheck: void
}

export const test = base.extend<IsolatedFixtures>({
  testAccount: async ({ page, baseURL }, use, testInfo) => {
    const backendUrl = process.env.VITE_API_BASE_URL || baseURL || ''
    if (!backendUrl) {
      throw new Error('VITE_API_BASE_URL or baseURL must be set to create isolated test account')
    }

    const account = await registerUniqueAccount(page.request, backendUrl)
    await use(account)

    // 测试结束后清理账号；失败时仍尝试清理，但不抛出以避免覆盖原始失败
    try {
      await deleteAccount(page.request, backendUrl, account)
    } catch (error) {
      testInfo.attach('account-cleanup-error', {
        body: error instanceof Error ? error.message : String(error),
        contentType: 'text/plain',
      })
    }
  },

  observedConsoleErrors: async ({ page }, use) => {
    const errors: ConsoleMessage[] = []
    const listener = (msg: ConsoleMessage) => {
      if (msg.type() === 'error') {
        errors.push(msg)
      }
    }
    page.on('console', listener)
    await use(errors)
    page.off('console', listener)
  },

  observedNetworkFailures: async ({ page }, use) => {
    const failures: { url: string; status: number; statusText: string }[] = []
    const listener = (response: Response) => {
      if (response.status() >= 400) {
        failures.push({
          url: response.url(),
          status: response.status(),
          statusText: response.statusText(),
        })
      }
    }
    page.on('response', listener)
    await use(failures)
    page.off('response', listener)
  },

  consoleAndNetworkCheck: [
    async ({ observedConsoleErrors, observedNetworkFailures }, use, testInfo) => {
      await use()

      // 未登录时 /api/auth/me 返回 401 是预期行为，页面会正常处理，不计入失败
      const expectedPatterns = ['/api/auth/me', 'Request failed with status code 401', 'Failed to load resource']
      const unexpectedConsoleErrors = observedConsoleErrors.filter((msg) => {
        const text = msg.text()
        const url = msg.location().url || ''
        return !expectedPatterns.some(
          (pattern) => text.includes(pattern) || (pattern === 'Failed to load resource' && url.includes('/api/auth/me')),
        )
      })

      // 测试结束时把收集到的错误挂载到报告
      if (observedConsoleErrors.length > 0) {
        const errorsJson = JSON.stringify(
          observedConsoleErrors.map((msg) => ({
            text: msg.text(),
            location: msg.location(),
            type: msg.type(),
          })),
          null,
          2,
        )
        console.error('[isolatedTest] console errors:', errorsJson)
        testInfo.attach('console-errors', { body: errorsJson, contentType: 'application/json' })
      }

      // 未登录时 /api/auth/me 返回 401 是预期行为，不计入失败
      const unexpectedNetworkFailures = observedNetworkFailures.filter(
        (failure) => !(failure.url.includes('/api/auth/me') && failure.status === 401),
      )
      if (unexpectedNetworkFailures.length > 0) {
        const failuresJson = JSON.stringify(unexpectedNetworkFailures, null, 2)
        console.error('[isolatedTest] network failures:', failuresJson)
        testInfo.attach('network-failures', { body: failuresJson, contentType: 'application/json' })
      }

      // 任意控制台错误导致测试失败（已过滤预期内的 401）
      expect(unexpectedConsoleErrors).toHaveLength(0)
    },
    { auto: true },
  ],
})

export { expect }
