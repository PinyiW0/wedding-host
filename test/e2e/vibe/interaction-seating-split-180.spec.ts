import type { APIRequestContext } from '@playwright/test'
import { expect, test } from '@playwright/test'
import { login, resetMockData, TestUsers } from '../helpers'

const base = '/api/v1/weddings/wedding-001'
async function addGuest(request: APIRequestContext, name: string, partySize: number, diet = 'meat', childChairCount = 0) {
  const res = await request.post(`${base}/guests`, { data: { name, partySize, diet, childChairCount, side: 'groom', category: '', contact: '' } })
  expect(res.ok(), await res.text()).toBe(true)
  return (await res.json()).guestId as string
}
async function seat(request: APIRequestContext, tableId: string, guestId: string) {
  return request.post(`${base}/tables/${tableId}/seats`, { data: { guestId, seatNumber: 1 } })
}
async function allSeats(request: APIRequestContext) {
  return (await request.get(`${base}/seats`)).json()
}

test.beforeEach(async ({ page }) => {
  await resetMockData(page)
})

test('五人拆分、取消一人回列表、重新拖入後仍僅五席，重整保留', async ({ page }) => {
  const g = await addGuest(page.request, '拆分回歸', 5)
  expect((await seat(page.request, 'table-002', g)).ok()).toBe(true)
  expect((await page.request.post(`${base}/seats/move`, { data: { fromTableId: 'table-002', fromSeatNumber: 3, toTableId: 'table-001', toSeatNumber: 1 } })).ok()).toBe(true)
  await login(page, TestUsers.admin.account, TestUsers.admin.password)
  await page.goto('/weddings/wedding-001/seating', { waitUntil: 'networkidle' })
  await page.getByTestId('table-001-seat-1').click()
  await page.getByTestId('confirm-ok').click()
  const pending = page.getByTestId(`vibe-seating-guest-${g}`)
  await expect(pending).toContainText('待排 1 人')
  expect((await allSeats(page.request)).filter((s: any) => s.guestId === g)).toHaveLength(4)
  await page.reload({ waitUntil: 'networkidle' })
  await expect(pending).toContainText('待排 1 人')
  await pending.dragTo(page.getByTestId('table-001-empty-1'))
  await expect(pending).toHaveCount(0)
  await page.reload({ waitUntil: 'networkidle' })
  const actual = (await allSeats(page.request)).filter((s: any) => s.guestId === g)
  expect(actual).toHaveLength(5)
  expect(actual.filter((s: any) => s.tableId === 'table-002')).toHaveLength(4)
  expect(actual.find((s: any) => s.tableId === 'table-001').partyIndex).toBe(3)
  expect(new Set(actual.map((s: any) => `${s.seatType}:${s.partyIndex}`)).size).toBe(5)
  // 同桌有四人時取消單席也只能移除指定成員。
  expect((await page.request.delete(`${base}/tables/table-002/seats/${g}?seatNumber=2`)).status()).toBe(204)
  expect((await allSeats(page.request)).filter((s: any) => s.guestId === g)).toHaveLength(4)
})

test('正常席交換兒童椅會使來源桌超額時拒絕，兩桌保持原狀', async ({ page }) => {
  const a = await addGuest(page.request, '滿桌附兒椅', 11, 'meat', 1)
  const b = await addGuest(page.request, '另一桌', 1)
  expect((await seat(page.request, 'table-002', a)).ok()).toBe(true)
  expect((await seat(page.request, 'table-003', b)).ok()).toBe(true)
  const before = await allSeats(page.request)
  const res = await page.request.post(`${base}/seats/move`, { data: { fromTableId: 'table-002', fromSeatNumber: 11, toTableId: 'table-003', toSeatNumber: 1 } })
  expect(res.status()).toBe(409)
  expect(await allSeats(page.request)).toEqual(before)
  // 正常席互換可成功；交換完只有一筆占用各座號。
  expect((await page.request.post(`${base}/seats/move`, { data: { fromTableId: 'table-002', fromSeatNumber: 1, toTableId: 'table-003', toSeatNumber: 1 } })).ok()).toBe(true)
  const swapped = await allSeats(page.request)
  expect(swapped.find((s: any) => s.tableId === 'table-002' && s.seatNumber === 1).guestId).toBe(b)
  expect(swapped.find((s: any) => s.tableId === 'table-003' && s.seatNumber === 1).guestId).toBe(a)
})

test('混合桌素食不計席、全素桌計席，取消最後葷食者需檢查容量', async ({ page }) => {
  const meat = await addGuest(page.request, '十葷', 10)
  const veg = await addGuest(page.request, '十一素', 11, 'vegetarian')
  const extra = await addGuest(page.request, '額外葷', 1)
  expect((await seat(page.request, 'table-002', meat)).ok()).toBe(true)
  expect((await seat(page.request, 'table-002', veg)).ok()).toBe(true)
  expect((await seat(page.request, 'table-002', extra)).status()).toBe(409)
  const before = await allSeats(page.request)
  expect((await page.request.delete(`${base}/tables/table-002/seats/${meat}`)).status()).toBe(409)
  expect(await allSeats(page.request)).toEqual(before)
  // 調降容量亦共用計席規則：10 葷＋11 素可以維持 10 席。
  expect((await page.request.patch(`${base}/tables/table-002`, { data: { capacity: 10 } })).ok()).toBe(true)
  expect((await page.request.patch(`${base}/tables/table-002`, { data: { capacity: 9 } })).status()).toBe(409)
  const tenVeg = await addGuest(page.request, '十素', 10, 'vegetarian')
  const oneVeg = await addGuest(page.request, '多一素', 1, 'vegetarian')
  expect((await seat(page.request, 'table-003', tenVeg)).ok()).toBe(true)
  expect((await seat(page.request, 'table-003', oneVeg)).status()).toBe(409)
})

test('素食綠色、兒童椅紅色，額外席位與實際人數顯示正確', async ({ page }) => {
  const meat = await addGuest(page.request, '十葷', 10)
  const veg = await addGuest(page.request, '素食親子', 3, 'vegetarian', 1)
  expect((await seat(page.request, 'table-002', meat)).ok()).toBe(true)
  expect((await seat(page.request, 'table-002', veg)).ok()).toBe(true)
  await login(page, TestUsers.admin.account, TestUsers.admin.password)
  await page.goto('/weddings/wedding-001/seating', { waitUntil: 'networkidle' })
  await expect(page.getByTestId('table-002-seat-11')).toHaveClass(/border-success-600/)
  await expect(page.getByTestId('table-002-seat-13')).toHaveClass(/border-error-600/)
  await expect(page.getByTestId('table-002-seat-13')).toContainText('素')
  await expect(page.locator('[data-testid^="table-002-seat-"]')).toHaveCount(13)
  await expect(page.locator('[data-testid^="table-002-empty-"]')).toHaveCount(0)
  await expect(page.getByText('實際 13 人', { exact: true })).toBeVisible()
})

test('移走最後葷食者與交換後全素超額都拒絕；整桌重置可完成', async ({ page }) => {
  const meat = await addGuest(page.request, '最後葷食者', 1)
  const veg = await addGuest(page.request, '十一素', 11, 'vegetarian')
  const target = await addGuest(page.request, '另一桌素食', 1, 'vegetarian')
  expect((await seat(page.request, 'table-002', meat)).ok()).toBe(true)
  expect((await seat(page.request, 'table-002', veg)).ok()).toBe(true)
  expect((await seat(page.request, 'table-003', target)).ok()).toBe(true)
  const before = await allSeats(page.request)
  for (const toSeatNumber of [1, 2]) {
    const res = await page.request.post(`${base}/seats/move`, { data: { fromTableId: 'table-002', fromSeatNumber: 1, toTableId: 'table-003', toSeatNumber } })
    expect(res.status()).toBe(409)
    expect(await allSeats(page.request)).toEqual(before)
  }
  expect((await page.request.delete(`${base}/tables/table-002/seats/${meat}?seatNumber=1`)).status()).toBe(409)
  await login(page, TestUsers.admin.account, TestUsers.admin.password)
  await page.goto('/weddings/wedding-001/seating', { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: '重置排位 男方家屬桌', exact: true }).click()
  await page.getByTestId('confirm-ok').click()
  await expect(page.locator('[data-testid^="table-002-seat-"]')).toHaveCount(0)
  expect((await allSeats(page.request)).filter((s: any) => s.tableId === 'table-003')).toHaveLength(1)
})

test('推薦排序僅補回拆分後待排成員，一鍵取消後全部回列表', async ({ page }) => {
  const g = await addGuest(page.request, '推薦補位', 5)
  expect((await seat(page.request, 'table-002', g)).ok()).toBe(true)
  expect((await page.request.delete(`${base}/tables/table-002/seats/${g}?seatNumber=3`)).status()).toBe(204)
  await login(page, TestUsers.admin.account, TestUsers.admin.password)
  await page.goto('/weddings/wedding-001/seating', { waitUntil: 'networkidle' })
  await expect(page.getByTestId(`vibe-seating-guest-${g}`)).toContainText('待排 1 人')
  await page.getByTestId('vibe-seating-recommend').click()
  await expect(page.getByTestId(`vibe-seating-guest-${g}`)).toHaveCount(0)
  const actual = (await allSeats(page.request)).filter((s: any) => s.guestId === g)
  expect(actual).toHaveLength(5)
  expect(actual.filter((s: any) => s.partyIndex !== 3).every((s: any) => s.tableId === 'table-002')).toBe(true)
  await page.getByTestId('vibe-seating-clear').click()
  await page.getByTestId('confirm-ok').click()
  await expect(page.getByTestId(`vibe-seating-guest-${g}`)).toContainText('待排 5 人')
  expect(await allSeats(page.request)).toHaveLength(0)
})
