/**
 * A1-02 认证黄金流程 E2E。
 *
 * 覆盖：注册页可访问性、登录 -> 访问受保护页 -> 刷新 -> 退出 -> 浏览器后退 -> 再次访问、错误账号可重试。
 * 只记录生产缺陷证据，不顺手修改其他模块。
 */

import { test, expect } from './fixtures/isolatedTest'

test('register page is accessible to guests', async ({ page }) => {
  await page.goto('/register')
  await expect(page).toHaveURL(/\/register/, { timeout: 10_000 })
  await expect(page.locator('h2')).toContainText('用户注册')
})

test('login -> protected page -> refresh -> logout -> back -> revisit', async ({ page, testAccount }) => {
  // fixture 已注册唯一账号，直接登录
  await page.goto('/login')
  await expect(page.locator('h2')).toContainText('用户登录')

  await page.locator('#username').fill(testAccount.username)
  await page.locator('#password').fill(testAccount.password)
  await page.locator('#login-button').click()

  // 登录成功跳转到引导页或首页
  await expect(page).toHaveURL(/\/(guide|)$/, { timeout: 10_000 })

  // 访问受保护页
  await page.goto('/mood/record')
  await expect(page.locator('h1').first()).toContainText('把今天的情绪', { timeout: 10_000 })

  // 刷新后仍保持登录
  await page.reload()
  await expect(page.locator('.btn-logout, .username').first()).toBeVisible({ timeout: 10_000 })

  // 退出
  await page.locator('.btn-logout').click()
  await expect(page).toHaveURL(/\/login/, { timeout: 10_000 })

  // 浏览器后退不应恢复旧会话
  await page.goBack()
  await expect(page).toHaveURL(/\/(login|)$/, { timeout: 10_000 })

  // 再次直接访问受保护页，应要求登录
  await page.goto('/mood/record')
  await expect(page).toHaveURL(/\/login/, { timeout: 10_000 })
})

test('invalid credentials can be retried', async ({ page, testAccount }) => {
  await page.goto('/login')
  await page.locator('#username').fill(testAccount.username)
  await page.locator('#password').fill('wrong-password')
  await page.locator('#login-button').click()

  // 出现错误提示且仍停留在登录页
  await expect(page.locator('.error-message')).toBeVisible({ timeout: 10_000 })
  await expect(page).toHaveURL(/\/login/)

  // 可重试正确密码
  await page.locator('#password').fill(testAccount.password)
  await page.locator('#login-button').click()
  await expect(page).toHaveURL(/\/(guide|)$/, { timeout: 10_000 })
})
