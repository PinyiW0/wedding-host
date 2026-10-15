import { expect, test } from '@playwright/test'
import { login, resetMockData, TestUsers } from '../helpers'

const base = '/api/v1/weddings/wedding-001'

test('其他頁面修改同行人數後，回到桌次頁同步賓客人數及座位', async ({ page }) => {
  await resetMockData(page)
  await login(page, TestUsers.admin.account, TestUsers.admin.password)
  const created = await page.request.post(`${base}/guests`, {
    data: { name: '人數同步回歸', side: 'groom', diet: 'meat', partySize: 2, childChairCount: 0, category: '', contact: '' },
  })
  expect(created.ok()).toBe(true)
  const { guestId } = await created.json()
  await page.goto('/weddings/wedding-001/seating', { waitUntil: 'networkidle' })
  const pending = page.getByTestId(`vibe-seating-guest-${guestId}`)
  await expect(pending).toContainText('待排 2 人')

  // 模擬另一頁已完成寫入，再切回這個仍開著的桌次分頁。
  expect((await page.request.patch(`${base}/guests/${guestId}`, { data: { partySize: 4 } })).ok()).toBe(true)
  await page.evaluate(() => window.dispatchEvent(new Event('focus')))
  await expect(pending).toContainText('待排 4 人')
  await pending.click()
  await page.getByTestId('table-002-empty-1').click()
  await expect(pending).toHaveCount(0)
  await expect(page.locator('[data-testid^="table-002-seat-"]')).toHaveCount(4)

  // 已排席的組別改人數，座位及待排狀態也一併更新。
  expect((await page.request.patch(`${base}/guests/${guestId}`, { data: { partySize: 3 } })).ok()).toBe(true)
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')))
  await expect(page.locator('[data-testid^="table-002-seat-"]')).toHaveCount(3)
  await expect(pending).toHaveCount(0)
})
