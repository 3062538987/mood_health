import { expect, test, type Page, type Response } from '@playwright/test'

const loginAsSuperAdmin = async (page: Page, baseURL: string) => {
  const origin = new URL(baseURL).origin
  await page.request.get(`${origin}/api/auth/me`, { failOnStatusCode: false })
  const csrfCookie = (await page.context().cookies()).find((cookie) => cookie.name === 'csrf_token')
  expect(csrfCookie).toBeDefined()

  const response = await page.request.post(`${origin}/api/auth/login`, {
    data: {
      username: 'demo_super_admin',
      password: process.env.DEMO_PASSWORD || 'E2eDemoPass123!',
    },
    headers: { 'x-csrf-token': csrfCookie!.value },
    failOnStatusCode: false,
  })
  expect(response.ok(), await response.text()).toBe(true)
}

test('super admin can open every visible admin page without redirects or API failures', async ({
  page,
  baseURL,
}) => {
  await loginAsSuperAdmin(page, baseURL!)

  const apiFailures: Array<{ status: number; url: string }> = []
  const collectApiFailure = (response: Response) => {
    if (response.url().includes('/api/') && response.status() >= 400) {
      apiFailures.push({ status: response.status(), url: response.url() })
    }
  }
  page.on('response', collectApiFailure)

  await page.goto('/admin/dashboard')
  await expect(page).toHaveURL(/\/admin\/dashboard$/)
  await expect(page.getByRole('heading', { name: '管理驾驶舱' })).toBeVisible()

  const sidebarLinks = page.locator('.sidebar-nav .nav-item')
  const hrefs = await sidebarLinks.evaluateAll((links) =>
    links.map((link) => link.getAttribute('href')).filter((href): href is string => Boolean(href))
  )

  expect(hrefs).toEqual(
    expect.arrayContaining([
      '/admin/dashboard',
      '/admin/users',
      '/admin/user-moods',
      '/admin/moods',
      '/admin/assessments',
      '/admin/treehole',
      '/admin/cases',
      '/admin/courses',
      '/admin/music',
      '/admin/audit-logs',
      '/admin/activity-stats',
    ])
  )
  expect(hrefs).not.toContain('/admin/posts')

  for (const href of hrefs) {
    await test.step(`open ${href}`, async () => {
      await page.goto(href, { waitUntil: 'networkidle' })
      await expect(page).toHaveURL(new RegExp(`${href.replaceAll('/', '\\/')}$`))
      await expect(page.locator('.admin-main h1, .admin-main h2').first()).toBeVisible()
    })
  }

  page.off('response', collectApiFailure)
  expect(apiFailures).toEqual([])
})
