// Source: server/middleware/auth.ts（婚禮範圍）+ 各資源 handler 綁定路徑 weddingId（issue #48）
// Pattern: security-authorization——已認證使用者不得以他場婚禮路徑存取本場資源（IDOR）；
//   公開投影牆只能取得賓客顯示名、不含 PII；公開自助 RSVP 需驗證輸入。
// gate 於 open 模式跑：page.request 無 token 會退回預設管理員（跨場放行），即模擬管理端登入態，
//   故「他場路徑存取本場資源」若仍成功即代表資源層未綁 weddingId（漏洞）；修正後應查無而 404。

import { expect, test } from '@playwright/test'

import { resetMockData } from '../helpers'

// OWN = 種子資源（guest-001／blessing-001／table-001…）所屬婚禮；
// OTHER = 另一場婚禮（不含這些資源）——以它的路徑存取上述 id 應查無。
const OWN = 'wedding-001'
const OTHER = 'wedding-002'

test.describe('vibe：多租戶授權邊界（issue #48）', () => {
  test.beforeEach(async ({ page }) => {
    await resetMockData(page)
  })

  test.describe('規則：不得以他場婚禮路徑存取本場資源', () => {
    test('刪除賓客：他場路徑 → 404，本場路徑 → 204（對照端點可用）', async ({ page }) => {
      const cross = await page.request.delete(`/api/v1/weddings/${OTHER}/guests/guest-001`)
      expect(cross.status()).toBe(404)
      const own = await page.request.delete(`/api/v1/weddings/${OWN}/guests/guest-001`)
      expect(own.status()).toBe(204)
    })

    test('登記禮金：他場路徑 → 404', async ({ page }) => {
      const res = await page.request.post(`/api/v1/weddings/${OTHER}/guests/guest-001/gift-money`, { data: { amount: 3600 } })
      expect(res.status()).toBe(404)
    })

    test('賓客報到：他場路徑 → 404', async ({ page }) => {
      const res = await page.request.post(`/api/v1/weddings/${OTHER}/guests/guest-001/check-in`)
      expect(res.status()).toBe(404)
    })

    test('審核祝福：他場路徑 → 404', async ({ page }) => {
      const res = await page.request.post(`/api/v1/weddings/${OTHER}/blessings/blessing-001/approve`)
      expect(res.status()).toBe(404)
    })

    test('更新桌次：他場路徑 → 404', async ({ page }) => {
      const res = await page.request.patch(`/api/v1/weddings/${OTHER}/tables/table-001`, { data: { capacity: 8 } })
      expect(res.status()).toBe(404)
    })

    test('刪除喜餅款式：他場路徑 → 404', async ({ page }) => {
      const res = await page.request.delete(`/api/v1/weddings/${OTHER}/cake-box-types/cakeboxtype-001`)
      expect(res.status()).toBe(404)
    })
  })

  test.describe('規則：公開投影牆只取得賓客顯示名、不含 PII', () => {
    test('display-names 每筆僅 guestId 與 name', async ({ page }) => {
      const res = await page.request.get(`/api/v1/weddings/${OWN}/guests/display-names`)
      expect(res.ok()).toBeTruthy()
      const rows = await res.json()
      expect(Array.isArray(rows)).toBeTruthy()
      expect(rows.length).toBeGreaterThan(0)
      // 不得夾帶電話／地址／備註／LINE userId 等 PII 欄位
      for (const row of rows) {
        expect(Object.keys(row).sort()).toEqual(['guestId', 'name'])
      }
    })
  })

  test.describe('規則：公開自助 RSVP 需驗證輸入', () => {
    // 公開回覆需姓名識別（issue #63）：合法輸入必含 guestName
    const base = { guestName: '對照賓客', attending: 'attending', diet: 'meat', plusOneCount: 0, childChairCount: 0 }

    test('同行人數非數字 → 400', async ({ page }) => {
      const res = await page.request.post(`/api/v1/weddings/${OWN}/guests/rsvp-public`, { data: { ...base, plusOneCount: 'x' } })
      expect(res.status()).toBe(400)
    })

    test('兒童椅為負數 → 400', async ({ page }) => {
      const res = await page.request.post(`/api/v1/weddings/${OWN}/guests/rsvp-public`, { data: { ...base, childChairCount: -1 } })
      expect(res.status()).toBe(400)
    })

    test('出席狀態非法 → 400', async ({ page }) => {
      const res = await page.request.post(`/api/v1/weddings/${OWN}/guests/rsvp-public`, { data: { ...base, attending: 'maybe' } })
      expect(res.status()).toBe(400)
    })

    test('缺姓名 → 400', async ({ page }) => {
      const res = await page.request.post(`/api/v1/weddings/${OWN}/guests/rsvp-public`, { data: { ...base, guestName: '  ' } })
      expect(res.status()).toBe(400)
    })

    test('合法輸入 → 201（對照）', async ({ page }) => {
      const res = await page.request.post(`/api/v1/weddings/${OWN}/guests/rsvp-public`, { data: base })
      expect(res.status()).toBe(201)
    })
  })
})
