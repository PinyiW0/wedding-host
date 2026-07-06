// Source: app/composables/useCurrentWedding.ts（側欄情境標頭殘留修復）
// Pattern: conditional-render——離開婚禮後 SPA 導航回「所有婚禮」，標頭須恢復平台預設而非停在上一場婚禮

import { expect, test } from '@playwright/test'

import { login, resetMockData, TestUsers } from '../helpers'

// mock seed：wedding-002＝張志豪與陳怡君的婚禮（台中林酒店）
test.describe('vibe：側欄婚禮情境標頭', () => {
  test.beforeEach(async ({ page }) => {
    await resetMockData(page)
    await login(page, TestUsers.admin.account, TestUsers.admin.password)
  })

  test('離開婚禮回「所有婚禮」：標頭恢復平台預設，不殘留上一場婚禮', async ({ page }) => {
    // 先進入 wedding-002，標頭顯示該場婚禮
    await page.goto('/weddings/wedding-002', { waitUntil: 'networkidle' })
    const context = page.getByTestId('vibe-wedding-context')
    await expect(context).toContainText('張志豪與陳怡君的婚禮')

    // SPA 導航回所有婚禮（同一 layout 實例，殘留資料在此曝露）
    await page.getByTestId('vibe-sidebar').getByText('所有婚禮').click()
    await page.waitForURL(url => url.pathname === '/weddings')

    await expect(context).toContainText('EverAfter')
    await expect(context).not.toContainText('張志豪與陳怡君的婚禮')
  })
})
