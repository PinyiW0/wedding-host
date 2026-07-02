import { expect, test } from '@playwright/test'

import {
  getFeedbackElement,
  login,
  resetMockData,
  TestUsers,
  waitForApiCall,
} from '../helpers'

// 對應 spec/e2e-flows/12-pending-guests.flow.md（公開自助 RSVP + 待確認區人工處理）
// Feature Background：
//   - 公開回覆：賓客端不需登入，建立 status='pending_review' 待確認賓客
//   - 待確認處理：已登入為管理員（Admin）
// mock seed：wedding-001、guest-001（陳大明 / 手機 0912345678）

// 建立一筆待確認賓客（沿用公開提交端點），回傳 guestId
async function seedPending(
  request: import('@playwright/test').APIRequestContext,
  data: Record<string, unknown>,
) {
  const res = await request.post('/api/v1/weddings/wedding-001/guests/rsvp-public', { data })
  expect(res.ok()).toBeTruthy()
  return (await res.json()).guestId as string
}

// === Guest 端：公開自助回覆（不需登入） ===
test.describe('公開自助 RSVP（Guest 端）', () => {
  test.beforeEach(async ({ page }) => {
    await resetMockData(page)
  })

  test.describe('規則：成功公開回覆', () => {
    test('公開自助回覆建立待確認賓客', async ({ page }) => {
      await page.goto('/rsvp/public/wedding-001', { waitUntil: 'networkidle' })

      // 填寫姓名與手機
      await page.getByLabel(/大名/).fill('王小明')
      await page.getByLabel(/聯繫電話/).fill('0912345678')

      // 主要 outcome：API spy 驗證 POST rsvp-public
      const apiCall = waitForApiCall(page, /\/guests\/rsvp-public(\?|$)/, 'POST')
      await page.getByRole('button', { name: /送出|提交|確定/ }).click()
      const request = await apiCall
      expect(request.postDataJSON()).toMatchObject({ guestName: '王小明' })

      // Then：提交成功反饋
      await expect(getFeedbackElement(page)).toBeVisible()
    })
  })

  test.describe('規則：公開回覆到不存在的婚禮', () => {
    test('婚禮不存在', async ({ page }) => {
      const res = await page.request.post('/api/v1/weddings/wedding-999/guests/rsvp-public', {
        data: { guestName: '王小明', attending: 'attending', diet: 'meat', plusOneCount: 0, childChairCount: 0 },
      })
      expect(res.status()).toBe(404)
      expect(JSON.stringify(await res.json())).toContain('婚禮不存在')
    })
  })
})

// === Admin 端：待確認區處理（需登入） ===
test.describe('待確認區處理（Admin 端）', () => {
  test.beforeEach(async ({ page }) => {
    await resetMockData(page)
    await login(page, TestUsers.admin.account, TestUsers.admin.password)
  })

  test.describe('規則：待確認賓客不影響正式名單', () => {
    test('正式名單排除待確認賓客（API 邊界）', async ({ page }) => {
      const before = await (await page.request.get('/api/v1/weddings/wedding-001/guests')).json()
      await seedPending(page.request, {
        guestName: '王小明',
        phone: '0911000000',
        attending: 'attending',
        diet: 'meat',
        plusOneCount: 0,
        childChairCount: 0,
      })
      const after = await (await page.request.get('/api/v1/weddings/wedding-001/guests')).json()
      // 正式名單筆數不變（待確認賓客不混入）
      expect(after.length).toBe(before.length)
      // 待確認區可見該筆
      const pending = await (await page.request.get('/api/v1/weddings/wedding-001/pending-guests')).json()
      expect(pending.some((g: { name: string }) => g.name === '王小明')).toBeTruthy()
    })
  })

  test.describe('規則：成功併入既有賓客', () => {
    test('於待確認區併入既有賓客', async ({ page }) => {
      // Given：一筆與 guest-001（陳大明 / 0912345678）手機相同的待確認回覆
      await seedPending(page.request, {
        guestName: '陳大明',
        phone: '0912345678',
        relationship: 'groom',
        attending: 'attending',
        diet: 'vegetarian',
        plusOneCount: 0,
        childChairCount: 0,
      })

      await page.goto('/weddings/wedding-001/guests', { waitUntil: 'networkidle' })
      // 切換到待確認區
      await page.getByRole('button', { name: /待確認/ }).first().click()

      // When：在候選中選 guest-001（陳大明），按併入
      const apiCall = waitForApiCall(page, /\/pending-guests\/[^/]+\/merge(\?|$)/, 'POST')
      await page.getByRole('button', { name: /併入.*陳大明/ }).first().click()
      const request = await apiCall

      // Then：送出 merge，targetGuestId 為 guest-001
      expect(request.postDataJSON()).toMatchObject({ targetGuestId: 'guest-001' })
    })
  })

  test.describe('規則：成功建為新賓客', () => {
    test('建為新賓客（API 邊界）', async ({ page }) => {
      const guestId = await seedPending(page.request, {
        guestName: '新客人',
        phone: '0933000000',
        attending: 'attending',
        diet: 'meat',
        plusOneCount: 0,
        childChairCount: 0,
      })
      const res = await page.request.post(`/api/v1/weddings/wedding-001/pending-guests/${guestId}/confirm`)
      expect(res.ok()).toBeTruthy()
      // 確認後進入正式名單
      const guests = await (await page.request.get('/api/v1/weddings/wedding-001/guests')).json()
      expect(guests.some((g: { guestId: string }) => g.guestId === guestId)).toBeTruthy()
    })
  })

  test.describe('規則：成功略過', () => {
    test('略過待確認賓客（API 邊界）', async ({ page }) => {
      const guestId = await seedPending(page.request, {
        guestName: '略過客',
        phone: '0944000000',
        attending: 'declined',
        diet: 'meat',
        plusOneCount: 0,
        childChairCount: 0,
      })
      const res = await page.request.post(`/api/v1/weddings/wedding-001/pending-guests/${guestId}/reject`)
      expect(res.ok()).toBeTruthy()
      // 略過後待確認區不再可見
      const pending = await (await page.request.get('/api/v1/weddings/wedding-001/pending-guests')).json()
      expect(pending.some((g: { guestId: string }) => g.guestId === guestId)).toBeFalsy()
    })
  })

  test.describe('規則：處理不存在的待確認賓客', () => {
    test('待確認賓客不存在', async ({ page }) => {
      const res = await page.request.post('/api/v1/weddings/wedding-001/pending-guests/guest-999/confirm')
      expect(res.status()).toBe(404)
      expect(JSON.stringify(await res.json())).toContain('待確認賓客不存在')
    })
  })
})
