// Source: app/pages/reception/index.vue + app/pages/weddings/[weddingId]/cake-box.vue（issue #138）
// Pattern: interaction（後台設定影響接待端呈現）
// 需求：有些款式只需新人知道 → 後台可關掉「接待台可選」；
//      組合款要在接待端展開內含單款，接待員才知道實際拿幾盒

import { expect, test } from '@playwright/test'

import { findEntity, login, resetMockData, TestUsers } from '../helpers'

const WID = 'wedding-001'
const RECEPTION_PATH = `/reception?weddingId=${WID}`
const TYPE_PATH = (id: string) => `/api/v1/weddings/${WID}/cake-box-types/${id}`

test.describe('vibe：喜餅款式在接待端的可見性與組合展開', () => {
  test('關閉「接待台可選」→ 該款不出現在接待端選款清單', async ({ page }) => {
    await resetMockData(page)
    await login(page, TestUsers.admin.account, TestUsers.admin.password)

    // 輕巧禮盒設為僅新人可見
    expect((await page.request.patch(TYPE_PATH('cakeboxtype-003'), {
      data: { visibleToReception: false },
    })).ok()).toBeTruthy()

    await page.goto(RECEPTION_PATH, { waitUntil: 'networkidle' })
    // guest-001 無指派 → 走選款按鈕開啟發放 modal
    await page.getByTestId('reception-cake-guest-001').click()
    await page.getByTestId('distribute-cake-select').click()

    await expect(page.getByRole('option', { name: /經典禮盒/ })).toBeVisible()
    await expect(page.getByRole('option', { name: /輕巧禮盒/ })).toHaveCount(0)
  })

  test('關閉可選的款式若已指派給賓客，接待端仍看得到款名', async ({ page }) => {
    await resetMockData(page)
    await login(page, TestUsers.admin.account, TestUsers.admin.password)

    // guest-006 在 seed 指派輕巧禮盒；把該款關閉可選後，指定款文字不該變空白
    expect((await page.request.patch(TYPE_PATH('cakeboxtype-003'), {
      data: { visibleToReception: false },
    })).ok()).toBeTruthy()

    await page.goto(RECEPTION_PATH, { waitUntil: 'networkidle' })
    // 款名在 checkbox 的 label 上（testid 落在 checkbox 元素本身），故以賓客卡片為範圍斷言
    await expect(page.getByTestId('reception-cake-tick-guest-006')).toBeVisible()
    await expect(findEntity(page, /黃雅婷/)).toContainText('輕巧禮盒')
  })

  test('組合款在接待端展開內含單款', async ({ page }) => {
    await resetMockData(page)
    await login(page, TestUsers.admin.account, TestUsers.admin.password)

    // 豪華禮盒改為組合（內含經典＋輕巧）；guest-002 在 seed 指派的正是豪華禮盒
    expect((await page.request.patch(TYPE_PATH('cakeboxtype-002'), {
      data: { componentTypeIds: ['cakeboxtype-001', 'cakeboxtype-003'] },
    })).ok()).toBeTruthy()

    await page.goto(RECEPTION_PATH, { waitUntil: 'networkidle' })
    await expect(page.getByTestId('reception-cake-tick-guest-002')).toBeVisible()
    // guest-002＝林美麗；組合內容顯示在打勾的 label 上
    await expect(findEntity(page, /林美麗/)).toContainText('豪華禮盒：經典禮盒＋輕巧禮盒')
  })
})
