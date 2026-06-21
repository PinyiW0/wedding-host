import { expect, test } from '@playwright/test'

import {
  getFeedbackElement,
  login,
  maybeConfirm,
  resetMockData,
  selectOption,
  TestUsers,
  waitForApiCall,
} from '../helpers'

// 對應 spec/e2e-flows/09-thankyou.flow.md
// Feature Background：wedding-001；管理員（Andrea/Andrea1122）。
//   全 Admin 端，頁面：/weddings/wedding-001/thank-you
//   4 類操作：設定謝卡範本 / 客製謝卡 / 群發感謝 / 替代感謝。
//
// mock 實況（與 flow 文字略有出入，一律以 mock 為準，坑 #6）：
//   - guest-001（陳大明，未綁定 LINE）；guest-002（林美麗，未綁定 LINE）
//   - guest-003（王志強，已綁定 LINE：lineUserId=line-u-003）→ 群發前提唯一已綁定賓客
//   群發 happy-path 依賴 guest-003 已綁定；no-bound 場景需先移除 guest-003 的綁定狀態。

const THANK_YOU_PATH = '/weddings/wedding-001/thank-you'
// not-found 場景：mock seed 必含 wedding-001，故以不存在的 weddingId 觸發 404（坑 #5）
const MISSING_WEDDING = '/api/v1/weddings/wedding-999'

test.describe('管理端：設定謝卡範本（Admin）', () => {
  test.beforeEach(async ({ page }) => {
    await resetMockData(page)
    await login(page, TestUsers.admin.account, TestUsers.admin.password)
  })

  test.describe('規則：成功設定謝卡範本', () => {
    test('成功設定謝卡範本', async ({ page }) => {
      // Given：wedding-001 已建立
      await page.goto(THANK_YOU_PATH, { waitUntil: 'networkidle' })

      // When：觸發「設定謝卡範本」並填寫內容
      await page.getByRole('button', { name: /設定.*範本|編輯.*範本/ }).click()
      await page.getByLabel(/範本內容|內容/).fill('感謝您的祝福，我們會永遠珍惜！')

      // 主要 outcome：API spy 驗證 PUT .../thank-you-card/template，payload 含 templateContent
      const apiCall = waitForApiCall(page, /\/thank-you-card\/template(\?|$)/, 'PUT')
      await page.getByRole('button', { name: /儲存|送出|確定/ }).click()
      const request = await apiCall
      expect(request.postDataJSON()).toMatchObject({
        templateContent: '感謝您的祝福，我們會永遠珍惜！',
      })

      // Then：使用者能感知已儲存
      await expect(getFeedbackElement(page)).toBeVisible()
    })
  })

  test.describe('規則：設定範本時婚禮不存在', () => {
    test('婚禮不存在', async ({ page }) => {
      // 性質：API 邊界保護
      const res = await page.request.put(`${MISSING_WEDDING}/thank-you-card/template`, {
        data: { templateContent: '感謝您的祝福！', templateImageUrl: 'https://example.com/thankyou.jpg' },
      })
      expect(res.status()).toBe(404)
      expect(JSON.stringify(await res.json())).toContain('婚禮不存在')
    })
  })
})

test.describe('管理端：客製謝卡（Admin）', () => {
  test.beforeEach(async ({ page }) => {
    await resetMockData(page)
    await login(page, TestUsers.admin.account, TestUsers.admin.password)
  })

  test.describe('規則：成功客製謝卡', () => {
    test('成功客製謝卡', async ({ page }) => {
      // Given：wedding-001 已建立，為 guest-001（陳大明）客製
      await page.goto(THANK_YOU_PATH, { waitUntil: 'networkidle' })

      // When：觸發「客製謝卡」入口，填寫內容後選對象（下拉排最後，坑 #8）
      await page.getByRole('button', { name: /客製/ }).click()
      await page.getByLabel(/客製內容|內容/).fill('親愛的陳大明，特別感謝您遠道而來！')
      await selectOption(page, 'customize-guest-select', /陳大明/)

      // 主要 outcome：API spy 驗證 POST .../thank-you-card/customizations，payload 含 guestId / customContent
      const apiCall = waitForApiCall(page, /\/thank-you-card\/customizations(\?|$)/, 'POST')
      await page.getByRole('button', { name: /儲存|送出|確定/ }).click()
      const request = await apiCall
      expect(request.postDataJSON()).toMatchObject({
        guestId: 'guest-001',
        customContent: '親愛的陳大明，特別感謝您遠道而來！',
      })

      // Then：使用者能感知客製已儲存
      await expect(getFeedbackElement(page)).toBeVisible()
    })
  })

  test.describe('規則：客製謝卡時婚禮不存在', () => {
    test('婚禮不存在', async ({ page }) => {
      // 性質：API 邊界保護
      const res = await page.request.post(`${MISSING_WEDDING}/thank-you-card/customizations`, {
        data: { guestId: 'guest-001', customContent: '特別感謝！' },
      })
      expect(res.status()).toBe(404)
      expect(JSON.stringify(await res.json())).toContain('婚禮不存在')
    })
  })
})

test.describe('管理端：群發感謝訊息（Admin）', () => {
  test.beforeEach(async ({ page }) => {
    await resetMockData(page)
    await login(page, TestUsers.admin.account, TestUsers.admin.password)
  })

  test.describe('規則：成功群發感謝訊息', () => {
    test('成功群發感謝訊息', async ({ page }) => {
      // Given：wedding-001 已建立，且有已綁定 LINE 的賓客（guest-003）
      await page.goto(THANK_YOU_PATH, { waitUntil: 'networkidle' })

      // When：觸發「群發感謝訊息」，完成 confirm
      const apiCall = waitForApiCall(page, /\/thank-you\/batch-send(\?|$)/, 'POST')
      await page.getByRole('button', { name: /群發|批次發送|發送感謝/ }).click()
      await maybeConfirm(page)
      await apiCall

      // Then：使用者能感知發送結果（含人數 50）
      await expect(getFeedbackElement(page)).toBeVisible()
      await expect(page.getByText(/50/)).toBeVisible()
    })
  })

  test.describe('規則：群發時婚禮不存在', () => {
    test('婚禮不存在', async ({ page }) => {
      // 性質：API 邊界保護
      const res = await page.request.post(`${MISSING_WEDDING}/thank-you/batch-send`)
      expect(res.status()).toBe(404)
      expect(JSON.stringify(await res.json())).toContain('婚禮不存在')
    })
  })

  test.describe('規則：群發時無已綁定 LINE 的賓客', () => {
    test('沒有已綁定 LINE 的賓客', async ({ page }) => {
      // Given：先移除唯一已綁定 LINE 的賓客 guest-003（坑 #6：mock 與 flow 背景矛盾，test 內裁剪）
      await page.request.delete('/api/v1/weddings/wedding-001/guests/guest-003')
      await page.goto(THANK_YOU_PATH, { waitUntil: 'networkidle' })

      // When：觸發「群發感謝訊息」，完成 confirm
      const apiCall = waitForApiCall(page, /\/thank-you\/batch-send(\?|$)/, 'POST')
      await page.getByRole('button', { name: /群發|批次發送|發送感謝/ }).click()
      await maybeConfirm(page)
      const res = await apiCall
      // 後端回 409，未實際發送
      expect((await res.response())?.status()).toBe(409)

      // Then：使用者看到錯誤訊息（含「沒有已綁定 LINE 的賓客」）
      await expect(page.getByText(/沒有已綁定 LINE 的賓客/)).toBeVisible()
    })
  })
})

test.describe('管理端：發送替代感謝（Admin）', () => {
  test.beforeEach(async ({ page }) => {
    await resetMockData(page)
    await login(page, TestUsers.admin.account, TestUsers.admin.password)
  })

  test.describe('規則：透過 Email 發送替代感謝', () => {
    test('透過 Email 發送替代感謝', async ({ page }) => {
      // Given：wedding-001 已建立，對未加 LINE 的 guest-002（林美麗）發送
      await page.goto(THANK_YOU_PATH, { waitUntil: 'networkidle' })

      // When：觸發「替代感謝」入口，選對象 → guest-002（林美麗），管道 → Email
      //       兩個下拉皆排在最後選（坑 #8）
      await page.getByRole('button', { name: /替代感謝|替代/ }).click()
      await selectOption(page, 'fallback-guest-select', /林美麗/)
      await selectOption(page, 'fallback-channel-select', /Email/i)

      // 主要 outcome：API spy 驗證 POST .../thank-you/fallback-send，payload 含 channel=email / guestId
      const apiCall = waitForApiCall(page, /\/thank-you\/fallback-send(\?|$)/, 'POST')
      await page.getByRole('button', { name: /發送|送出|確定/ }).click()
      const request = await apiCall
      expect(request.postDataJSON()).toMatchObject({
        guestId: 'guest-002',
        channel: 'email',
      })

      // Then：使用者能感知已發送
      await expect(getFeedbackElement(page)).toBeVisible()
    })
  })

  test.describe('規則：替代感謝時婚禮不存在', () => {
    test('婚禮不存在', async ({ page }) => {
      // 性質：API 邊界保護
      const res = await page.request.post(`${MISSING_WEDDING}/thank-you/fallback-send`, {
        data: { guestId: 'guest-002', channel: 'email' },
      })
      expect(res.status()).toBe(404)
      expect(JSON.stringify(await res.json())).toContain('婚禮不存在')
    })
  })
})
