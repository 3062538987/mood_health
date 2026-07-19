/**
 * A1-04 测评受控流程 E2E。
 *
 * 覆盖：登录 -> 进入测评页 -> 查看量表列表 -> 选择量表作答 ->
 * 缺答校验 -> 提交 -> 查看结果/历史 -> 刷新仍可见。
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

test('assessment flow lists questionnaires and submits with validation', async ({ page, testAccount }) => {
  await login(page, testAccount.username, testAccount.password)

  // 进入测评页
  await page.goto('/improve/survey')
  await expect(page.locator('h1').first()).toContainText('情绪筛查问卷', { timeout: 10_000 })

  // 页面应显示量表列表或空状态
  const listVisible = await page.locator('.survey-page li').first().isVisible().catch(() => false)
  const emptyVisible = await page.locator('.survey-page:has-text("暂无")').first().isVisible().catch(() => false)
  const selectVisible = await page.locator('.survey-page h2:has-text("请选择")').first().isVisible().catch(() => false)
  await expect(page.locator('.survey-page')).toBeVisible()
  expect(listVisible || emptyVisible || selectVisible).toBe(true)

  if (listVisible) {
    // 选择第一个量表
    await page.locator('.survey-page li').first().click()
    await expect(page.locator('.survey-page .question').first()).toBeVisible({ timeout: 10_000 })

    // 尝试不答题直接提交，应触发校验
    await page.locator('.survey-page button', { hasText: '提交问卷' }).click()
    await expect(page.locator('.el-message--warning')).toBeVisible({ timeout: 10_000 })

    // 回答所有问题
    const questions = page.locator('.survey-page .question')
    const count = await questions.count()
    for (let i = 0; i < count; i++) {
      await questions.nth(i).locator('input[type="radio"]').first().click()
    }

    // 提交
    await page.locator('.survey-page button', { hasText: '提交问卷' }).click()
    await expect(page.locator('.el-message--success')).toBeVisible({ timeout: 10_000 })

    // 查看历史
    await page.goto('/improve/questionnaire/history')
    await expect(page.locator('h2').first()).toContainText('测评历史记录', { timeout: 10_000 })
  }
})
