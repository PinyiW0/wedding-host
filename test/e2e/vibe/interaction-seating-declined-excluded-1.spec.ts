// Source: app/composables/useSeatingMath.ts（seatableGuests）+ server rsvp / rsvp-override / seats 端點（issue #96）
// Pattern: conditional-render + error——RSVP 婉拒者不進排桌次：
//   側欄待排席不出現婉拒者、入座 API 擋下婉拒者、已入座後才婉拒（含管理員代改）自動釋放座位
// mock seed：wedding-001 guest-001（陳大明）/ guest-002（林美麗）皆未提交 RSVP；seats 預設無人入座

import { expect, test } from '@playwright/test'

import { login, resetMockData, TestUsers } from '../helpers'

const SEATING_PATH = '/weddings/wedding-001/seating'
const API = '/api/v1/weddings/wedding-001'

// 賓客透過 RSVP 回覆不參加
function declineRsvp(page: import('@playwright/test').Page, guestId: string) {
  return page.request.post(`${API}/guests/${guestId}/rsvp`, {
    data: { attending: 'declined', diet: 'meat', plusOneCount: 0, childChairCount: 0 },
  })
}

async function guestSeats(page: import('@playwright/test').Page, guestId: string) {
  const seats = await (await page.request.get(`${API}/seats`)).json()
  return seats.filter((s: { guestId: string }) => s.guestId === guestId)
}

test.beforeEach(async ({ page }) => {
  await resetMockData(page)
  await login(page, TestUsers.admin.account, TestUsers.admin.password)
})

test.describe('婉拒者不進排桌次（issue #96）', () => {
  test('RSVP 婉拒後：待排席側欄不出現該賓客', async ({ page }) => {
    // Given：guest-001 透過 RSVP 回覆不參加
    const rsvp = await declineRsvp(page, 'guest-001')
    expect(rsvp.ok()).toBeTruthy()

    // When：進入座位安排頁
    await page.goto(SEATING_PATH, { waitUntil: 'networkidle' })

    // Then：側欄看不到婉拒者，其他未回覆賓客仍在待排席
    await expect(page.getByTestId('vibe-seating-guest-guest-002')).toBeVisible()
    await expect(page.getByTestId('vibe-seating-guest-guest-001')).toHaveCount(0)
  })

  test('婉拒者無法透過入座 API 安排座位', async ({ page }) => {
    // Given：guest-001 已婉拒
    await declineRsvp(page, 'guest-001')

    // When：直接以 API 將其安排入座
    const res = await page.request.post(`${API}/tables/table-001/seats`, {
      data: { guestId: 'guest-001', seatNumber: 1 },
    })

    // Then：被擋下並說明原因
    expect(res.status()).toBe(409)
    expect(JSON.stringify(await res.json())).toContain('已婉拒')
  })

  test('已入座後才婉拒：座位自動釋放', async ({ page }) => {
    // Given：guest-001 已入座 table-001
    const seated = await page.request.post(`${API}/tables/table-001/seats`, {
      data: { guestId: 'guest-001', seatNumber: 1 },
    })
    expect(seated.ok()).toBeTruthy()

    // When：guest-001 透過 RSVP 回覆不參加
    const rsvp = await declineRsvp(page, 'guest-001')
    expect(rsvp.ok()).toBeTruthy()

    // Then：座位已被釋放
    expect(await guestSeats(page, 'guest-001')).toHaveLength(0)
  })

  test('管理員代改為婉拒：同樣釋放座位', async ({ page }) => {
    // Given：guest-002 已入座 table-002
    const seated = await page.request.post(`${API}/tables/table-002/seats`, {
      data: { guestId: 'guest-002', seatNumber: 1 },
    })
    expect(seated.ok()).toBeTruthy()

    // When：管理員將 guest-002 的出席狀態代改為婉拒
    const res = await page.request.post(`${API}/guests/guest-002/rsvp-override`, {
      data: { attending: 'declined', reason: '電話確認不出席' },
    })
    expect(res.ok()).toBeTruthy()

    // Then：座位已被釋放
    expect(await guestSeats(page, 'guest-002')).toHaveLength(0)
  })
})
