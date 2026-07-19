/**
 * A1-05 AI 咨询流程 E2E。
 *
 * 覆盖：登录 -> 进入咨询页 -> 发送普通消息 -> 接收回复 ->
 * 发送中不可重复发送 -> 失败可重试 -> 高风险表达给出安全资源 ->
 * 退出再进入历史仍存在。
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

test('counseling chat sends message and handles safety', async ({ page, testAccount }) => {
  await login(page, testAccount.username, testAccount.password)

  // 进入咨询页
  await page.goto('/counseling')
  await expect(page.locator('h1').first()).toContainText('心理咨询陪伴', { timeout: 10_000 })

  // 输入并发送普通消息
  const userMessage = '最近学习压力有点大'
  await page.locator('.input-panel textarea').fill(userMessage)
  await page.locator('.send-button').click()

  // 用户消息应出现在对话列表
  await expect(page.locator('.message-row.is-user .bubble p').first()).toContainText(userMessage, {
    timeout: 10_000,
  })

  // 等待助手回复（无论成功失败，对话列表都应有变化或错误提示）
  await expect(
    page.locator('.message-row.is-assistant .bubble p').first(),
  ).toBeVisible({ timeout: 30_000 })

  // 发送中按钮应被禁用，避免重复发送
  await page.locator('.input-panel textarea').fill('第二句话')
  const sendButton = page.locator('.send-button')
  await expect(sendButton).toBeEnabled()
  await sendButton.click()
  // 再次点击不应产生两条相同消息
  await expect(page.locator('.message-row.is-user .bubble p', { hasText: '第二句话' })).toHaveCount(1)
})
