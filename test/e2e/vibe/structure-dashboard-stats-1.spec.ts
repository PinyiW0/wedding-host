// Source: app/pages/weddings/[weddingId]/index.vue（儀表板統計卡，issue #11）
// Pattern: new-region

import { expect, test } from '@playwright/test'

import { login, resetMockData, TestUsers } from '../helpers'

const WEDDING_URL = '/weddings/wedding-001'

test.describe('vibe：婚禮總覽儀表板統計', () => {
  test.beforeEach(async ({ page }) => {
    await resetMockData(page)
    await login(page, TestUsers.admin.account, TestUsers.admin.password)
  })

  test('顯示四張統計卡（出席人數／出席回覆／報到進度／禮金累計）', async ({ page }) => {
    await page.goto(WEDDING_URL, { waitUntil: 'networkidle' })
    const stats = page.getByTestId('vibe-dashboard-stats')
    await expect(stats).toBeVisible()
    await expect(stats.getByText('出席人數')).toBeVisible()
    await expect(stats.getByText('出席回覆')).toBeVisible()
    await expect(stats.getByText('報到進度')).toBeVisible()
    await expect(stats.getByText('禮金累計')).toBeVisible()
  })

  test('統計數字與 seed 一致（僅 guest-003 回覆出席：1 組 4 人、無報到、無禮金）', async ({ page }) => {
    await page.goto(WEDDING_URL, { waitUntil: 'networkidle' })
    await expect(page.getByTestId('vibe-dashboard-attendance').getByText('4', { exact: true })).toBeVisible()
    await expect(page.getByTestId('vibe-dashboard-rsvp')).toContainText(/1\/\d+ 組/)
    await expect(page.getByTestId('vibe-dashboard-checkin')).toContainText('0/1 組')
    await expect(page.getByTestId('vibe-dashboard-gift')).toContainText('NT$ 0')
  })
})
