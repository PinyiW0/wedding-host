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

// 對應 spec/e2e-flows/06-cakebox.flow.md（喜餅款式 CRUD + 指派規則設定）
// Feature Background：已登入為管理員（Admin）；wedding-001 已選定
// mock seed（皆屬 wedding-001）：
//   cakeboxtype-001（經典禮盒 / isDefault true）
//   cakeboxtype-002（豪華禮盒）、cakeboxtype-003（輕巧禮盒）
// 註：mock 多 seed 兩款，部分 happy-path 為避免名稱碰撞，
//     test 內先用 page.request 裁剪到僅留 cakeboxtype-001（坑 #6）。

const CAKE_BOX_PATH = '/weddings/wedding-001/cake-box'

test.describe('喜餅款式管理（Admin 端）', () => {
  test.beforeEach(async ({ page }) => {
    await resetMockData(page)
    await login(page, TestUsers.admin.account, TestUsers.admin.password)
  })

  test.describe('規則：成功新增喜餅款式', () => {
    test('成功新增喜餅款式', async ({ page }) => {
      // Given：進入喜餅款式頁
      await page.goto(CAKE_BOX_PATH, { waitUntil: 'networkidle' })

      // When：觸發新增並填寫表單（名稱 / 說明 / 設為預設）
      await page.getByRole('button', { name: /新增喜餅款式|新增款式|新增/ }).click()
      await page.getByLabel(/名稱/).fill('頂級禮盒')
      await page.getByLabel(/說明|描述/).fill('全新頂級喜餅禮盒')
      // 設為預設 → 是
      await page.getByTestId('cake-box-default').check()

      // 主要 outcome：API spy 驗證 POST .../cake-box-types，payload 含 name / description / isDefault
      const apiCall = waitForApiCall(page, /\/cake-box-types(\?|$)/, 'POST')
      await page.getByRole('button', { name: /新增|建立|送出|確定/ }).click()
      const request = await apiCall
      expect(request.postDataJSON()).toMatchObject({
        name: '頂級禮盒',
        description: '全新頂級喜餅禮盒',
        isDefault: true,
      })

      // Then：列表新增可識別的「頂級禮盒」實體
      await expect(findEntity(page, /頂級禮盒/)).toBeVisible()
    })
  })

  test.describe('規則：成功更新喜餅款式', () => {
    test('成功更新喜餅款式', async ({ page }) => {
      // Given：僅保留 cakeboxtype-001（經典禮盒），避免改名後與既有「豪華禮盒」碰撞（坑 #6）
      await page.request.delete('/api/v1/weddings/wedding-001/cake-box-types/cakeboxtype-002')
      await page.request.delete('/api/v1/weddings/wedding-001/cake-box-types/cakeboxtype-003')
      await page.goto(CAKE_BOX_PATH, { waitUntil: 'networkidle' })

      // When：在 cakeboxtype-001（經典禮盒）範圍觸發編輯並修改名稱 / 說明
      await findEntity(page, /經典禮盒/).getByRole('button', { name: /編輯/ }).click()
      await page.getByLabel(/名稱/).fill('豪華禮盒')
      await page.getByLabel(/說明|描述/).fill('升級版豪華喜餅禮盒')

      // 主要 outcome：API spy 驗證 PATCH .../cake-box-types/cakeboxtype-001
      const apiCall = waitForApiCall(
        page,
        /\/cake-box-types\/cakeboxtype-001(\?|$)/,
        'PATCH',
      )
      await page.getByRole('button', { name: /儲存|更新|送出|確定/ }).click()
      const request = await apiCall
      expect(request.postDataJSON()).toMatchObject({
        name: '豪華禮盒',
        description: '升級版豪華喜餅禮盒',
      })

      // Then：能讀到新名稱「豪華禮盒」
      await expect(findEntity(page, /豪華禮盒/)).toBeVisible()
    })
  })

  test.describe('規則：更新不存在的喜餅款式', () => {
    test('喜餅款式不存在', async ({ page }) => {
      // 性質：API 邊界保護（UI 正常只對既有款式顯示編輯動作）
      const res = await page.request.patch(
        '/api/v1/weddings/wedding-001/cake-box-types/cakeboxtype-999',
        { data: { name: '不存在' } },
      )
      expect(res.status()).toBe(404)
      expect(JSON.stringify(await res.json())).toContain('喜餅款式不存在')
    })
  })

  test.describe('規則：成功移除喜餅款式', () => {
    test('成功移除喜餅款式', async ({ page }) => {
      // Given：cakeboxtype-001（經典禮盒）已存在
      await page.goto(CAKE_BOX_PATH, { waitUntil: 'networkidle' })

      // When：在 cakeboxtype-001 範圍觸發移除並完成確認
      const apiCall = waitForApiCall(
        page,
        /\/cake-box-types\/cakeboxtype-001(\?|$)/,
        'DELETE',
      )
      await findEntity(page, /經典禮盒/).getByRole('button', { name: /移除|刪除/ }).click()
      await maybeConfirm(page)

      // Then：DELETE 端點被呼叫，「經典禮盒」不再可見
      await apiCall
      await expect(getFeedbackElement(page)).toBeVisible()
      await expect(findEntity(page, /經典禮盒/)).not.toBeVisible()
    })
  })

  test.describe('規則：移除不存在的喜餅款式', () => {
    test('喜餅款式不存在', async ({ page }) => {
      // 性質：API 邊界保護
      const res = await page.request.delete(
        '/api/v1/weddings/wedding-001/cake-box-types/cakeboxtype-999',
      )
      expect(res.status()).toBe(404)
      expect(JSON.stringify(await res.json())).toContain('喜餅款式不存在')
    })
  })

  test.describe('規則：成功設定喜餅指派', () => {
    test('成功設定喜餅指派', async ({ page }) => {
      // Given：cakeboxtype-001（經典禮盒）已存在
      await page.goto(CAKE_BOX_PATH, { waitUntil: 'networkidle' })

      // When：觸發設定指派規則
      await page.getByRole('button', { name: /設定.*指派|指派規則/ }).click()
      // 文字欄位先填（坑 #8：下拉選擇排在所有文字 fill 之後）
      await page.getByLabel(/指派規則|規則/).fill('家人→大餅＋豪華禮盒')
      // 下拉：選擇喜餅款式 + 對象賓客（最後處理，避免 overlay 過渡攔截後續 fill）
      await selectOption(page, 'assignment-type-select', /經典禮盒/)
      await selectOption(page, 'assignment-guest-select', /陳大明/)

      // 主要 outcome：API spy 驗證 POST .../cake-box-types/cakeboxtype-001/assignment
      const apiCall = waitForApiCall(
        page,
        /\/cake-box-types\/cakeboxtype-001\/assignment(\?|$)/,
        'POST',
      )
      await page.getByRole('button', { name: /設定|新增|送出|確定/ }).click()
      const request = await apiCall
      expect(request.postDataJSON()).toMatchObject({
        guestId: 'guest-001',
        assignmentRule: '家人→大餅＋豪華禮盒',
      })

      // Then：使用者能感知指派已設定
      await expect(getFeedbackElement(page)).toBeVisible()
    })
  })

  test.describe('規則：設定指派時喜餅款式不存在', () => {
    test('喜餅款式不存在', async ({ page }) => {
      // 性質：API 邊界保護
      const res = await page.request.post(
        '/api/v1/weddings/wedding-001/cake-box-types/cakeboxtype-999/assignment',
        { data: { guestId: 'guest-001', assignmentRule: '家人→大餅＋豪華禮盒' } },
      )
      expect(res.status()).toBe(404)
      expect(JSON.stringify(await res.json())).toContain('喜餅款式不存在')
    })
  })
})
