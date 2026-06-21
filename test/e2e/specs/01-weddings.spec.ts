import { expect, test } from '@playwright/test'

import {
  findEntity,
  getFeedbackElement,
  login,
  maybeConfirm,
  resetMockData,
  TestUsers,
  waitForApiCall,
} from '../helpers'

// 對應 spec/e2e-flows/01-weddings.flow.md（婚禮 CRUD + 軟刪 / 恢復）
// Feature Background：已登入為管理員；mock seed 含 wedding-001（王小明與李小美的婚禮 / 台北君悅酒店 / 2026-10-10）

test.beforeEach(async ({ page }) => {
  await resetMockData(page)
  await login(page, TestUsers.admin.account, TestUsers.admin.password)
})

test.describe('規則：成功建立婚禮', () => {
  test('成功建立婚禮', async ({ page }) => {
    // Given：進入婚禮列表
    await page.goto('/weddings', { waitUntil: 'networkidle' })

    // When：觸發建立並填寫表單
    await page.getByRole('button', { name: /建立婚禮|新增婚禮|新增/ }).click()
    await page.getByLabel(/婚禮名稱|名稱/).fill('王小明與李小美的婚禮')
    await page.getByLabel(/場地/).fill('台北君悅酒店')
    await page.getByLabel(/地址/).fill('台北市信義區松壽路2號')
    await page.getByLabel(/日期/).fill('2026-10-10')

    // 主要 outcome：API spy 驗證 POST /api/v1/weddings，payload 含 title / venue / address / date
    const apiCall = waitForApiCall(page, /\/weddings(\?|$)/, 'POST')
    await page.getByRole('button', { name: /建立|新增|送出|確定/ }).click()
    const request = await apiCall
    expect(request.postDataJSON()).toMatchObject({
      title: '王小明與李小美的婚禮',
      venue: '台北君悅酒店',
      address: '台北市信義區松壽路2號',
      date: '2026-10-10',
    })

    // Then：使用者感知成功
    await expect(getFeedbackElement(page)).toBeVisible()
  })
})

test.describe('規則：成功更新婚禮資訊', () => {
  test('成功更新婚禮資訊', async ({ page }) => {
    // Given：進入 wedding-001 詳情 / 編輯入口
    await page.goto('/weddings/wedding-001', { waitUntil: 'networkidle' })

    // When：觸發編輯並修改欄位
    await page.getByRole('button', { name: /編輯/ }).click()
    await page.getByLabel(/場地/).fill('台北晶華酒店')
    await page.getByLabel(/地址/).fill('台北市中山區中山北路二段39巷3號')
    await page.getByLabel(/日期/).fill('2026-11-11')
    await page.getByLabel(/地圖/).fill('https://maps.google.com/example')
    await page.getByLabel(/停車/).fill('飯店地下停車場B2')
    await page.getByLabel(/交通/).fill('捷運中山站步行5分鐘')

    // 主要 outcome：API spy 驗證 PATCH /api/v1/weddings/wedding-001
    const apiCall = waitForApiCall(page, /\/weddings\/wedding-001(\?|$)/, 'PATCH')
    await page.getByRole('button', { name: /儲存|更新|送出|確定/ }).click()
    const request = await apiCall
    expect(request.postDataJSON()).toMatchObject({
      venue: '台北晶華酒店',
      address: '台北市中山區中山北路二段39巷3號',
      date: '2026-11-11',
      mapLink: 'https://maps.google.com/example',
      parkingInfo: '飯店地下停車場B2',
      transportInfo: '捷運中山站步行5分鐘',
    })

    // Then：更新後能讀到新場地
    await expect(page.getByText(/台北晶華酒店/).first()).toBeVisible()
  })
})

test.describe('規則：更新不存在的婚禮', () => {
  test('婚禮不存在', async ({ page }) => {
    // 性質：API 邊界保護（UI 正常不會進入此狀態）
    const res = await page.request.patch('/api/v1/weddings/wedding-999', {
      data: { venue: '不存在的場地' },
    })
    expect(res.status()).toBe(404)
    expect(JSON.stringify(await res.json())).toContain('婚禮不存在')
  })
})

test.describe('規則：成功軟刪除婚禮', () => {
  test('成功軟刪除婚禮', async ({ page }) => {
    // Given：wedding-001 已建立、未刪除
    await page.goto('/weddings', { waitUntil: 'networkidle' })

    // When：在 wedding-001 實體範圍觸發刪除並完成確認
    const apiCall = waitForApiCall(page, /\/weddings\/wedding-001(\?|$)/, 'DELETE')
    await findEntity(page, /王小明與李小美的婚禮/).getByRole('button', { name: /刪除/ }).click()
    await maybeConfirm(page)

    // Then：軟刪端點被呼叫
    await apiCall
    await expect(getFeedbackElement(page)).toBeVisible()
  })
})

test.describe('規則：重複軟刪除婚禮', () => {
  test('婚禮已軟刪除', async ({ page }) => {
    // 性質：API 邊界保護
    // Given：先軟刪除 wedding-001
    const first = await page.request.delete('/api/v1/weddings/wedding-001')
    expect(first.ok()).toBeTruthy()

    // When：再次刪除已軟刪除的 wedding-001
    const res = await page.request.delete('/api/v1/weddings/wedding-001')
    expect(res.status()).toBe(409)
    expect(JSON.stringify(await res.json())).toContain('婚禮已被刪除')
  })
})

test.describe('規則：軟刪除不存在的婚禮', () => {
  test('婚禮不存在', async ({ page }) => {
    // 性質：API 邊界保護
    const res = await page.request.delete('/api/v1/weddings/wedding-999')
    expect(res.status()).toBe(404)
    expect(JSON.stringify(await res.json())).toContain('婚禮不存在')
  })
})

test.describe('規則：成功恢復婚禮', () => {
  test('成功恢復婚禮', async ({ page }) => {
    // Given：wedding-001 已建立且已軟刪除
    await page.request.delete('/api/v1/weddings/wedding-001')
    await page.goto('/weddings', { waitUntil: 'networkidle' })

    // When：在已軟刪除的 wedding-001 範圍觸發恢復
    const apiCall = waitForApiCall(page, /\/weddings\/wedding-001\/restore(\?|$)/, 'POST')
    await findEntity(page, /王小明與李小美的婚禮/).getByRole('button', { name: /恢復/ }).click()
    await maybeConfirm(page)

    // Then：restore 端點被呼叫
    await apiCall
    await expect(getFeedbackElement(page)).toBeVisible()
  })
})

test.describe('規則：恢復不存在的婚禮', () => {
  test('婚禮不存在', async ({ page }) => {
    // 性質：API 邊界保護
    const res = await page.request.post('/api/v1/weddings/wedding-999/restore')
    expect(res.status()).toBe(404)
    expect(JSON.stringify(await res.json())).toContain('婚禮不存在')
  })
})

test.describe('規則：恢復未被刪除的婚禮', () => {
  test('婚禮未被刪除', async ({ page }) => {
    // 性質：API 邊界保護（wedding-001 為未刪除狀態）
    const res = await page.request.post('/api/v1/weddings/wedding-001/restore')
    expect(res.status()).toBe(409)
    expect(JSON.stringify(await res.json())).toContain('婚禮未被刪除')
  })
})
