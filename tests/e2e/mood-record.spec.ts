/**
 * A1-03 情绪记录黄金流程 E2E。
 *
 * 覆盖：登录 -> 进入记录页 -> 选择情绪/强度/触发因素/描述 -> 保存 ->
 * 归档页查看 -> 刷新仍可见 -> 退出并重新登录后仍可见。
 * 只记录生产缺陷证据，不顺手修改其他模块。
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

test('mood record persists and survives refresh + re-login', async ({ page, testAccount }) => {
  await login(page, testAccount.username, testAccount.password)

  // 进入记录页
  await page.goto('/mood/record')
  await expect(page.locator('h1').first()).toContainText('把今天的情绪', { timeout: 10_000 })

  // 等待情绪类型加载完成
  await expect(page.locator('.mood-type-item').first()).toBeVisible({ timeout: 10_000 })

  // 选择情绪类型：快乐
  await page.locator('.mood-type-item', { hasText: '愉悦' }).first().click()

  // 选择强度 5
  await page.locator('.scale-dot', { hasText: '5' }).first().click()

  // 输入描述
  const noteText = `E2E 测试记录 ${Date.now()}`
  await page.locator('.writing-panel textarea').fill(noteText)

  // 添加触发因素
  await page.locator('.trigger-input').fill('考试')
  await page.locator('.add-trigger-btn').click()

  // 保存
  await page.locator('.submit-action').click()

  // 验证成功提示出现
  await expect(page.locator('.success-banner')).toBeVisible({ timeout: 10_000 })

  // 进入归档页查看
  await page.goto('/mood/archive')
  await expect(page.locator('.record-card').first()).toBeVisible({ timeout: 10_000 })

  const firstCard = page.locator('.record-card').first()
  await expect(firstCard.locator('.mood-tag').first()).toContainText('愉悦')
  await expect(firstCard.locator('.intensity-head strong')).toContainText('5')
  await expect(firstCard.locator('.record-note')).toContainText(noteText)
  await expect(firstCard.locator('.trigger-tag', { hasText: '考试' }).first()).toBeVisible()

  // 刷新后仍可见
  await page.reload()
  await expect(page.locator('.record-card').first()).toBeVisible({ timeout: 10_000 })
  await expect(page.locator('.record-card').first().locator('.record-note')).toContainText(noteText)

  // 退出并重新登录
  await page.locator('.btn-logout').click()
  await expect(page).toHaveURL(/\/login/, { timeout: 10_000 })

  await login(page, testAccount.username, testAccount.password)

  // 重新登录后归档页仍能看到记录
  await page.goto('/mood/archive')
  await expect(page.locator('.record-card').first()).toBeVisible({ timeout: 10_000 })
  await expect(page.locator('.record-card').first().locator('.record-note')).toContainText(noteText)
})
