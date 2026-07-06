// Source: app/layouts/default.vue（管理者「接待報到」入口改為婚禮情境感知）
// Pattern: conditional-render——接待台屬於單一婚禮：所有婚禮層級不顯示；婚禮內顯示並帶當前 weddingId
// （裸 /reception 會 fallback 到 wedding-001，先前在多婚禮情境會默默進錯場次）

import { expect, test } from '@playwright/test'

import { login, resetMockData, TestUsers } from '../helpers'

test.describe('vibe：管理者接待報到入口', () => {
  test.beforeEach(async ({ page }) => {
    await resetMockData(page)
    await login(page, TestUsers.admin.account, TestUsers.admin.password)
  })

  test('所有婚禮層級：側欄不顯示接待報到（無婚禮情境可指向）', async ({ page }) => {
    await page.goto('/weddings', { waitUntil: 'networkidle' })
    await expect(page.getByTestId('vibe-sidebar').getByText('接待報到')).toHaveCount(0)
  })

  test('婚禮情境內：接待報到帶當前 weddingId（非預設 wedding-001）', async ({ page }) => {
    await page.goto('/weddings/wedding-002', { waitUntil: 'networkidle' })

    await page.getByTestId('vibe-sidebar').getByText('接待報到').click()
    await page.waitForURL(url =>
      url.pathname === '/reception' && url.searchParams.get('weddingId') === 'wedding-002')
  })
})
