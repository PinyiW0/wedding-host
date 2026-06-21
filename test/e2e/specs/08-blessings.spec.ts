import { expect, test } from '@playwright/test'

import {
  findEntity,
  getFeedbackElement,
  login,
  maybeConfirm,
  resetMockData,
  TestUsers,
  waitForApiCall,
} from '../helpers'

// 對應 spec/e2e-flows/08-blessings.flow.md
// Feature Background：wedding-001；blessing-001（祝福新人百年好合！/ 已提交待審）。
//
// 多角色 / 多端：
//   - Guest 端（公開 LIFF）：/blessing/wedding-001?guestId=...
//     → 提交祝福留言與照片
//   - Admin 端（管理員，需登入 Andrea/Andrea1122）：/weddings/wedding-001/blessings
//     → 審核通過 / 審核拒絕（含原因）
//
// 註：mock 另含 blessing-002 / blessing-003（同為待審），審核 happy-path 一律
//     以 blessing-001 的訊息文字「祝福新人百年好合！」定位，不受其他祝福影響。

const BLESSINGS_PATH = '/weddings/wedding-001/blessings'
const BLESSING_001 = '/api/v1/weddings/wedding-001/blessings/blessing-001'
// not-found 場景：mock seed 必含 blessing-001，故以不存在的 blessingId 觸發 404（坑 #5）
const MISSING_BLESSING = '/api/v1/weddings/wedding-001/blessings/blessing-999'

test.describe('賓客端：提交祝福（Guest）', () => {
  test.beforeEach(async ({ page }) => {
    await resetMockData(page)
  })

  test.describe('規則：成功提交祝福', () => {
    test('成功提交祝福', async ({ page }) => {
      // Given：賓客透過專屬連結進入祝福頁（帶 guestId / weddingId）
      await page.goto('/blessing/wedding-001?guestId=guest-001', {
        waitUntil: 'networkidle',
      })

      // When：填寫祝福留言 → 提交
      await page.getByLabel(/留言|祝福/).fill('祝福新人百年好合！')

      // 主要 outcome：API spy 驗證 POST .../blessings，payload 含 guestId / message
      const apiCall = waitForApiCall(page, /\/weddings\/wedding-001\/blessings(\?|$)/, 'POST')
      await page.getByRole('button', { name: /送出|提交|祝福/ }).click()
      const request = await apiCall
      expect(request.postDataJSON()).toMatchObject({
        guestId: 'guest-001',
        message: '祝福新人百年好合！',
      })

      // Then：使用者能感知提交成功
      await expect(getFeedbackElement(page)).toBeVisible()
    })
  })
})

test.describe('管理端：審核通過祝福（Admin）', () => {
  test.beforeEach(async ({ page }) => {
    await resetMockData(page)
    await login(page, TestUsers.admin.account, TestUsers.admin.password)
  })

  test.describe('規則：成功審核通過祝福', () => {
    test('成功審核通過祝福', async ({ page }) => {
      // Given：blessing-001（祝福新人百年好合！）已提交待審
      await page.goto(BLESSINGS_PATH, { waitUntil: 'networkidle' })

      // When：在 blessing-001 範圍內觸發「通過」
      const apiCall = waitForApiCall(
        page,
        /\/blessings\/blessing-001\/approve(\?|$)/,
        'POST',
      )
      await findEntity(page, /祝福新人百年好合/)
        .getByRole('button', { name: /通過|核可/ })
        .click()
      await maybeConfirm(page)
      await apiCall

      // Then：UI 反饋 + blessing-001 顯示為「已通過」
      await expect(getFeedbackElement(page)).toBeVisible()
      await expect(
        findEntity(page, /祝福新人百年好合/).getByText(/已通過/),
      ).toBeVisible()
    })
  })

  test.describe('規則：審核通過時祝福不存在', () => {
    test('祝福不存在', async ({ page }) => {
      // 性質：API 邊界保護
      const res = await page.request.post(`${MISSING_BLESSING}/approve`)
      expect(res.status()).toBe(404)
      expect(JSON.stringify(await res.json())).toContain('祝福不存在')
    })
  })

  test.describe('規則：祝福已審核通過', () => {
    test('祝福已審核通過', async ({ page }) => {
      // 性質：API 邊界保護（先通過一次再重複）
      await page.request.post(`${BLESSING_001}/approve`)
      const res = await page.request.post(`${BLESSING_001}/approve`)
      expect(res.status()).toBe(409)
      expect(JSON.stringify(await res.json())).toContain('祝福已審核')
    })
  })
})

test.describe('管理端：審核拒絕祝福（Admin）', () => {
  test.beforeEach(async ({ page }) => {
    await resetMockData(page)
    await login(page, TestUsers.admin.account, TestUsers.admin.password)
  })

  test.describe('規則：成功審核拒絕祝福', () => {
    test('成功審核拒絕祝福', async ({ page }) => {
      // Given：blessing-001 已提交待審
      await page.goto(BLESSINGS_PATH, { waitUntil: 'networkidle' })

      // When：在 blessing-001 範圍內觸發「拒絕」並填寫原因
      await findEntity(page, /祝福新人百年好合/)
        .getByRole('button', { name: /拒絕|退回/ })
        .click()
      await page.getByLabel(/原因|理由/).fill('內容不適當')

      // 主要 outcome：API spy 驗證 POST .../reject，payload 含 reason
      const apiCall = waitForApiCall(
        page,
        /\/blessings\/blessing-001\/reject(\?|$)/,
        'POST',
      )
      await page.getByRole('button', { name: /拒絕|送出|確定|退回/ }).click()
      const request = await apiCall
      expect(request.postDataJSON()).toMatchObject({ reason: '內容不適當' })

      // Then：UI 反饋 + blessing-001 顯示為「已拒絕」
      await expect(getFeedbackElement(page)).toBeVisible()
      await expect(
        findEntity(page, /祝福新人百年好合/).getByText(/已拒絕/),
      ).toBeVisible()
    })
  })

  test.describe('規則：審核拒絕時祝福不存在', () => {
    test('祝福不存在', async ({ page }) => {
      // 性質：API 邊界保護
      const res = await page.request.post(`${MISSING_BLESSING}/reject`, {
        data: { reason: '內容不適當' },
      })
      expect(res.status()).toBe(404)
      expect(JSON.stringify(await res.json())).toContain('祝福不存在')
    })
  })

  test.describe('規則：祝福已被拒絕', () => {
    test('祝福已被拒絕', async ({ page }) => {
      // 性質：API 邊界保護（先拒絕一次再重複）
      await page.request.post(`${BLESSING_001}/reject`, { data: { reason: '先前已拒絕' } })
      const res = await page.request.post(`${BLESSING_001}/reject`, {
        data: { reason: '內容不適當' },
      })
      expect(res.status()).toBe(409)
      expect(JSON.stringify(await res.json())).toContain('祝福已審核')
    })
  })
})
