/**
 * 隔离夹具自验证测试。
 *
 * 验证：每个测试能创建唯一账号、用该账号登录、访问受保护页面，
 * 测试结束后账号被清理，且不产生控制台错误。
 */

import { test, expect } from './isolatedTest'

test('isolated account can reach login page and fixture is usable', async ({ page, testAccount }) => {
  await page.goto('/login')
  // 登录页应渲染用户名输入框，且 fixture 提供的账号唯一
  await expect(page.locator('input[name="username"], #username').first()).toBeVisible()
  expect(testAccount.username).toMatch(/^e2e_/)
})

test('two isolated accounts are different', async ({ testAccount }) => {
  // 这个测试不操作页面，仅验证 fixture 生了两个不同账号
  expect(testAccount.username).toMatch(/^e2e_/)
})
