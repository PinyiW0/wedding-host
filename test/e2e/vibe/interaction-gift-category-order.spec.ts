import { expect, test } from '@playwright/test'
import { login, resetMockData, TestUsers } from '../helpers'

const base = '/api/v1/weddings/wedding-001/gift-categories'
test('拖曳類別同步頁面並保留順序，儲存失敗還原', async ({ page }) => {
  await resetMockData(page)
  await login(page, TestUsers.admin.account, TestUsers.admin.password)
  const original = await (await page.request.get(base)).json()
  const first = original[0]
  const second = original[1]
  await page.goto('/weddings/wedding-001/gifts', { waitUntil: 'networkidle' })
  await page.getByTestId('vibe-gift-category-manage').click()
  const order = page.locator('[data-testid^="gift-category-order-"]')
  const saved = page.waitForResponse(r => r.url().endsWith('/gift-categories/reorder') && r.request().method() === 'PUT')
  await page.getByTestId(`gift-category-order-${second.categoryId}`).dragTo(page.getByTestId(`gift-category-order-${first.categoryId}`))
  expect((await saved).ok()).toBeTruthy()
  await expect(order.first()).toContainText(second.name)
  await page.keyboard.press('Escape')
  const sections = page.locator('[data-testid^="gift-category-"]').filter({ has: page.locator('h2') })
  await expect(sections.first()).toHaveAttribute('data-testid', `gift-category-${second.categoryId}`)
  await page.reload({ waitUntil: 'networkidle' })
  await expect(sections.first()).toHaveAttribute('data-testid', `gift-category-${second.categoryId}`)
  await page.getByTestId('vibe-gift-category-manage').click()
  await page.route('**/gift-categories/reorder', route => route.fulfill({ status: 500, contentType: 'application/json', body: '{}' }))
  await page.getByRole('button', { name: `下移 ${second.name}`, exact: true }).click()
  await expect(page.getByTestId('vibe-gift-category-error')).toBeVisible()
  await expect(order.first()).toContainText(second.name)
  await page.unroute('**/gift-categories/reorder')
  const ids = original.map((c: any) => c.categoryId)
  expect((await page.request.put(`${base}/reorder`, { data: { categoryIds: [ids[0], ids[0]] } })).status()).toBe(400)
  expect((await page.request.put(`${base}/reorder`, { data: { categoryIds: [...ids.slice(1), 'foreign-category'] } })).status()).toBe(409)
})
