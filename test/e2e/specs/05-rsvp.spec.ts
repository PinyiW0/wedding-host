import { expect, test } from '@playwright/test'

import {
  findEntity,
  getFeedbackElement,
  login,
  resetMockData,
  selectOption,
  TestUsers,
  waitForApiCall,
} from '../helpers'

// 對應 spec/e2e-flows/05-rsvp.flow.md（發送 RSVP 邀請 + 賓客提交 RSVP + 管理員覆寫 RSVP）
// Feature Background：
//   - 發送邀請 / 覆寫：已登入為管理員（Admin）；wedding-001 已選定
//   - 提交 RSVP：賓客（Guest）端透過專屬連結操作，不需登入
// mock seed（皆屬 wedding-001）：
//   guest-001(陳大明 / 未提交 RSVP)、guest-003(王志強 / 已提交出席)

// === Admin 端：發送邀請 + 覆寫 RSVP（需登入） ===
test.describe('RSVP 管理（Admin 端）', () => {
  test.beforeEach(async ({ page }) => {
    await resetMockData(page)
    await login(page, TestUsers.admin.account, TestUsers.admin.password)
  })

  test.describe('規則：透過 LINE 發送 RSVP 邀請', () => {
    // 後台 UI 已依需求移除「發送邀請」入口（先拿掉），但邀請能力仍保留於後端契約，
    // 故此規則改於 API 邊界驗證（invariant：管理員能透過指定管道發送邀請仍成立）。
    test('透過 LINE 發送 RSVP 邀請（API 邊界）', async ({ page }) => {
      // Given：guest-001（陳大明）已存在
      // When：以指定管道 line 發送邀請
      const res = await page.request.post(
        '/api/v1/weddings/wedding-001/guests/guest-001/rsvp-invitation',
        { data: { channel: 'line' } },
      )
      // Then：發送成功，回應含 channel=line
      expect(res.ok()).toBeTruthy()
      expect(await res.json()).toMatchObject({ guestId: 'guest-001', channel: 'line' })
    })
  })

  test.describe('規則：發送 RSVP 邀請給不存在的賓客', () => {
    test('賓客不存在', async ({ page }) => {
      // 性質：API 邊界保護（UI 正常只對既有賓客顯示發送動作）
      const res = await page.request.post(
        '/api/v1/weddings/wedding-001/guests/guest-999/rsvp-invitation',
        { data: { channel: 'line' } },
      )
      expect(res.status()).toBe(404)
      expect(JSON.stringify(await res.json())).toContain('賓客不存在')
    })
  })

  test.describe('規則：成功覆寫 RSVP', () => {
    test('成功覆寫 RSVP', async ({ page }) => {
      // Given：guest-001（陳大明）已提交 RSVP（出席）
      // seed 為未提交，先透過 API 建立「已提交出席」前置狀態
      const submit = await page.request.post(
        '/api/v1/weddings/wedding-001/guests/guest-001/rsvp',
        {
          data: { attending: 'attending', diet: 'meat', plusOneCount: 0, childChairCount: 0 },
        },
      )
      expect(submit.ok()).toBeTruthy()

      await page.goto('/weddings/wedding-001/rsvp', { waitUntil: 'networkidle' })

      // When：在 guest-001 範圍觸發「覆寫 RSVP」，設定缺席 + 原因
      await findEntity(page, /陳大明/)
        .getByRole('button', { name: /覆寫/ })
        .click()
      // 先填原因（避免下拉 overlay 過渡攔截後續輸入），再設出席狀態 → 缺席（absent）
      await page.getByLabel(/原因/).fill('賓客臨時通知無法出席')
      await selectOption(page, 'rsvp-override-attending', /缺席/)

      // 主要 outcome：API spy 驗證 POST .../guests/guest-001/rsvp-override
      const apiCall = waitForApiCall(
        page,
        /\/guests\/guest-001\/rsvp-override(\?|$)/,
        'POST',
      )
      await page.getByRole('button', { name: /送出|覆寫|確定/ }).click()
      const request = await apiCall
      expect(request.postDataJSON()).toMatchObject({
        attending: 'absent',
        reason: '賓客臨時通知無法出席',
      })

      // Then：覆寫後 guest-001 範圍出席狀態顯示為「缺席」
      await expect(findEntity(page, /陳大明/).getByText(/缺席/)).toBeVisible()
    })
  })

  test.describe('規則：覆寫 RSVP 時賓客不存在', () => {
    test('賓客不存在', async ({ page }) => {
      // 性質：API 邊界保護
      const res = await page.request.post(
        '/api/v1/weddings/wedding-001/guests/guest-999/rsvp-override',
        { data: { attending: 'absent', reason: '測試' } },
      )
      expect(res.status()).toBe(404)
      expect(JSON.stringify(await res.json())).toContain('賓客不存在')
    })
  })
})

// === Guest 端：提交 RSVP（不需登入，公開專屬連結） ===
test.describe('賓客提交 RSVP（Guest 端）', () => {
  test.beforeEach(async ({ page }) => {
    await resetMockData(page)
  })

  test.describe('規則：賓客提交出席', () => {
    test('提交出席', async ({ page }) => {
      // Given：guest-001 已新增、尚未提交 RSVP（seed 即為未提交）
      // 進入賓客 RSVP 回覆頁（帶 weddingId 情境）
      await page.goto('/rsvp/guest-001?weddingId=wedding-001', {
        waitUntil: 'networkidle',
      })

      // When：填寫回覆並提交
      // 出席狀態 → 出席（attending）
      await page.getByRole('button', { name: /^出席$/ }).click()
      // 飲食 → 葷食（meat）
      await page.getByRole('button', { name: /^葷食$/ }).click()
      // 加一人數 → 1
      await page.getByLabel(/加一|攜伴|人數/).fill('1')
      // 是否需兒童座椅 → 否（保持預設未勾選）

      // 主要 outcome：API spy 驗證 POST .../guests/guest-001/rsvp
      const apiCall = waitForApiCall(
        page,
        /\/guests\/guest-001\/rsvp(\?|$)/,
        'POST',
      )
      await page.getByRole('button', { name: /送出|提交|確定/ }).click()
      const request = await apiCall
      expect(request.postDataJSON()).toMatchObject({
        attending: 'attending',
        diet: 'meat',
        plusOneCount: 1,
        childChairCount: 0,
      })

      // Then：使用者能感知提交成功
      await expect(getFeedbackElement(page)).toBeVisible()
    })
  })

  test.describe('規則：提交 RSVP 時賓客不存在', () => {
    test('賓客不存在', async ({ page }) => {
      // 性質：API 邊界保護
      const res = await page.request.post(
        '/api/v1/weddings/wedding-001/guests/guest-999/rsvp',
        {
          data: { attending: 'attending', diet: 'meat', plusOneCount: 0, childChairCount: 0 },
        },
      )
      expect(res.status()).toBe(404)
      expect(JSON.stringify(await res.json())).toContain('賓客不存在')
    })
  })

  test.describe('規則：重複提交 RSVP', () => {
    test('已提交過 RSVP', async ({ page }) => {
      // 性質：API 邊界保護（UI 正常顯示已回覆狀態，不再開放重複提交）
      // Given：先讓 guest-001 提交 RSVP（seed 為未提交）
      const first = await page.request.post(
        '/api/v1/weddings/wedding-001/guests/guest-001/rsvp',
        {
          data: { attending: 'attending', diet: 'meat', plusOneCount: 0, childChairCount: 0 },
        },
      )
      expect(first.ok()).toBeTruthy()

      // When：再次提交已提交的 guest-001
      const res = await page.request.post(
        '/api/v1/weddings/wedding-001/guests/guest-001/rsvp',
        {
          data: { attending: 'declined', diet: 'meat', plusOneCount: 0, childChairCount: 0 },
        },
      )
      expect(res.status()).toBe(409)
      expect(JSON.stringify(await res.json())).toContain('已提交過 RSVP')
    })
  })
})
