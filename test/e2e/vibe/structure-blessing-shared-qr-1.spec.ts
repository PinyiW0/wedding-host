// Source: app/pages/blessing/[weddingId].vue + app/pages/weddings/[weddingId]/blessings.vue（共用祝福 QR，issue #17）
// Pattern: new-region + interaction

import { expect, test } from '@playwright/test'

import { login, resetMockData, TestUsers, waitForApiCall } from '../helpers'

test.describe('vibe：共用祝福 QR', () => {
  test.beforeEach(async ({ page }) => {
    await resetMockData(page)
  })

  test('共用連結（無 guestId）：顯示姓名欄，提交 payload 帶 guestName', async ({ page }) => {
    await page.goto('/blessing/wedding-001', { waitUntil: 'networkidle' })

    const nameInput = page.getByTestId('vibe-blessing-guest-name')
    await expect(nameInput).toBeVisible()
    await nameInput.fill('王小美')
    await page.getByTestId('blessing-message').fill('新婚快樂！')

    const apiCall = waitForApiCall(page, /\/weddings\/wedding-001\/blessings(\?|$)/, 'POST')
    await page.getByTestId('blessing-submit').click()
    const request = await apiCall
    expect(request.postDataJSON()).toMatchObject({
      guestName: '王小美',
      message: '新婚快樂！',
    })
    await expect(page.getByTestId('blessing-submit-success')).toBeVisible()
  })

  test('專屬連結（帶 guestId）：不顯示姓名欄，行為不變', async ({ page }) => {
    await page.goto('/blessing/wedding-001?guestId=guest-001', { waitUntil: 'networkidle' })
    await expect(page.getByTestId('blessing-message')).toBeVisible()
    await expect(page.getByTestId('vibe-blessing-guest-name')).toHaveCount(0)
  })

  test('管理端：共用祝福 QR 入口開啟面板（QR 圖 + 複製按鈕）', async ({ page }) => {
    await login(page, TestUsers.admin.account, TestUsers.admin.password)
    await page.goto('/weddings/wedding-001/blessings', { waitUntil: 'networkidle' })

    await page.getByTestId('vibe-shared-blessing-qr').click()
    const panel = page.getByTestId('vibe-shared-blessing-panel')
    await expect(panel).toBeVisible()
    await expect(panel.locator('img')).toBeVisible()
    await expect(panel.getByTestId('vibe-shared-blessing-copy')).toBeVisible()
  })

  test('管理端審核列表：共用提交顯示自填姓名（現場填寫）', async ({ page }) => {
    // 先以 API 建立一筆共用提交（guestName、無 guestId）
    const res = await page.request.post('/api/v1/weddings/wedding-001/blessings', {
      data: { guestName: '王小美', message: '新婚快樂！' },
    })
    expect(res.status()).toBe(201)

    await login(page, TestUsers.admin.account, TestUsers.admin.password)
    await page.goto('/weddings/wedding-001/blessings', { waitUntil: 'networkidle' })
    await expect(page.getByText('王小美 · 現場填寫')).toBeVisible()
  })
})
