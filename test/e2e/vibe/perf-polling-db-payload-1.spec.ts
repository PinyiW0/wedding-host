// Source: app/pages/reception/index.vue（輪詢 9 個端點；#228 起分 5 秒／60 秒兩種頻率，這裡量的是 9 個全打的那一輪）、app/pages/projection/[weddingId].vue、app/composables/useProjectionChannel.ts（issue #224）
// Pattern: 資料量預算（輪詢一輪「從資料庫讀出」多少位元組）
//
// 2026-11-22 正式站 Neon 傳輸量超過額度、資料庫被暫停：輪詢端點整列撈賓客，連 base64 花圖一起拖出資料庫，
// 回應卻只用幾個欄位。瀏覽器看到的回應很小，種子資料也沒有大欄位，所以開發與測試都看不出來。
// 這支先補到正式站規模（120 位賓客、60 張花圖、投影照片），再用 /api/__test__/db-meter 量資料庫實際讀出的位元組。

import type { APIRequestContext, Page } from '@playwright/test'

import { expect, test } from '@playwright/test'

import { resetMockData } from '../helpers'

const WEDDING_ID = 'wedding-001'
const API = `/api/v1/weddings/${WEDDING_ID}`
const KB = 1024
// 與 useProjectionChannel 的預設輪詢間隔一致
const POLL_MS = 5000

// 接待台完整一輪輪詢打的 9 個端點
const RECEPTION_POLL = [
  'guests',
  'reception-status',
  'cake-box-types',
  'cake-box-types/assignments',
  'cake-box-exclusions',
  'tables',
  'seats',
  'venue-layout',
  'venue-markers',
] as const

// 預算（issue #224 驗收標準）。接待台一輪實測約 14KB（修正前整列撈是 1.8MB），取 50KB：多拖一兩張花圖就會紅
const RECEPTION_ROUND_BUDGET = 50 * KB
const PROJECTION_IDLE_ROUND_BUDGET = 20 * KB
// 花圖總量約 1.8MB：任何一支整列撈賓客都會遠超這個數字
const SINGLE_GUEST_BUDGET = 8 * KB
// 花圖搬到 R2 之後（issue #226）：欄位只剩網址，整列讀取全部賓客也不該超過這個數字（實測約 60KB；base64 時是 1.8MB）
const FULL_GUESTS_URL_BUDGET = 100 * KB

// 計數器是整個伺服器共用的一個數字：量測期間若有別的分頁連著同一台伺服器輪詢，那些查詢也會被算進來。
// 跑這支時不要開著同一台伺服器的預覽分頁
async function meter(request: APIRequestContext, run: () => Promise<void>): Promise<number> {
  expect((await request.delete('/api/__test__/db-meter')).ok()).toBe(true)
  await run()
  const { bytes } = await (await request.get('/api/__test__/db-meter')).json() as { bytes: number }
  return bytes
}

// 模擬分頁切到背景／回到前景：改寫 visibilityState 後補發瀏覽器會發的事件
async function setVisibility(page: Page, state: 'hidden' | 'visible') {
  await page.evaluate((value) => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => value })
    document.dispatchEvent(new Event('visibilitychange'))
  }, state)
}

test.describe('輪詢端點的資料庫讀出量（正式站規模）', () => {
  test.beforeEach(async ({ page }) => {
    await resetMockData(page)
    expect((await page.request.post('/api/__test__/seed-scale')).ok()).toBe(true)
  })

  test('接待台一輪輪詢，從資料庫讀出的資料不超過 50KB', async ({ request }) => {
    const perEndpoint: Record<string, number> = {}
    let total = 0

    await test.step('逐一打接待台輪詢的 9 個端點並量讀出量', async () => {
      for (const path of RECEPTION_POLL) {
        const bytes = await meter(request, async () => {
          expect((await request.get(`${API}/${path}`)).ok(), `${path} 應回 2xx`).toBe(true)
        })
        perEndpoint[path] = bytes
        total += bytes
      }
    })

    await test.step('一輪合計在預算內', async () => {
      test.info().annotations.push({ type: '讀出量', description: `合計 ${total} bytes；${JSON.stringify(perEndpoint)}` })
      expect(total, `各端點讀出量（bytes）：${JSON.stringify(perEndpoint)}`).toBeLessThanOrEqual(RECEPTION_ROUND_BUDGET)
    })
  })

  test('投影頁設定沒變時，一輪輪詢從資料庫讀出的資料不超過 20KB', async ({ request }) => {
    let etag = ''

    await test.step('第一次讀投影設定，拿到版本標記', async () => {
      const first = await request.get(`${API}/projection-settings`)
      expect(first.ok()).toBe(true)
      expect((await first.json()).photoDataUrl, '回應格式不變：仍帶完整照片').toContain('data:image/png;base64,')
      etag = first.headers().etag ?? ''
      expect(etag, '回應應帶 ETag，瀏覽器才能問「有沒有變」').not.toBe('')
    })

    await test.step('帶著版本標記再問一輪（祝福＋設定），資料庫不重讀大欄位', async () => {
      const bytes = await meter(request, async () => {
        expect((await request.get(`${API}/blessings`)).ok()).toBe(true)
        const again = await request.get(`${API}/projection-settings`, { headers: { 'If-None-Match': etag } })
        expect(again.status(), '設定沒變應回 304').toBe(304)
        // 中間層壓縮回應時會把 ETag 改成弱式（W/"..."），正式站瀏覽器帶回來的可能是這種寫法
        const weak = await request.get(`${API}/projection-settings`, { headers: { 'If-None-Match': `W/${etag}` } })
        expect(weak.status(), '弱式 ETag 也要回 304').toBe(304)
      })
      expect(bytes).toBeLessThanOrEqual(PROJECTION_IDLE_ROUND_BUDGET)
    })
  })

  test('花田端點只讀名字與花圖，不整列撈', async ({ request }) => {
    let needed = 0
    const bytes = await meter(request, async () => {
      const res = await request.get(`${API}/flowers`)
      expect(res.ok()).toBe(true)
      const items = await res.json() as { guestId: string, name: string, flowerDrawing: string }[]
      expect(items.length).toBeGreaterThanOrEqual(60)
      needed = items.reduce((sum, f) => sum + f.guestId.length + f.name.length * 3 + f.flowerDrawing.length, 0)
    })
    // 回應真的用到的三個欄位是必要的讀出量；多出來的就是白拖的欄位，不該超過 1KB
    expect(bytes - needed).toBeLessThanOrEqual(KB)
  })

  test('單筆賓客操作（報到）不把花圖讀出資料庫', async ({ request }) => {
    const bytes = await meter(request, async () => {
      const res = await request.post(`${API}/guests/scale-guest-001/check-in`)
      expect(res.ok(), `報到應成功，實際 ${res.status()}`).toBe(true)
    })
    expect(bytes).toBeLessThanOrEqual(SINGLE_GUEST_BUDGET)
  })

  test('投影頁開著不動時，第二輪起的輪詢不再把照片讀出資料庫', async ({ page }) => {
    await page.clock.install()
    await page.goto(`/projection/${WEDDING_ID}`)
    await expect(page.getByTestId('projection-page')).toBeVisible()

    await test.step('第一輪輪詢：瀏覽器還沒有快取，讀一次完整設定', async () => {
      const settled = page.waitForResponse(r => r.url().includes('/projection-settings'))
      await page.clock.runFor(POLL_MS)
      await settled
    })

    await test.step('第二輪輪詢：設定沒變，資料庫讀出量在預算內', async () => {
      expect((await page.request.delete('/api/__test__/db-meter')).ok()).toBe(true)
      const settings = page.waitForResponse(r => r.url().includes('/projection-settings'))
      const blessings = page.waitForResponse(r => r.url().includes('/blessings'))
      await page.clock.runFor(POLL_MS)
      await Promise.all([settings, blessings])
      const { bytes } = await (await page.request.get('/api/__test__/db-meter')).json() as { bytes: number }
      expect(bytes).toBeLessThanOrEqual(PROJECTION_IDLE_ROUND_BUDGET)
    })
  })

  test('投影頁分頁在背景時，30 秒內不發出輪詢請求；回到前景立刻補一次', async ({ page }) => {
    await page.clock.install()
    await page.goto(`/projection/${WEDDING_ID}`)
    await expect(page.getByTestId('projection-page')).toBeVisible()

    const polls: string[] = []
    page.on('request', (r) => {
      if (/\/(?:projection-settings|blessings)(?:\?|$)/.test(r.url()))
        polls.push(r.url())
    })

    await test.step('切到背景後過 30 秒，沒有任何輪詢請求', async () => {
      await setVisibility(page, 'hidden')
      await page.clock.runFor(30_000)
      expect(polls).toHaveLength(0)
    })

    await test.step('回到前景，立刻補一次輪詢', async () => {
      const settled = page.waitForResponse(r => r.url().includes('/projection-settings'))
      await setVisibility(page, 'visible')
      await settled
      expect(polls.length).toBeGreaterThanOrEqual(1)
    })
  })
})

test.describe('花圖改存網址之後的整列讀取（正式站規模）', () => {
  test('整列讀取全部賓客（含花圖欄位），從資料庫讀出的資料不超過 100KB', async ({ page, request }) => {
    await resetMockData(page)
    expect((await request.post('/api/__test__/seed-scale?flowers=url')).ok()).toBe(true)

    let withFlower = 0
    const bytes = await meter(request, async () => {
      const res = await request.get(`${API}/guests?fields=full`)
      expect(res.ok()).toBe(true)
      const items = await res.json() as { flowerDrawing: string | null }[]
      withFlower = items.filter(g => g.flowerDrawing?.startsWith('https://')).length
    })

    expect(withFlower, '規模資料應有 60 位賓客帶網址形式的花圖').toBeGreaterThanOrEqual(60)
    test.info().annotations.push({ type: '讀出量', description: `${bytes} bytes` })
    expect(bytes).toBeLessThanOrEqual(FULL_GUESTS_URL_BUDGET)
  })
})
