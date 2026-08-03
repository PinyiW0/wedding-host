// Source: app/pages/reception/index.vue 輪詢區塊（issue #138）
// Pattern: interaction（跨端即時同步的根因斷言）
// 需求：後台改款式（改名／改成組合／改可見性）後，接待端不需整頁重載就會更新。
//      原本款式清單只解構了 data、沒有 refresh，也沒進輪詢陣列 ⇒ 開頁快照，只有 F5 才會變。
//      這裡直接斷言「開頁之後仍會再送出 cake-box-types 的 GET」——等的是請求事件而非畫面，
//      不受渲染時序影響；款名改由後端 join 帶出，光看畫面反而驗不到這個 bug。

import { expect, test } from '@playwright/test'

import { login, resetMockData, TestUsers } from '../helpers'

const WID = 'wedding-001'
const CAKE_TYPES_RE = /\/cake-box-types(?:\?|$)/

test.describe('vibe：接待端款式清單納入輪詢', () => {
  test('開頁後仍會重抓喜餅款式（不再是開頁快照）', async ({ page }) => {
    await resetMockData(page)
    await login(page, TestUsers.admin.account, TestUsers.admin.password)
    await page.goto(`/reception?weddingId=${WID}`, { waitUntil: 'networkidle' })

    // networkidle 之後才開始等 ⇒ 接下來這筆必然來自輪詢，而非首次載入。
    // 一輪 5 秒，留足餘裕
    const polled = await page.waitForRequest(
      req => CAKE_TYPES_RE.test(req.url()) && req.method() === 'GET',
      { timeout: 15_000 },
    )
    expect(polled.url()).toContain(WID)
  })
})
