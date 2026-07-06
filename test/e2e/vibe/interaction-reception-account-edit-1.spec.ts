// Source: app/pages/weddings/[weddingId]/accounts.vue + PATCH reception-accounts（issue #23）
// Pattern: edit-modal（改名／重設密碼——打錯密碼不再只能砍掉重建）

import { expect, test } from '@playwright/test'

import {
  findEntity,
  login,
  resetMockData,
  TestUsers,
  waitForApiCall,
} from '../helpers'

// mock seed：wedding-001 下 account-001(reception-desk-1) / account-002(reception-desk-2) / account-003(reception-desk-3)
const ACCOUNTS_URL = '/weddings/wedding-001/accounts'

test.describe('vibe：接待帳號編輯', () => {
  test.beforeEach(async ({ page }) => {
    await resetMockData(page)
    await login(page, TestUsers.admin.account, TestUsers.admin.password)
    await page.goto(ACCOUNTS_URL, { waitUntil: 'networkidle' })
  })

  test('重設密碼：PATCH 帶新密碼，之後可用新密碼登入接待端', async ({ page }) => {
    await findEntity(page, /reception-desk-1/).getByRole('button', { name: /編輯/ }).click()
    await expect(page.getByTestId('vibe-account-edit-modal')).toBeVisible()
    await page.getByTestId('vibe-account-edit-password').fill('desk1new456')

    // 等 PATCH「回應完成」而非僅請求發出，避免後續登入驗證與寫入賽跑
    const patchDone = page.waitForResponse(res =>
      /\/reception-accounts\/account-001(?:\?|$)/.test(res.url()) && res.request().method() === 'PATCH' && res.ok())
    await page.getByTestId('vibe-account-edit-submit').click()
    const response = await patchDone
    expect(response.request().postDataJSON()).toMatchObject({
      username: 'reception-desk-1',
      password: 'desk1new456',
    })
    await expect(page.getByTestId('vibe-account-edit-modal')).toBeHidden()

    // 新密碼可登入接待端（scrypt 正確入庫、角色為接待員）
    const res = await page.request.post('/api/v1/auth/login', {
      data: { username: 'reception-desk-1', password: 'desk1new456' },
    })
    expect(res.status()).toBe(201)
    expect((await res.json()).role).toBe('接待員')
  })

  test('改名：列表反映新帳號名稱', async ({ page }) => {
    await findEntity(page, /reception-desk-1/).getByRole('button', { name: /編輯/ }).click()
    await page.getByTestId('vibe-account-edit-username').fill('reception-desk-9')

    const apiCall = waitForApiCall(page, /\/reception-accounts\/account-001(\?|$)/, 'PATCH')
    await page.getByTestId('vibe-account-edit-submit').click()
    await apiCall

    await expect(findEntity(page, /reception-desk-9/)).toBeVisible()
    await expect(findEntity(page, /reception-desk-1$/)).not.toBeVisible()
  })

  test('改名撞名：同婚禮已有同名帳號 → 使用者能感知失敗', async ({ page }) => {
    await findEntity(page, /reception-desk-1/).getByRole('button', { name: /編輯/ }).click()
    await page.getByTestId('vibe-account-edit-username').fill('reception-desk-2')
    await page.getByTestId('vibe-account-edit-submit').click()

    await expect(page.getByTestId('vibe-account-edit-error')).toContainText('帳號名稱已存在')
  })
})
