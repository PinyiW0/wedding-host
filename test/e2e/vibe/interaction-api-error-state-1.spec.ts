// Source: app/composables/useHttp.ts（讀取錯誤集中 toast）+ guests/seating 讀取失敗錯誤狀態（issue #103）
// Pattern: error——API 讀取失敗顯示錯誤提示與重試，不得因 default 值靜默吞成空清單樣貌
// 注意：SSR 期間的 fetch 由 server 端執行、Playwright route 攔不到，
//       故一律先 SSR 進婚禮總覽，再點側欄做 client-side 導航讓瀏覽器發出讀取請求
// mock seed：wedding-001 有賓客（陳大明）與桌次，正常載入絕不會出現空狀態文案

import { expect, test } from '@playwright/test'

import { login, resetMockData, TestUsers } from '../helpers'

const OVERVIEW_PATH = '/weddings/wedding-001'

// 側欄導航（scope 到 sidebar，避免撞頁內同名連結）
function navLink(page: import('@playwright/test').Page, label: string) {
  return page.getByTestId('vibe-sidebar').getByRole('link', { name: label, exact: true })
}

// 攔截指定 API glob 回 500；回傳開關（設 false 後放行，供重試恢復用）
async function fail500(page: import('@playwright/test').Page, glob: string) {
  const state = { active: true }
  await page.route(glob, (route) => {
    if (!state.active)
      return route.continue()
    return route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({ statusCode: 500, message: 'Internal Server Error' }),
    })
  })
  return state
}

test.beforeEach(async ({ page }) => {
  await resetMockData(page)
  await login(page, TestUsers.admin.account, TestUsers.admin.password)
  await page.goto(OVERVIEW_PATH, { waitUntil: 'networkidle' })
})

test.describe('API 讀取失敗顯示錯誤狀態（issue #103）', () => {
  test('賓客名單讀取失敗：顯示錯誤與重試，不顯示空清單樣貌；重試成功後恢復名單', async ({ page }) => {
    // Given：賓客 API 故障（回 500）
    const guestsApi = await fail500(page, '**/api/v1/weddings/*/guests')

    // When：client-side 導航進賓客名單頁
    await navLink(page, '賓客名單').click()

    // Then：顯示明確錯誤提示與重試按鈕，不以空清單樣貌呈現
    await expect(page.getByTestId('vibe-guests-load-error')).toBeVisible()
    await expect(page.getByText('賓客名單載入失敗')).toBeVisible()
    await expect(page.getByText('目前沒有賓客')).toHaveCount(0)
    await expect(page.getByTestId('vibe-guest-stats')).toHaveCount(0)

    // When：後端恢復後點重新載入
    guestsApi.active = false
    await page.getByTestId('vibe-guests-retry').click()

    // Then：錯誤消失、名單恢復（seed 賓客可見）
    await expect(page.getByTestId('vibe-guests-load-error')).toHaveCount(0)
    await expect(page.getByText('陳大明').first()).toBeVisible()
  })

  test('桌次規劃讀取失敗：顯示錯誤與重試，不以「無桌次」樣貌呈現；重試成功後恢復', async ({ page }) => {
    // Given：桌次 API 故障（回 500）
    const tablesApi = await fail500(page, '**/api/v1/weddings/*/tables')

    // When：client-side 導航進桌次規劃頁
    await navLink(page, '桌次規劃').click()

    // Then：顯示明確錯誤提示與重試按鈕，不以「目前沒有桌次」樣貌呈現
    await expect(page.getByTestId('vibe-seating-load-error')).toBeVisible()
    await expect(page.getByText('桌次資料載入失敗')).toBeVisible()
    await expect(page.getByText('目前沒有桌次')).toHaveCount(0)

    // When：後端恢復後點重新載入
    tablesApi.active = false
    await page.getByTestId('vibe-seating-retry').click()

    // Then：錯誤消失、待排席側欄與桌面恢復
    await expect(page.getByTestId('vibe-seating-load-error')).toHaveCount(0)
    await expect(page.getByTestId('vibe-seating-guest-guest-001')).toBeVisible()
  })

  test('其他管理頁讀取失敗：至少有 toast 級錯誤回饋（不被 default 值靜默吞掉）', async ({ page }) => {
    // Given：當天流程項目 API 故障（回 500）
    await fail500(page, '**/api/v1/weddings/*/rundown-items')

    // When：client-side 導航進當天流程頁
    await navLink(page, '當天流程').click()

    // Then：出現讀取失敗 toast（NuxtUI toast 為雙元素，取 first）
    await expect(page.getByText('資料載入失敗').first()).toBeVisible()
  })
})
