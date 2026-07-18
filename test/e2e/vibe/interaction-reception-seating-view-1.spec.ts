// Source: app/pages/reception/index.vue（現場桌次圖：每桌報到率環 + 桌次圖/桌次清單檢視切換，issue #101）
// Pattern: tab（互動：切換桌次圖 ↔ 桌次清單）+ 資料視覺化（報到率環，分母＝席位人頭）
// setup：admin 以 seat API 先讓 guest-001 入座 table-002 並報到、guest-002 入座 table-003 未報到，
//        據此驗證「已報到桌顯示非零報到率環」「未報到桌報到率 0」「清單檢視列出賓客與已報到數」

import { expect, test } from '@playwright/test'

import { login, resetMockData, TestUsers } from '../helpers'

const RECEPTION_PATH = '/reception?weddingId=wedding-001'

async function seatGuest(page: import('@playwright/test').Page, tableId: string, guestId: string) {
  const res = await page.request.post(
    `/api/v1/weddings/wedding-001/tables/${tableId}/seats`,
    { data: { guestId, seatNumber: 1 } },
  )
  expect(res.ok()).toBeTruthy()
}

test.describe('vibe：現場桌次圖報到率環 + 桌次清單檢視', () => {
  test.beforeEach(async ({ page }) => {
    await resetMockData(page)
    await login(page, TestUsers.admin.account, TestUsers.admin.password)
    // guest-001 入座 table-002 並報到；guest-002 入座 table-003 未報到
    await seatGuest(page, 'table-002', 'guest-001')
    await seatGuest(page, 'table-003', 'guest-002')
    const checkIn = await page.request.post('/api/v1/weddings/wedding-001/guests/guest-001/check-in')
    expect(checkIn.ok()).toBeTruthy()
    await page.goto(RECEPTION_PATH, { waitUntil: 'networkidle' })
  })

  test('桌次圖檢視：已報到桌畫出報到率環與非零報到數、未報到桌報到率為 0', async ({ page }) => {
    // 預設即桌次圖檢視
    await expect(page.getByTestId('vibe-reception-floor-plan')).toBeVisible()

    // table-002：guest-001 已報到 → 報到數非零 + 環（svg）存在
    const seatedTable = page.getByTestId('vibe-reception-table-table-002')
    await expect(seatedTable).toContainText(/報到 [1-9]/)
    await expect(seatedTable.locator('svg')).toBeVisible()

    // table-003：guest-002 未報到 → 報到率 0
    await expect(page.getByTestId('vibe-reception-table-table-003')).toContainText(/報到 0\//)
  })

  test('切到桌次清單檢視：逐桌列出賓客與已報到數，可切回桌次圖', async ({ page }) => {
    await page.getByRole('tab', { name: '桌次清單' }).click()

    const list = page.getByTestId('vibe-reception-list')
    await expect(list).toBeVisible()

    // 已報到桌：列出賓客姓名 + 已報到數非零
    const listedTable = page.getByTestId('vibe-reception-list-table-table-002')
    await expect(listedTable).toContainText('陳大明')
    await expect(listedTable).toContainText(/已報到 [1-9]/)

    // 切回桌次圖：平面圖重新可見
    await page.getByRole('tab', { name: '桌次圖' }).click()
    await expect(page.getByTestId('vibe-reception-floor-plan')).toBeVisible()
  })
})
