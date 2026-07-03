import { expect, test } from '@playwright/test'

import {
  findEntity,
  getFeedbackElement,
  login,
  maybeConfirm,
  resetMockData,
  selectOption,
  TestUsers,
  waitForApiCall,
} from '../helpers'

// 對應 spec/e2e-flows/16-gifts.flow.md（婚禮小物規劃：六類品項 CRUD + 金額讀模型 + 採買參考）
// Feature Background：已登入為管理員（Admin）；wedding-001 已選定
// mock seed（皆屬 wedding-001，金額刻意可驗算）：
//   giftitem-001（桌上禮「拉花小熊桌上禮」50×120＋運費100 → 總計 6,100）
//   giftitem-002（送客禮「乾燥花束送客禮」80×150＋運費200＋50 → 總計 12,250）
//   全部總額 18,350

const GIFTS_PATH = '/weddings/wedding-001/gifts'

test.describe('婚禮小物規劃（Admin 端）', () => {
  test.beforeEach(async ({ page }) => {
    await resetMockData(page)
    await login(page, TestUsers.admin.account, TestUsers.admin.password)
  })

  test.describe('規則：成功新增禮物品項', () => {
    test('成功新增禮物品項', async ({ page }) => {
      // Given：進入婚禮小物頁
      await page.goto(GIFTS_PATH, { waitUntil: 'networkidle' })

      // When：觸發新增並填寫表單（文字/數字欄先填，下拉最後處理，坑 #8）
      await page.getByRole('button', { name: /新增禮物|新增品項|新增/ }).click()
      await page.getByLabel(/款式說明/).fill('手工喜糖小盒')
      await page.getByLabel(/單價/).fill('35')
      await page.getByLabel(/^數量/).fill('180')
      await page.getByLabel(/運費一/).fill('120')
      await selectOption(page, 'gift-category-select', /送客禮/)

      // 主要 outcome：API spy 驗證 POST .../gift-items，payload 含類別/說明/單價/數量/運費
      const apiCall = waitForApiCall(page, /\/gift-items(\?|$)/, 'POST')
      await page.getByRole('button', { name: /新增|建立|送出|確定/ }).click()
      const request = await apiCall
      expect(request.postDataJSON()).toMatchObject({
        category: 'send_off',
        description: '手工喜糖小盒',
        unitPrice: 35,
        quantity: 180,
        shippingFee1: 120,
      })

      // Then：品項出現且可識別
      await expect(findEntity(page, /手工喜糖小盒/)).toBeVisible()
    })
  })

  test.describe('規則：成功更新禮物品項', () => {
    test('成功更新禮物品項', async ({ page }) => {
      // Given：seed giftitem-001（拉花小熊桌上禮）已存在
      await page.goto(GIFTS_PATH, { waitUntil: 'networkidle' })

      // When：在品項範圍觸發編輯，調整數量與運費一
      await findEntity(page, /拉花小熊桌上禮/).getByRole('button', { name: /編輯/ }).click()
      await page.getByLabel(/^數量/).fill('150')
      await page.getByLabel(/運費一/).fill('150')

      // 主要 outcome：API spy 驗證 PATCH .../gift-items/giftitem-001
      const apiCall = waitForApiCall(page, /\/gift-items\/giftitem-001(\?|$)/, 'PATCH')
      await page.getByRole('button', { name: /儲存|更新|送出|確定/ }).click()
      const request = await apiCall
      expect(request.postDataJSON()).toMatchObject({
        quantity: 150,
        shippingFee1: 150,
      })

      // Then：更新後金額重算（50×150＋150 = 7,650）
      await expect(findEntity(page, /拉花小熊桌上禮/)).toContainText('7,650')
    })
  })

  test.describe('規則：更新不存在的禮物品項', () => {
    test('禮物品項不存在', async ({ page }) => {
      // 性質：API 邊界保護
      const res = await page.request.patch(
        '/api/v1/weddings/wedding-001/gift-items/giftitem-999',
        { data: { quantity: 10 } },
      )
      expect(res.status()).toBe(404)
      expect(JSON.stringify(await res.json())).toContain('禮物品項不存在')
    })
  })

  test.describe('規則：成功移除禮物品項', () => {
    test('成功移除禮物品項', async ({ page }) => {
      // Given：seed giftitem-001 已存在
      await page.goto(GIFTS_PATH, { waitUntil: 'networkidle' })

      // When：在品項範圍觸發移除並完成確認
      const apiCall = waitForApiCall(page, /\/gift-items\/giftitem-001(\?|$)/, 'DELETE')
      await findEntity(page, /拉花小熊桌上禮/).getByRole('button', { name: /移除|刪除/ }).click()
      await maybeConfirm(page)

      // Then：DELETE 端點被呼叫，品項不再可見
      await apiCall
      await expect(getFeedbackElement(page)).toBeVisible()
      await expect(findEntity(page, /拉花小熊桌上禮/)).not.toBeVisible()
    })
  })

  test.describe('規則：移除不存在的禮物品項', () => {
    test('禮物品項不存在', async ({ page }) => {
      // 性質：API 邊界保護
      const res = await page.request.delete(
        '/api/v1/weddings/wedding-001/gift-items/giftitem-999',
      )
      expect(res.status()).toBe(404)
      expect(JSON.stringify(await res.json())).toContain('禮物品項不存在')
    })
  })

  test.describe('規則：金額語意為合約', () => {
    test('類別小計與全部總額正確', async ({ page }) => {
      // Given：seed 兩筆品項（總計 6,100 / 12,250）
      await page.goto(GIFTS_PATH, { waitUntil: 'networkidle' })

      // Then：類別小計與全部總額可被讀到且正確
      await expect(page.getByTestId('gift-category-subtotal-table')).toContainText('6,100')
      await expect(page.getByTestId('gift-category-subtotal-send_off')).toContainText('12,250')
      await expect(page.getByTestId('gift-grand-total')).toContainText('18,350')
    })
  })

  test.describe('規則：採買參考數與賓客/桌次資料一致', () => {
    test('出席大人數/兒童椅數/桌數一致', async ({ page }) => {
      // Given：以 API 回應推算預期值（不寫死 seed 數字，凍結「一致」而非數值）
      const guestsRes = await page.request.get('/api/v1/weddings/wedding-001/guests')
      const guests = await guestsRes.json()
      const attending = guests.filter(
        (g: { deletedAt: string | null, rsvpAttending: string | null }) =>
          !g.deletedAt && g.rsvpAttending === 'attending',
      )
      const adults = attending.reduce(
        (s: number, g: { partySize: number, childChairCount: number }) =>
          s + (g.partySize - g.childChairCount),
        0,
      )
      const children = attending.reduce(
        (s: number, g: { childChairCount: number }) => s + g.childChairCount,
        0,
      )
      const tablesRes = await page.request.get('/api/v1/weddings/wedding-001/tables')
      const tables = await tablesRes.json()

      // Then：頁面參考數與推算一致
      await page.goto(GIFTS_PATH, { waitUntil: 'networkidle' })
      await expect(page.getByTestId('gift-ref-adults')).toContainText(String(adults))
      await expect(page.getByTestId('gift-ref-children')).toContainText(String(children))
      await expect(page.getByTestId('gift-ref-tables')).toContainText(String(tables.length))
    })
  })
})
