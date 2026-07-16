// Source: app/composables/useSeatingMath.ts slotCount（座位環格數，issue #90）
// Pattern: conditional-render——兒童椅與正常席共用座號池，座位環須為 capacity + 兒童椅張數
//   背景：只畫 capacity 格時兒童椅會吃掉正常席格子，座位環被填滿但大人容量還有剩，
//   使用者看到「0 空位」而誤判客滿（實際還排得進去）。空位數應恆等於剩餘正常席。
// mock seed：wedding-001 table-002 男方家屬桌 capacity 10、座位預設無人

import { expect, test } from '@playwright/test'

import { login, resetMockData, TestUsers } from '../helpers'

const SEATING_PATH = '/weddings/wedding-001/seating'
const TABLE = 'table-002' // 男方家屬桌 capacity 10（非主桌，座號即視覺位置）

function seatDots(page: import('@playwright/test').Page) {
  return page.locator(`[data-testid^="${TABLE}-empty-"], [data-testid^="${TABLE}-seat-"]`)
}
function emptyDots(page: import('@playwright/test').Page) {
  return page.locator(`[data-testid^="${TABLE}-empty-"]`)
}

// 造 n 組「1 大人 + 1 兒童椅」並排入該桌
async function seatGroupsWithChildChair(page: import('@playwright/test').Page, n: number) {
  const guests = await (await page.request.get('/api/v1/weddings/wedding-001/guests')).json()
  const picked = guests.filter((g: any) => !g.deletedAt).slice(0, n)
  for (const g of picked) {
    await page.request.patch(`/api/v1/weddings/wedding-001/guests/${g.guestId}`, {
      data: { partySize: 2, childChairCount: 1 },
    })
    const res = await page.request.post(`/api/v1/weddings/wedding-001/tables/${TABLE}/seats`, {
      data: { guestId: g.guestId, seatNumber: 1 },
    })
    expect(res.ok()).toBeTruthy()
  }
  return picked
}

test.beforeEach(async ({ page }) => {
  await resetMockData(page)
  await login(page, TestUsers.admin.account, TestUsers.admin.password)
})

test.describe('座位環格數：兒童椅不得吃掉正常席格子', () => {
  test('容量10 + 5 組「1大人+1兒童椅」：環為 15 格，空位 5（＝還可坐的大人數）', async ({ page }) => {
    await seatGroupsWithChildChair(page, 5)
    await page.goto(SEATING_PATH, { waitUntil: 'networkidle' })

    // 5 大人 + 5 兒童椅 → 環 = 10 + 5 = 15 格；空位 = 10 − 5 = 5
    await expect(seatDots(page)).toHaveCount(15)
    await expect(emptyDots(page)).toHaveCount(5)
  })

  test('空位數恆等於剩餘正常席：畫面說有空位，就真的排得進去', async ({ page }) => {
    await seatGroupsWithChildChair(page, 5)
    await page.goto(SEATING_PATH, { waitUntil: 'networkidle' })
    const empty = await emptyDots(page).count()

    // 畫面宣稱還有 empty 個空位 → 逐一排入純大人，應全部成功
    // 備用賓客需排除「已有座位」者（seats 為真實來源，賓客的 tableName 是 seed 欄位不反映實際排席）
    const allSeats = await (await page.request.get('/api/v1/weddings/wedding-001/seats')).json()
    const seatedIds = new Set(allSeats.map((s: any) => s.guestId))
    const guests = await (await page.request.get('/api/v1/weddings/wedding-001/guests')).json()
    const spare = guests.filter((g: any) => !g.deletedAt && !seatedIds.has(g.guestId)).slice(0, empty)
    expect(spare.length).toBe(empty)
    let seated = 0
    for (const g of spare) {
      await page.request.patch(`/api/v1/weddings/wedding-001/guests/${g.guestId}`, {
        data: { partySize: 1, childChairCount: 0 },
      })
      const res = await page.request.post(`/api/v1/weddings/wedding-001/tables/${TABLE}/seats`, {
        data: { guestId: g.guestId, seatNumber: 1 },
      })
      if (res.ok())
        seated++
    }
    expect(seated).toBe(spare.length)
  })

  test('無兒童椅時環維持 capacity 格（不因此次改動膨脹）', async ({ page }) => {
    await page.goto(SEATING_PATH, { waitUntil: 'networkidle' })
    await expect(seatDots(page)).toHaveCount(10)
    await expect(emptyDots(page)).toHaveCount(10)
  })
})
