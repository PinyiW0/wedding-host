// Source: app/pages/reception/index.vue（禮金彙總，issue #25）
// Pattern: new-region——宴後對帳視圖：總額／筆數／男方女方小計／逐筆清單
// 角色規則：對帳屬管理者／新人視角，現場共用接待帳號不顯示入口
// mock seed：無任何禮金；guest-001 陳大明（男方）、guest-002 林美麗（女方）；couple/couple1122＝新人（wedding-001）

import { expect, test } from '@playwright/test'

import { login, resetMockData, TestUsers } from '../helpers'

const RECEPTION_PATH = '/reception?weddingId=wedding-001'
const GIFT_API = (guestId: string) => `/api/v1/weddings/wedding-001/guests/${guestId}/gift-money`

test.describe('vibe：禮金彙總（管理者視角）', () => {
  test.beforeEach(async ({ page }) => {
    await resetMockData(page)
    await login(page, TestUsers.admin.account, TestUsers.admin.password)
  })

  test('登記兩筆後：總額、筆數、依側小計與逐筆清單一致', async ({ page }) => {
    // Given：男方 3600 + 女方 2000（API 先建資料，UI 驗彙總）
    await page.request.post(GIFT_API('guest-001'), { data: { amount: 3600 } })
    await page.request.post(GIFT_API('guest-002'), { data: { amount: 2000 } })
    await page.goto(RECEPTION_PATH, { waitUntil: 'networkidle' })

    await page.getByTestId('vibe-gift-summary-open').click()

    await expect(page.getByTestId('vibe-gift-summary-total')).toContainText('NT$ 5,600')
    await expect(page.getByTestId('vibe-gift-summary-count')).toContainText('共 2 筆')
    const groom = page.getByTestId('vibe-gift-summary-groom')
    await expect(groom).toContainText('NT$ 3,600')
    await expect(groom).toContainText('1 筆')
    const bride = page.getByTestId('vibe-gift-summary-bride')
    await expect(bride).toContainText('NT$ 2,000')
    await expect(bride).toContainText('1 筆')

    const list = page.getByTestId('vibe-gift-summary-list')
    await expect(list.getByText('陳大明')).toBeVisible()
    await expect(list.getByText('NT$ 3,600')).toBeVisible()
    await expect(list.getByText('林美麗')).toBeVisible()
    await expect(list.getByText('NT$ 2,000')).toBeVisible()
  })

  test('尚無禮金：彙總顯示空狀態與零值', async ({ page }) => {
    await page.goto(RECEPTION_PATH, { waitUntil: 'networkidle' })
    await page.getByTestId('vibe-gift-summary-open').click()

    await expect(page.getByTestId('vibe-gift-summary-total')).toContainText('NT$ 0')
    await expect(page.getByTestId('vibe-gift-summary-list').getByText('尚未登記任何禮金')).toBeVisible()
  })
})

test.describe('vibe：禮金彙總入口角色可見性', () => {
  test('接待員：不顯示禮金彙總入口（對帳非現場職責）', async ({ page }) => {
    await resetMockData(page)
    await login(page, TestUsers.receptionist.account, TestUsers.receptionist.password)
    await page.goto(RECEPTION_PATH, { waitUntil: 'networkidle' })

    // 現場功能不受影響：搜尋框仍在；彙總入口不存在
    await expect(page.getByTestId('vibe-reception-search')).toBeVisible()
    await expect(page.getByTestId('vibe-gift-summary-open')).toHaveCount(0)
  })

  test('新人：可見禮金彙總入口', async ({ page }) => {
    await resetMockData(page)
    await login(page, 'couple', 'couple1122')
    await page.goto(RECEPTION_PATH, { waitUntil: 'networkidle' })

    await page.getByTestId('vibe-gift-summary-open').click()
    await expect(page.getByTestId('vibe-gift-summary-total')).toBeVisible()
  })
})
