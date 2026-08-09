import type { Page } from '@playwright/test'
import { test, expect } from './fixtures/isolatedTest'

const login = async (page: Page, baseURL: string, username: string, password: string) => {
  const origin = new URL(baseURL).origin
  await page.request.get(`${origin}/api/auth/me`, { failOnStatusCode: false })
  const csrfCookie = (await page.context().cookies()).find((cookie) => cookie.name === 'csrf_token')
  expect(csrfCookie).toBeDefined()

  const response = await page.request.post(`${origin}/api/auth/login`, {
    data: { username, password },
    headers: { 'x-csrf-token': csrfCookie!.value },
    failOnStatusCode: false,
  })
  expect(response.ok()).toBe(true)

  const sessionResponse = await page.request.get(`${origin}/api/auth/me`, {
    failOnStatusCode: false,
  })
  expect(sessionResponse.ok()).toBe(true)
  const sessionBody = await sessionResponse.text()
  await page.route('**/api/auth/me', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: sessionBody })
  })
}

test('uses one AI psychological assistant window with optional sources', async ({
  page,
  baseURL,
  testAccount,
}) => {
  await login(page, baseURL!, testAccount.username, testAccount.password)

  await page.goto('/ai/knowledge-assistant')
  await expect(page).toHaveURL(/\/counseling$/, { timeout: 30_000 })
  await expect(page.getByRole('heading', { name: 'AI 心理助手' })).toBeVisible()

  let responseIndex = 0
  await page.route('**/api/counseling/send', async (route) => {
    const responses = [
      {
        response: '可以先固定每天的起床时间。',
        sessionId: 'session-unified',
        riskLevel: 'low',
        hasRiskContent: false,
        sources: [{ title: '睡眠卫生', reference: '国家卫健委' }],
        groundingUsed: true,
        requestId: 'request-grounded',
        provider: 'deepseek',
        model: 'deepseek-chat',
        fallbackUsed: false,
      },
      {
        response: '听起来你今天承受了很多。',
        sessionId: 'session-unified',
        riskLevel: 'low',
        hasRiskContent: false,
        sources: [],
        groundingUsed: false,
        requestId: 'request-support',
        provider: 'deepseek',
        model: 'deepseek-chat',
        fallbackUsed: false,
      },
      {
        response: '请先联系身边可信任的人或学校心理中心。',
        sessionId: 'session-unified',
        riskLevel: 'medium',
        hasRiskContent: true,
        suggestion: '请寻求专业帮助',
        sources: [],
        groundingUsed: false,
        requestId: 'request-risk',
        provider: 'deepseek',
        model: 'deepseek-chat',
        fallbackUsed: false,
      },
    ]
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ code: 0, message: '回复成功', data: responses[responseIndex++] }),
    })
  })

  const input = page.locator('.input-panel textarea')
  await input.fill('怎样改善睡眠？')
  await page.locator('.send-button').click()
  await expect(page.getByLabel('参考来源')).toContainText('国家卫健委')

  await input.fill('我今天很难过')
  await page.locator('.send-button').click()
  await expect(page.getByText('听起来你今天承受了很多。')).toBeVisible()
  await expect(page.getByLabel('参考来源')).toHaveCount(1)

  await input.fill('我不想活了')
  await page.locator('.send-button').click()
  await expect(page.locator('.risk-badge.medium')).toBeVisible()
  await expect(page.getByLabel('参考来源')).toHaveCount(1)
})

test('keeps the original text when the unified assistant service fails', async ({
  page,
  baseURL,
  testAccount,
}) => {
  test.info().annotations.push({
    type: 'expected-console-error',
    description: 'Request failed with status code 502',
  })
  await login(page, baseURL!, testAccount.username, testAccount.password)
  await page.goto('/counseling')
  await page.route('**/api/counseling/send', async (route) => {
    await route.fulfill({
      status: 502,
      contentType: 'application/json',
      body: JSON.stringify({ code: 1500, message: 'AI 服务暂时不可用', data: null }),
    })
  })

  const input = page.locator('.input-panel textarea')
  await input.fill('我今天压力很大')
  await page.locator('.send-button').click()

  await expect(page.locator('.send-error')).toContainText('原文字已保留')
  await expect(input).toHaveValue('我今天压力很大')
})
