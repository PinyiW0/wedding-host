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

// 對應 spec/e2e-flows/02-accounts.flow.md（接待帳號建立 / 移除）
// Feature Background：已登入為管理員；已選定 wedding-001
// mock seed（全集）：account-001(reception-desk-1) / account-002(reception-desk-2) / account-003(reception-desk-3)，皆屬 wedding-001

test.beforeEach(async ({ page }) => {
  await resetMockData(page)
  await login(page, TestUsers.admin.account, TestUsers.admin.password)
})

test.describe('規則：成功建立接待帳號', () => {
  test('成功建立接待帳號', async ({ page }) => {
    // Given：清乾淨 wedding-001 既有 seed 帳號，使「reception-desk-1」為全新名稱（對齊 Feature Background：尚無此帳號）
    for (const accountId of ['account-001', 'account-002', 'account-003']) {
      await page.request.delete(
        `/api/v1/weddings/wedding-001/reception-accounts/${accountId}`,
      )
    }
    await page.goto('/weddings/wedding-001/accounts', { waitUntil: 'networkidle' })

    // When：觸發建立並填寫帳號名稱
    await page.getByRole('button', { name: /建立接待帳號|新增接待帳號|建立帳號|新增/ }).click()
    await page.getByLabel(/帳號名稱|帳號|名稱/).fill('reception-desk-1')

    // 主要 outcome：API spy 驗證 POST .../reception-accounts，payload 含 username
    const apiCall = waitForApiCall(page, /\/reception-accounts(\?|$)/, 'POST')
    await page.getByRole('button', { name: /建立|新增|送出|確定/ }).click()
    const request = await apiCall
    expect(request.postDataJSON()).toMatchObject({
      username: 'reception-desk-1',
    })

    // Then：列表新增可識別的 reception-desk-1 實體
    await expect(findEntity(page, /reception-desk-1/)).toBeVisible()
  })
})

test.describe('規則：帳號名稱已存在', () => {
  test('帳號名稱已存在', async ({ page }) => {
    // Given：wedding-001 下已有 reception-desk-1（mock seed account-001）
    await page.goto('/weddings/wedding-001/accounts', { waitUntil: 'networkidle' })

    // When：以相同帳號名稱建立
    await page.getByRole('button', { name: /建立接待帳號|新增接待帳號|建立帳號|新增/ }).click()
    await page.getByLabel(/帳號名稱|帳號|名稱/).fill('reception-desk-1')
    await page.getByRole('button', { name: /建立|新增|送出|確定/ }).click()

    // Then：使用者能感知失敗（API 合約錯誤訊息）
    await expect(page.getByText('帳號名稱已存在')).toBeVisible()
  })
})

test.describe('規則：成功移除接待帳號', () => {
  test('成功移除接待帳號', async ({ page }) => {
    // Given：wedding-001 下已有 account-001（reception-desk-1）
    await page.goto('/weddings/wedding-001/accounts', { waitUntil: 'networkidle' })

    // When：在 reception-desk-1 實體範圍觸發移除並完成確認
    const apiCall = waitForApiCall(
      page,
      /\/reception-accounts\/account-001(\?|$)/,
      'DELETE',
    )
    await findEntity(page, /reception-desk-1/).getByRole('button', { name: /移除|刪除/ }).click()
    await maybeConfirm(page)

    // Then：DELETE 端點被呼叫，帳號不再可見
    await apiCall
    await expect(getFeedbackElement(page)).toBeVisible()
    await expect(findEntity(page, /reception-desk-1/)).not.toBeVisible()
  })
})

test.describe('規則：移除不存在的接待帳號', () => {
  test('帳號不存在', async ({ page }) => {
    // 性質：API 邊界保護（UI 正常只對既有帳號顯示移除動作）
    const res = await page.request.delete(
      '/api/v1/weddings/wedding-001/reception-accounts/account-999',
    )
    expect(res.status()).toBe(404)
    expect(JSON.stringify(await res.json())).toContain('接待帳號不存在')
  })
})
