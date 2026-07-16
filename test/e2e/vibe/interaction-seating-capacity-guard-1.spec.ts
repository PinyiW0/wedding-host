// Source: server/api/v1/weddings/[weddingId]/tables/[tableId]/index.patch.ts（座位數守門，issue #90）
// Pattern: error——調降座位數低於已排席人頭時擋下並說明原因
//   背景：04-seating.flow.md Invariant 5「正常席人頭不可超過 capacity」入座端點有守，
//   但調降 capacity 是另一條破壞路徑；放行會讓後端存新值、座位環仍以最大座號撐開
//   （useSeatingMath.slotCount 取 max(capacity, maxSeat)），使用者只看到「減少沒反應」。
// mock seed：wedding-001 table-001 主桌 capacity 12、座位預設無人

import { expect, test } from '@playwright/test'

import { login, resetMockData, TestUsers } from '../helpers'

const SEATING_PATH = '/weddings/wedding-001/seating'

// 座位環圓點數（空位 + 已入座）
function seatDots(page: import('@playwright/test').Page) {
  return page.locator('[data-testid^="table-001-empty-"], [data-testid^="table-001-seat-"]')
}

// 等桌次更新完成（等 response，避免斷言早於寫入）
function waitTablePatch(page: import('@playwright/test').Page, ok: boolean) {
  return page.waitForResponse(res =>
    /\/tables\/table-001(?:\?|$)/.test(res.url())
    && res.request().method() === 'PATCH' && res.ok() === ok)
}

async function submitCapacity(page: import('@playwright/test').Page, value: number) {
  await page.getByTestId('table-row-table-001').getByTestId('table-edit').click()
  await page.getByTestId('table-capacity').fill(String(value))
  await page.getByTestId('table-submit').click()
}

// 把主桌排滿到 10 個正常席（賓客組會依人數展開多席位）
async function fillMainTable(page: import('@playwright/test').Page) {
  const guests = await (await page.request.get('/api/v1/weddings/wedding-001/guests')).json()
  for (const g of guests.filter((x: any) => !x.deletedAt)) {
    const res = await page.request.post('/api/v1/weddings/wedding-001/tables/table-001/seats', {
      data: { guestId: g.guestId, seatNumber: 1 },
    })
    if (!res.ok())
      break
  }
  const seats = await (await page.request.get('/api/v1/weddings/wedding-001/seats')).json()
  return seats.filter((s: any) => s.tableId === 'table-001' && s.seatType === 'normal').length
}

test.beforeEach(async ({ page }) => {
  await resetMockData(page)
  await login(page, TestUsers.admin.account, TestUsers.admin.password)
})

test.describe('座位數調降守門（有人入座時）', () => {
  test('調降到低於已排席人數：擋下並說明原因，容量不變', async ({ page }) => {
    // Given：主桌已排席 N 個正常席
    const seated = await fillMainTable(page)
    expect(seated).toBeGreaterThan(0)
    await page.goto(SEATING_PATH, { waitUntil: 'networkidle' })

    // When：把座位數調降到已排席人數以下
    await submitCapacity(page, seated - 1)
    await waitTablePatch(page, false)

    // Then：使用者看到具體原因（含人數），容量未被改動
    await expect(page.getByTestId('table-error')).toContainText(`座位數不可小於此桌已排席人數（${seated} 人）`)
    const tables = await (await page.request.get('/api/v1/weddings/wedding-001/tables')).json()
    expect(tables.find((t: any) => t.tableId === 'table-001').capacity).toBe(12)
  })

  test('調降到等於已排席人數：成功且座位環跟著縮小', async ({ page }) => {
    // Given：主桌已排席 N 個正常席（seed capacity 12 > N）
    const seated = await fillMainTable(page)
    await page.goto(SEATING_PATH, { waitUntil: 'networkidle' })
    await expect(seatDots(page)).toHaveCount(12)

    // When：把座位數調降到剛好等於已排席人數
    await submitCapacity(page, seated)
    await waitTablePatch(page, true)

    // Then：座位環跟著縮小到新容量（減少有反應，不再被最大座號撐住）
    await expect(seatDots(page)).toHaveCount(seated)
  })

  test('增加座位數：座位環跟著變大', async ({ page }) => {
    await fillMainTable(page)
    await page.goto(SEATING_PATH, { waitUntil: 'networkidle' })

    await submitCapacity(page, 16)
    await waitTablePatch(page, true)

    await expect(seatDots(page)).toHaveCount(16)
  })
})
