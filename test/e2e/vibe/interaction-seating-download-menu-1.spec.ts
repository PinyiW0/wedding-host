// Source: app/composables/useSeatingChartExport.ts + app/pages/weddings/[weddingId]/seating.vue（下載桌次圖，issue #101）
// Pattern: menu（互動：下拉兩組——備餐地圖 / 賓客名單，各含 JPEG / PDF）+ 下載事件
// 新增「賓客名單」版本（圈內列賓客姓名）不取代既有「備餐地圖」版本；此處驗證兩組並存且名單版可觸發下載

import { expect, test } from '@playwright/test'

import { login, resetMockData, TestUsers } from '../helpers'

const SEATING_URL = '/weddings/wedding-001/seating'

test.beforeEach(async ({ page }) => {
  await resetMockData(page)
  await login(page, TestUsers.admin.account, TestUsers.admin.password)
  await page.goto(SEATING_URL, { waitUntil: 'networkidle' })
})

test.describe('vibe：下載桌次圖（備餐地圖 + 賓客名單兩版本）', () => {
  test('下拉同時提供備餐地圖與賓客名單兩組', async ({ page }) => {
    await page.getByTestId('vibe-seating-download').click()
    await expect(page.getByRole('menuitem', { name: '備餐地圖 · JPEG' })).toBeVisible()
    await expect(page.getByRole('menuitem', { name: '備餐地圖 · PDF' })).toBeVisible()
    await expect(page.getByRole('menuitem', { name: '賓客名單 · JPEG' })).toBeVisible()
    await expect(page.getByRole('menuitem', { name: '賓客名單 · PDF' })).toBeVisible()
  })

  test('選「賓客名單 · JPEG」觸發桌位示意圖下載', async ({ page }) => {
    await page.getByTestId('vibe-seating-download').click()
    const download = page.waitForEvent('download')
    await page.getByRole('menuitem', { name: '賓客名單 · JPEG' }).click()
    const file = await download
    expect(file.suggestedFilename()).toContain('桌位示意圖')
  })
})
