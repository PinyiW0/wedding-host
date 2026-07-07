// Source: app/pages/reception/index.vue（接待台手機體驗，issue #25）
// Pattern: responsive——375px 寬完成「搜尋→報到→登記禮金」全流程且無橫向捲動

import { expect, test } from '@playwright/test'

import { findEntity, login, resetMockData, TestUsers } from '../helpers'

const RECEPTION_PATH = '/reception?weddingId=wedding-001'

test.use({ viewport: { width: 375, height: 812 } })

test.describe('vibe：接待台手機（375px）', () => {
  test.beforeEach(async ({ page }) => {
    await resetMockData(page)
    await login(page, TestUsers.receptionist.account, TestUsers.receptionist.password)
    await page.goto(RECEPTION_PATH, { waitUntil: 'networkidle' })
  })

  test('搜尋→報到→登記禮金全流程可完成', async ({ page }) => {
    // 搜尋
    await page.getByTestId('vibe-reception-search').fill('陳大明')

    // 報到
    const checkinDone = page.waitForResponse(res =>
      /\/guests\/guest-001\/check-in(?:\?|$)/.test(res.url()) && res.ok())
    await findEntity(page, /陳大明/).getByRole('button', { name: /報到/ }).click()
    await checkinDone
    await expect(page.getByTestId('vibe-checkin-table-banner')).toContainText('主桌')

    // 登記禮金
    await findEntity(page, /陳大明/).getByRole('button', { name: /登記禮金|登記/ }).click()
    await page.getByLabel(/金額|禮金/).fill('3600')
    const giftDone = page.waitForResponse(res =>
      /\/guests\/guest-001\/gift-money(?:\?|$)/.test(res.url()) && res.ok())
    await page.getByRole('button', { name: /登記|送出|確定|儲存/ }).click()
    await giftDone
    await expect(findEntity(page, /陳大明/).getByText('NT$ 3,600')).toBeVisible()
  })

  test('左右欄上下堆疊不重疊：桌次圖排在搜尋框之後、名單有實際高度', async ({ page }) => {
    // 鎖高壓扁互疊的回歸保護：桌次圖標題必須在搜尋框下方，不可蓋到左欄
    const search = await page.getByTestId('vibe-reception-search').boundingBox()
    const floorPlanTitle = await page.getByRole('heading', { name: '現場桌次圖' }).boundingBox()
    expect(floorPlanTitle!.y).toBeGreaterThan(search!.y + search!.height)

    // 名單被壓扁時高度趨近 0（seed 19 組賓客應遠大於此）
    const list = await page.getByTestId('reception-list').boundingBox()
    expect(list!.height).toBeGreaterThan(300)
  })

  test('主要操作按鈕達 44px 觸控目標（多選報到、批量工具列、卡片動作）', async ({ page }) => {
    const toggle = await page.getByTestId('vibe-batch-toggle').boundingBox()
    expect(toggle!.height).toBeGreaterThanOrEqual(44)

    // 卡片動作：登記禮金 / 發放喜餅 / 報到
    for (const testId of ['reception-gift-guest-001', 'reception-cake-guest-001', 'reception-checkin-guest-001']) {
      const box = await page.getByTestId(testId).boundingBox()
      expect(box!.height, testId).toBeGreaterThanOrEqual(44)
    }

    await page.getByTestId('vibe-batch-toggle').click()
    const selectAll = await page.getByTestId('vibe-batch-select-all').boundingBox()
    const batchButton = await page.getByTestId('vibe-batch-checkin').boundingBox()
    expect(selectAll!.height).toBeGreaterThanOrEqual(44)
    expect(batchButton!.height).toBeGreaterThanOrEqual(44)
  })

  test('身分膠囊顯示實際登入身分（接待員）', async ({ page }) => {
    await expect(page.getByTestId('reception-page').getByText('接待 · 共用帳號')).toBeVisible()
  })

  test('頁面無橫向捲動', async ({ page }) => {
    // 主捲動容器與文件根都不得出現水平溢出
    const overflow = await page.evaluate(() => {
      const doc = document.documentElement
      const main = document.querySelector('main')
      return {
        doc: doc.scrollWidth - doc.clientWidth,
        main: main ? main.scrollWidth - main.clientWidth : 0,
      }
    })
    expect(overflow.doc).toBeLessThanOrEqual(0)
    expect(overflow.main).toBeLessThanOrEqual(0)
  })
})

test.describe('vibe：接待台手機（375px，管理者視角）', () => {
  test('禮金彙總按鈕達 44px 觸控目標', async ({ page }) => {
    await resetMockData(page)
    await login(page, TestUsers.admin.account, TestUsers.admin.password)
    await page.goto(RECEPTION_PATH, { waitUntil: 'networkidle' })

    const box = await page.getByTestId('vibe-gift-summary-open').boundingBox()
    expect(box!.height).toBeGreaterThanOrEqual(44)

    // 身分膠囊反映實際登入者，不再寫死「接待 · 共用帳號」
    const receptionPage = page.getByTestId('reception-page')
    await expect(receptionPage.getByText('主辦 · 管理員')).toBeVisible()
    await expect(receptionPage.getByText('接待 · 共用帳號')).toHaveCount(0)
  })
})
