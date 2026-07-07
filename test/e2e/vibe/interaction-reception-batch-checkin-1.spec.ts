// Source: app/pages/reception/index.vue（批量報到 + 報到桌次大字回饋，issue #25）
// Pattern: multi-select——多選模式勾選多組一鍵報到（沿用單筆 check-in 端點逐筆呼叫）
// mock seed：wedding-001 全員未報到；guest-001 陳大明（主桌）、guest-002 林美麗（女方家屬桌）、
//            guest-005 張文彬（tableName null → 未排桌）；無入座資料，桌次回饋走 tableName fallback

import { expect, test } from '@playwright/test'

import { findEntity, login, resetMockData, TestUsers } from '../helpers'

const RECEPTION_PATH = '/reception?weddingId=wedding-001'

function waitCheckInDone(page: import('@playwright/test').Page, guestId: string) {
  return page.waitForResponse(res =>
    new RegExp(`/guests/${guestId}/check-in(?:\\?|$)`).test(res.url())
      && res.request().method() === 'POST' && res.ok())
}

test.describe('vibe：接待批量報到', () => {
  test.beforeEach(async ({ page }) => {
    await resetMockData(page)
    await login(page, TestUsers.receptionist.account, TestUsers.receptionist.password)
    await page.goto(RECEPTION_PATH, { waitUntil: 'networkidle' })
  })

  test('多選兩組一鍵報到：逐筆打 check-in、卡片轉已報到、桌次回饋列出各組', async ({ page }) => {
    await page.getByTestId('vibe-batch-toggle').click()
    await page.getByTestId('vibe-batch-tick-guest-001').click()
    await page.getByTestId('vibe-batch-tick-guest-002').click()

    const done = Promise.all([
      waitCheckInDone(page, 'guest-001'),
      waitCheckInDone(page, 'guest-002'),
    ])
    await page.getByTestId('vibe-batch-checkin').click()
    await done

    await expect(findEntity(page, /陳大明/).getByText(/已報到/)).toBeVisible()
    await expect(findEntity(page, /林美麗/).getByText(/已報到/)).toBeVisible()

    // 大字桌次回饋：每組一列（姓名 — 桌次）
    const banner = page.getByTestId('vibe-checkin-table-banner')
    await expect(banner).toContainText('陳大明')
    await expect(banner).toContainText('主桌')
    await expect(banner).toContainText('林美麗')
    await expect(banner).toContainText('女方家屬桌')
  })

  test('全選未報到：以搜尋範圍為準；未排桌者回饋顯示「未排桌」', async ({ page }) => {
    await page.getByTestId('vibe-reception-search').fill('張文彬')
    await page.getByTestId('vibe-batch-toggle').click()
    await page.getByTestId('vibe-batch-select-all').click()
    await expect(page.getByTestId('vibe-batch-checkin')).toContainText('報到 1 組')

    const done = waitCheckInDone(page, 'guest-005')
    await page.getByTestId('vibe-batch-checkin').click()
    await done

    const banner = page.getByTestId('vibe-checkin-table-banner')
    await expect(banner).toContainText('張文彬')
    await expect(banner).toContainText('未排桌')
  })

  test('單筆報到亦有大字桌次回饋', async ({ page }) => {
    const done = waitCheckInDone(page, 'guest-001')
    await findEntity(page, /陳大明/).getByRole('button', { name: /報到/ }).click()
    await done

    const banner = page.getByTestId('vibe-checkin-table-banner')
    await expect(banner).toContainText('陳大明')
    await expect(banner).toContainText('主桌')
  })

  test('取消多選：勾選清空且不觸發報到', async ({ page }) => {
    await page.getByTestId('vibe-batch-toggle').click()
    await page.getByTestId('vibe-batch-tick-guest-001').click()
    await page.getByTestId('vibe-batch-toggle').click()

    // 工具列收起、卡片維持未報到
    await expect(page.getByTestId('vibe-batch-toolbar')).toHaveCount(0)
    await expect(findEntity(page, /陳大明/).getByText(/未報到/)).toBeVisible()
  })
})
