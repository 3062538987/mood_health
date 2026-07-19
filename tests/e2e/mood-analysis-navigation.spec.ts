/**
 * 情绪分析页面 E2E 测试。
 *
 * 覆盖：分析页面加载不崩溃、加载后可正常导航到其他页面。
 */

import { test, expect } from './fixtures/isolatedTest'

const login = async (page: any, username: string, password: string) => {
  await page.goto('/login')
  await expect(page.locator('h2')).toContainText('用户登录')
  await page.locator('#username').fill(username)
  await page.locator('#password').fill(password)
  await page.locator('#login-button').click()
  await expect(page).toHaveURL(/\/(guide|)$/, { timeout: 10_000 })
}

test('分析页面正常加载，不出现 Vue 渲染崩溃', async ({ page, testAccount }) => {
  await login(page, testAccount.username, testAccount.password)

  // 导航到情绪分析页面
  await page.goto('/mood/analysis')
  await expect(page).toHaveURL(/\/mood\/analysis/, { timeout: 10_000 })

  // 验证页面核心元素渲染（无数据时展示空状态）
  await expect(page.locator('.analysis-header h2')).toContainText('了解自己的情绪模式', { timeout: 10_000 })

  // 验证周期切换器可见
  await expect(page.locator('.period-switcher')).toBeVisible({ timeout: 5_000 })

  // 等待加载完成，然后验证空状态或内容区正常渲染
  // 无数据时展示 SoftEmptyState（.soft-empty-state），有数据时展示 summary-cards
  await page.waitForSelector('.soft-empty-state, .summary-cards', { timeout: 10_000 })
})

test('分析页面加载完成后可正常导航到其他页面', async ({ page, testAccount }) => {
  await login(page, testAccount.username, testAccount.password)

  // 导航到情绪分析页面
  await page.goto('/mood/analysis')
  await expect(page).toHaveURL(/\/mood\/analysis/, { timeout: 10_000 })

  // 等待页面渲染完成
  await expect(page.locator('.analysis-header h2')).toBeVisible({ timeout: 10_000 })

  // 导航到情绪记录页
  await page.goto('/mood/record')
  await expect(page).toHaveURL(/\/mood\/record/, { timeout: 10_000 })
  await expect(page.locator('h1').first()).toContainText('把今天的情绪', { timeout: 10_000 })

  // 再导航回分析页
  await page.goto('/mood/analysis')
  await expect(page).toHaveURL(/\/mood\/analysis/, { timeout: 10_000 })
  await expect(page.locator('.analysis-header h2')).toBeVisible({ timeout: 10_000 })

  // 导航到首页
  await page.goto('/')
  await expect(page).toHaveURL(/\/(guide|)$/, { timeout: 10_000 })
})