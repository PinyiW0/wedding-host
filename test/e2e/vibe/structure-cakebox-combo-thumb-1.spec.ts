// Source: app/components/common/CakeBoxThumb.vue + app/pages/weddings/[weddingId]/cake-box.vue
//         + app/pages/reception/index.vue（issue #140）
// Pattern: structure（縮圖在後台款式列與接待端賓客卡片的呈現）
// 需求：組合款要看得出實際包含哪幾盒 → 縮圖展開成內含各單款的圖；
//      沒有圖的款式安靜佔位（icon），不留破圖框

import type { Page } from '@playwright/test'

import { expect, test } from '@playwright/test'

import { findEntity, login, resetMockData, TestUsers } from '../helpers'

const WID = 'wedding-001'
const CAKE_BOX_PATH = `/weddings/${WID}/cake-box`
const RECEPTION_PATH = `/reception?weddingId=${WID}`
const TYPE_PATH = (id: string) => `/api/v1/weddings/${WID}/cake-box-types/${id}`

// 1x1 圖的 data URL：款式縮圖的既有儲存格式，兩張刻意不同以驗證「並排的是內含單款各自的圖」
const PNG_1X1 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
const GIF_1X1 = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'

// 經典（001）／輕巧（003）各給一張圖，豪華（002）設為內含這兩款的組合
async function setUpCombo(page: Page) {
  expect((await page.request.patch(TYPE_PATH('cakeboxtype-001'), {
    data: { imageUrl: PNG_1X1 },
  })).ok()).toBeTruthy()
  expect((await page.request.patch(TYPE_PATH('cakeboxtype-003'), {
    data: { imageUrl: GIF_1X1 },
  })).ok()).toBeTruthy()
  expect((await page.request.patch(TYPE_PATH('cakeboxtype-002'), {
    data: { componentTypeIds: ['cakeboxtype-001', 'cakeboxtype-003'] },
  })).ok()).toBeTruthy()
}

test.describe('vibe：喜餅款式縮圖（組合款展開內含）', () => {
  test('後台：組合款縮圖並排內含各單款的圖', async ({ page }) => {
    await resetMockData(page)
    await login(page, TestUsers.admin.account, TestUsers.admin.password)
    await setUpCombo(page)

    await page.goto(CAKE_BOX_PATH, { waitUntil: 'networkidle' })

    const comboRow = page.getByTestId('cake-box-row-cakeboxtype-002')
    await expect(comboRow.locator('img')).toHaveCount(2)
    // 並排的是內含單款各自的圖，不是組合款自己的圖（組合款本身沒設圖）
    await expect(comboRow.locator('img').first()).toHaveAttribute('src', PNG_1X1)
    await expect(comboRow.locator('img').nth(1)).toHaveAttribute('src', GIF_1X1)
  })

  test('後台：沒有圖的款式不渲染 img（安靜以 icon 佔位）', async ({ page }) => {
    await resetMockData(page)
    await login(page, TestUsers.admin.account, TestUsers.admin.password)

    await page.goto(CAKE_BOX_PATH, { waitUntil: 'networkidle' })

    // seed 三款皆無縮圖 → 佔位不應留下破圖
    await expect(page.getByTestId('cake-box-row-cakeboxtype-001')).toBeVisible()
    await expect(page.getByTestId('cake-box-row-cakeboxtype-001').locator('img')).toHaveCount(0)
  })

  test('接待端：指定組合款的賓客卡片帶內含各單款的縮圖', async ({ page }) => {
    await resetMockData(page)
    await login(page, TestUsers.admin.account, TestUsers.admin.password)
    await setUpCombo(page)

    await page.goto(RECEPTION_PATH, { waitUntil: 'networkidle' })

    // guest-002＝林美麗，seed 指派豪華禮盒（已於上方改成組合款）
    await expect(page.getByTestId('reception-cake-tick-guest-002')).toBeVisible()
    await expect(findEntity(page, /林美麗/).locator('img')).toHaveCount(2)
  })
})
