// Source: app/pages/weddings/[weddingId]/guests.vue（賓客名單批次操作，issue #75）
// Pattern: multi-select——多選模式批次移除／改分類（批次單端點收 guestId 陣列）
//          ＋待確認區一鍵全部建為新賓客／全部略過（逐筆呼叫既有端點，toast 統計）
// mock seed：wedding-001 guest-001 陳大明（同事）、guest-002 林美麗（朋友）、guest-005 張文彬（同事）

import { expect, test } from '@playwright/test'

import { findEntity, login, resetMockData, TestUsers } from '../helpers'

const GUESTS_PATH = '/weddings/wedding-001/guests'

// 等批次端點完成（等 response 而非 request，避免 reload/斷言早於寫入的時序 flaky）
function waitBatchDone(page: import('@playwright/test').Page, endpoint: 'batch-delete' | 'batch-category') {
  return page.waitForResponse(res =>
    new RegExp(`/guests/${endpoint}(?:\\?|$)`).test(res.url())
      && res.request().method() === 'POST' && res.ok())
}

// 等單筆待確認處理完成（confirm / reject）
function waitPendingDone(page: import('@playwright/test').Page, guestId: string, action: 'confirm' | 'reject') {
  return page.waitForResponse(res =>
    new RegExp(`/pending-guests/${guestId}/${action}(?:\\?|$)`).test(res.url())
      && res.request().method() === 'POST' && res.ok())
}

// 建立一筆待確認賓客（沿用公開提交端點），回傳 guestId
async function seedPending(
  request: import('@playwright/test').APIRequestContext,
  guestName: string,
  phone: string,
) {
  const res = await request.post('/api/v1/weddings/wedding-001/guests/rsvp-public', {
    data: { guestName, phone, attending: 'attending', diet: 'meat', plusOneCount: 0, childChairCount: 0 },
  })
  expect(res.ok()).toBeTruthy()
  return (await res.json()).guestId as string
}

test.describe('vibe：賓客名單批次操作', () => {
  test.beforeEach(async ({ page }) => {
    await resetMockData(page)
    await login(page, TestUsers.admin.account, TestUsers.admin.password)
    await page.goto(GUESTS_PATH, { waitUntil: 'networkidle' })
  })

  test('多選兩位批次移除：單端點收陣列、列表移除、有回饋', async ({ page }) => {
    await page.getByTestId('vibe-guest-batch-toggle').click()
    await page.getByTestId('vibe-guest-batch-tick-guest-001').click()
    await page.getByTestId('vibe-guest-batch-tick-guest-002').click()
    await expect(page.getByTestId('vibe-guest-batch-remove')).toContainText('移除 2 位')

    const done = waitBatchDone(page, 'batch-delete')
    await page.getByTestId('vibe-guest-batch-remove').click()
    await page.getByTestId('confirm-ok').click()
    await done

    // 列表刷新後兩位消失，回饋含實際筆數
    await expect(page.getByText(/已移除 2 位賓客/).first()).toBeVisible()
    await expect(findEntity(page, /陳大明/)).not.toBeVisible()
    await expect(findEntity(page, /林美麗/)).not.toBeVisible()
  })

  test('多選批次改分類：列表分類同步更新、快選清單納入新分類', async ({ page }) => {
    await page.getByTestId('vibe-guest-batch-toggle').click()
    await page.getByTestId('vibe-guest-batch-tick-guest-001').click()
    await page.getByTestId('vibe-guest-batch-tick-guest-005').click()
    await page.getByTestId('vibe-guest-batch-category').click()

    await page.getByTestId('vibe-guest-batch-category-input').fill('貴賓')
    const done = waitBatchDone(page, 'batch-category')
    await page.getByTestId('vibe-guest-batch-category-submit').click()
    await done

    await expect(page.getByText(/已將 2 位賓客分類為「貴賓」/).first()).toBeVisible()
    await expect(findEntity(page, /陳大明/).getByText('貴賓')).toBeVisible()
    await expect(findEntity(page, /張文彬/).getByText('貴賓')).toBeVisible()
  })

  test('全選過濾結果：以搜尋範圍為準', async ({ page }) => {
    await page.getByTestId('vibe-guests-search').fill('文彬')
    await page.getByTestId('vibe-guest-batch-toggle').click()
    await page.getByTestId('vibe-guest-batch-select-all').click()
    await expect(page.getByTestId('vibe-guest-batch-remove')).toContainText('移除 1 位')
  })

  test('取消多選：工具列收起、勾選欄消失且不觸發操作', async ({ page }) => {
    await page.getByTestId('vibe-guest-batch-toggle').click()
    await page.getByTestId('vibe-guest-batch-tick-guest-001').click()
    await page.getByTestId('vibe-guest-batch-toggle').click()

    await expect(page.getByTestId('vibe-guest-batch-toolbar')).toHaveCount(0)
    await expect(page.getByTestId('vibe-guest-batch-tick-guest-001')).toHaveCount(0)
    await expect(findEntity(page, /陳大明/)).toBeVisible()
  })

  test('待確認區一鍵全部建為新賓客：逐筆 confirm、toast 統計、進入正式名單', async ({ page }) => {
    const idA = await seedPending(page.request, '王小明', '0911000111')
    const idB = await seedPending(page.request, '李小華', '0911000222')
    await page.goto(GUESTS_PATH, { waitUntil: 'networkidle' })
    await page.getByTestId('vibe-guests-filter-review').click()

    const done = Promise.all([
      waitPendingDone(page, idA, 'confirm'),
      waitPendingDone(page, idB, 'confirm'),
    ])
    await page.getByTestId('vibe-pending-confirm-all').click()
    await done

    await expect(page.getByText(/全部建立完成：成功 2、失敗 0/).first()).toBeVisible()
    // 待確認清空、兩位進入正式名單
    await expect(page.getByText(/目前沒有待確認回覆/)).toBeVisible()
    await page.getByTestId('vibe-guests-filter-all').click()
    await expect(findEntity(page, /王小明/)).toBeVisible()
    await expect(findEntity(page, /李小華/)).toBeVisible()
  })

  test('批次端點租戶邊界：他場婚禮路徑不命中本場賓客（API 邊界）', async ({ page }) => {
    // 單語句 where 綁 weddingId：他場路徑收本場 guestId 應零命中、資料不動
    const res = await page.request.post('/api/v1/weddings/wedding-002/guests/batch-delete', {
      data: { guestIds: ['guest-001'] },
    })
    expect(res.ok()).toBeTruthy()
    expect((await res.json()).deletedCount).toBe(0)
    const guests = await (await page.request.get('/api/v1/weddings/wedding-001/guests')).json()
    expect(guests.some((g: { guestId: string, deletedAt: string | null }) => g.guestId === 'guest-001' && !g.deletedAt)).toBeTruthy()
  })

  test('待確認區一鍵全部略過：確認後逐筆 reject、待確認清空', async ({ page }) => {
    const idA = await seedPending(page.request, '王小明', '0911000333')
    const idB = await seedPending(page.request, '李小華', '0911000444')
    await page.goto(GUESTS_PATH, { waitUntil: 'networkidle' })
    await page.getByTestId('vibe-guests-filter-review').click()

    const done = Promise.all([
      waitPendingDone(page, idA, 'reject'),
      waitPendingDone(page, idB, 'reject'),
    ])
    await page.getByTestId('vibe-pending-reject-all').click()
    await page.getByTestId('confirm-ok').click()
    await done

    await expect(page.getByText(/全部略過完成：成功 2、失敗 0/).first()).toBeVisible()
    await expect(page.getByText(/目前沒有待確認回覆/)).toBeVisible()
  })
})
