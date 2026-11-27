// Source: app/pages/reception/index.vue 輪詢區塊（issue #228）
// Pattern: interaction（輪詢頻率分級）
// 需求：接待台 9 個輪詢端點分兩種頻率——現場會變的（賓客／報到狀態／喜餅指派）每 5 秒；
//      當天幾乎不變的（喜餅款式／不發放／桌次／座位／場地／標記）每 60 秒。
//      分頁回到前景、或在本頁改了桌次時，不必等 60 秒。
// 用假時鐘推進時間、數請求事件，不看畫面，不受渲染時序影響。

import type { Page } from '@playwright/test'

import { expect, test } from '@playwright/test'

import { login, resetMockData, TestUsers } from '../helpers'

const WID = 'wedding-001'
const FAST = ['guests', 'reception-status', 'cake-box-types/assignments'] as const
const SLOW = ['cake-box-types', 'cake-box-exclusions', 'tables', 'seats', 'venue-layout', 'venue-markers'] as const
const ALL = [...FAST, ...SLOW]
// 改版前：60 秒 12 輪 × 9 個端點
const BEFORE_PER_MINUTE = 108
const API_RE = new RegExp(`/api/v1/weddings/${WID}/(.+?)(?:\\?|$)`)

function countPolls(page: Page) {
  const counts = new Map<string, number>()
  page.on('request', (r) => {
    if (r.method() !== 'GET')
      return
    const key = API_RE.exec(r.url())?.[1]
    if (key && (ALL as readonly string[]).includes(key))
      counts.set(key, (counts.get(key) ?? 0) + 1)
  })
  return {
    of: (key: string) => counts.get(key) ?? 0,
    total: () => [...counts.values()].reduce((a, b) => a + b, 0),
    reset: () => counts.clear(),
  }
}

async function setVisibility(page: Page, state: 'hidden' | 'visible') {
  await page.evaluate((value) => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => value })
    document.dispatchEvent(new Event('visibilitychange'))
  }, state)
}

test.describe('vibe：接待台輪詢分兩種頻率', () => {
  test.beforeEach(async ({ page }) => {
    await resetMockData(page)
    await login(page, TestUsers.admin.account, TestUsers.admin.password)
    await page.clock.install()
    await page.goto(`/reception?weddingId=${WID}`, { waitUntil: 'networkidle' })
    await expect(page.getByTestId('reception-page')).toBeVisible()
  })

  test('60 秒內：現場資料每 5 秒一次、設定類資料只一次，請求數比改版前少五成以上', async ({ page }) => {
    const polls = countPolls(page)

    await test.step('前 55 秒只有現場資料在更新', async () => {
      await page.clock.runFor(55_000)
      for (const key of FAST)
        expect(polls.of(key), key).toBe(11)
      for (const key of SLOW)
        expect(polls.of(key), key).toBe(0)
    })

    await test.step('第 60 秒設定類資料更新一次', async () => {
      await page.clock.runFor(5000)
      for (const key of FAST)
        expect(polls.of(key), key).toBe(12)
      for (const key of SLOW)
        expect(polls.of(key), key).toBe(1)
      expect(polls.total()).toBeLessThanOrEqual(BEFORE_PER_MINUTE / 2)
    })
  })

  test('分頁在背景時不輪詢；回到前景立刻把 9 項資料全部更新一次', async ({ page }) => {
    const polls = countPolls(page)

    await test.step('切到背景後過 30 秒，沒有任何輪詢請求', async () => {
      await setVisibility(page, 'hidden')
      await page.clock.runFor(30_000)
      expect(polls.total()).toBe(0)
    })

    await test.step('回到前景，9 項資料各更新一次', async () => {
      await setVisibility(page, 'visible')
      for (const key of ALL)
        await expect.poll(() => polls.of(key), { message: key }).toBe(1)
    })
  })

  test('在接待頁新增桌次後，桌次與座位立刻更新，不必等 60 秒', async ({ page }) => {
    const polls = countPolls(page)

    await page.getByTestId('vibe-reception-add-table').click()
    await page.getByTestId('vibe-reception-table-name').fill('輪詢測試桌')
    await page.getByTestId('vibe-reception-table-submit').click()

    await expect(page.getByText('桌次新增成功').first()).toBeVisible()
    for (const key of ['tables', 'seats'])
      expect(polls.of(key), key).toBeGreaterThanOrEqual(1)
  })

  test('在接待頁新增臨時賓客後，名單立刻更新，不靠 5 秒輪詢', async ({ page }) => {
    // 把時鐘停住：定時輪詢不會發生，之後出現的名單請求只可能來自新增後的立即更新
    await page.clock.pauseAt(new Date(Date.now() + 1000))
    const polls = countPolls(page)

    await page.getByTestId('vibe-reception-add-guest').click()
    await page.getByTestId('vibe-reception-new-guest-name').fill('輪詢測試賓客')
    await page.getByTestId('vibe-reception-guest-submit').click()

    await expect.poll(() => polls.of('guests')).toBeGreaterThanOrEqual(1)
    await expect(page.getByTestId('reception-list').getByText('輪詢測試賓客').first()).toBeVisible()
  })
})
