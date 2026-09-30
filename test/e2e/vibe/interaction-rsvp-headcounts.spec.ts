import type { GuestListItem } from '../../../app/types/api/guests'
import { expect, test } from '@playwright/test'
import { login, resetMockData, selectOption, TestUsers } from '../helpers'

function guest(id: string, overrides: Partial<GuestListItem> = {}): GuestListItem {
  return {
    guestId: id,
    weddingId: 'wedding-001',
    name: id,
    side: 'bride',
    diet: 'meat',
    category: '',
    contact: '',
    childChairCount: 0,
    notes: null,
    lineUserId: null,
    rsvpAttending: 'attending',
    partySize: 1,
    deletedAt: null,
    ...overrides,
  }
}

test('用餐人頭含同行不含兒童椅，不出席置底且篩選與更新後維持一致', async ({ page }) => {
  await resetMockData(page)
  await login(page, TestUsers.admin.account, TestUsers.admin.password)
  let guests = [
    guest('declined-first', { rsvpAttending: 'declined', partySize: 10 }),
    guest('meat', { partySize: 4, childChairCount: 1 }),
    guest('pending', { rsvpAttending: null, partySize: 8 }),
    guest('declined-second', { rsvpAttending: 'declined', partySize: 6 }),
    guest('vegetarian', { diet: 'vegetarian', partySize: 2 }),
    guest('absent', { rsvpAttending: 'absent', partySize: 7 }),
    guest('deleted', { partySize: 9, deletedAt: '2026-09-30T00:00:00Z' }),
  ]
  await page.route('**/api/v1/weddings/wedding-001/guests?fields=full', route => route.fulfill({ json: guests }))
  // 由前端導航載入固定 API 資料，避免 SSR 請求繞過瀏覽器攔截。
  async function openRsvp() {
    await page.goto('/weddings/wedding-001', { waitUntil: 'networkidle' })
    await page.getByRole('button', { name: 'RSVP', exact: true }).click()
    await page.getByRole('link', { name: '回覆總覽' }).click()
    await expect(page.getByTestId('rsvp-list')).toBeVisible()
  }
  await openRsvp()
  const rows = page.getByTestId('rsvp-list').locator('tbody tr')
  const order = () => rows.evaluateAll(elements => elements.map(el => el.getAttribute('data-testid')))
  await expect(page.getByTestId('rsvp-stat-attending')).toContainText(/5\s*位/)
  await expect(page.getByTestId('rsvp-stat-attending')).toContainText('名單共 6 組')
  await expect(page.getByTestId('rsvp-stat-meat')).toHaveText('3 位')
  await expect(page.getByTestId('rsvp-stat-vegetarian')).toHaveText('2 位')
  await expect(page.getByTestId('rsvp-stat-child-chairs')).toHaveText('1')
  await expect(page.getByTestId('rsvp-row-meat').getByTestId('rsvp-confirmed-count')).toHaveText('4')
  expect(await order()).toEqual(['meat', 'pending', 'vegetarian', 'absent', 'declined-first', 'declined-second'].map(id => `rsvp-row-${id}`))
  const width = await page.getByTestId('rsvp-attend-bar').locator('div').first().evaluate(el => (el as HTMLElement).style.width)
  expect(Number.parseFloat(width)).toBeCloseTo(100 / 3)
  await selectOption(page, 'rsvp-diet-filter', '葷食')
  expect(await order()).toEqual(['meat', 'pending', 'absent', 'declined-first', 'declined-second'].map(id => `rsvp-row-${id}`))

  guests[1] = guest('meat', { rsvpAttending: 'declined', partySize: 4, childChairCount: 1 })
  guests[0] = guest('declined-first', { diet: 'vegetarian', partySize: 5, childChairCount: 2 })
  await openRsvp()
  await expect(page.getByTestId('rsvp-stat-attending')).toContainText(/5\s*位/)
  await expect(page.getByTestId('rsvp-stat-meat')).toHaveText('0 位')
  await expect(page.getByTestId('rsvp-stat-vegetarian')).toHaveText('5 位')
  await expect(page.getByTestId('rsvp-stat-child-chairs')).toHaveText('2')
  expect(await order()).toEqual(['declined-first', 'pending', 'vegetarian', 'absent', 'meat', 'declined-second'].map(id => `rsvp-row-${id}`))

  guests = []
  await openRsvp()
  await expect(page.getByTestId('rsvp-stat-attending')).toContainText(/0\s*位/)
  await expect(rows.locator('td')).toHaveAttribute('colspan', '11')
  await expect(page.getByTestId('rsvp-attend-bar').locator('div').first()).toHaveAttribute('style', 'width: 0%;')
})
