import { expect, test } from '@playwright/test'
import { login, resetMockData, TestUsers } from '../helpers'

const base = '/api/v1/weddings/wedding-001'
const reply = { attending: 'declined', diet: 'meat', plusOneCount: 0, childChairCount: 0 }

test.beforeEach(async ({ page }) => {
  await resetMockData(page)
  await login(page, TestUsers.admin.account, TestUsers.admin.password)
})

test('不出席預設不發放，重整保留且可人工改回發放', async ({ page }) => {
  expect((await page.request.post(`${base}/guests/guest-001/rsvp`, { data: reply })).ok()).toBeTruthy()
  await page.goto('/weddings/wedding-001/cake-box', { waitUntil: 'networkidle' })
  await expect(page.getByTestId('vibe-row-style-guest-001')).toContainText('不發放')
  await page.reload({ waitUntil: 'networkidle' })
  await expect(page.getByTestId('vibe-row-style-guest-001')).toContainText('不發放')
  // 管理員仍可決定寄送喜餅；重送相同 RSVP 不覆蓋人工選擇。
  expect((await page.request.delete(`${base}/cake-box-exclusions/guest-001`)).ok()).toBeTruthy()
  expect((await page.request.post(`${base}/guests/guest-001/rsvp`, { data: reply })).ok()).toBeTruthy()
  const exclusions = await (await page.request.get(`${base}/cake-box-exclusions`)).json()
  expect(exclusions.some((g: any) => g.guestId === 'guest-001')).toBe(false)
})

test('管理員覆寫、公開回覆與合併名單均套用不發放預設', async ({ page }) => {
  expect((await page.request.post(`${base}/guests/guest-001/rsvp-override`, {
    data: { attending: 'declined', reason: '電話確認' },
  })).ok()).toBeTruthy()
  const response = await page.request.post(`${base}/guests/rsvp-public`, {
    data: { ...reply, guestName: '不出席測試', relationship: 'bride' },
  })
  expect(response.ok()).toBeTruthy()
  const { guestId } = await response.json()
  let exclusions = await (await page.request.get(`${base}/cake-box-exclusions`)).json()
  expect(exclusions.map((g: any) => g.guestId)).toEqual(expect.arrayContaining(['guest-001', guestId]))
  expect((await page.request.post(`${base}/pending-guests/${guestId}/merge`, {
    data: { targetGuestId: 'guest-003' },
  })).ok()).toBeTruthy()
  exclusions = await (await page.request.get(`${base}/cake-box-exclusions`)).json()
  expect(exclusions.some((g: any) => g.guestId === 'guest-003')).toBe(true)
  // 不出席者切換男方親屬分類後，排除狀態也應保留。
  for (const side of ['groom', 'bride']) {
    expect((await page.request.patch(`${base}/guests/guest-003`, {
      data: { side, category: '親戚' },
    })).ok()).toBeTruthy()
  }
  exclusions = await (await page.request.get(`${base}/cake-box-exclusions`)).json()
  expect(exclusions.some((g: any) => g.guestId === 'guest-003')).toBe(true)
})
