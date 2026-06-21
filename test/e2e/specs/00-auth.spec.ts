import { expect, test } from '@playwright/test'

import { getFeedbackElement, resetMockData, waitForApiCall } from '../helpers'

// 對應 spec/e2e-flows/00-auth.flow.md（管理員註冊；Anonymous，不需登入）
// Feature Background：mock seed 無 admin@example.com，reset 後該 email 未被佔用

test.beforeEach(async ({ page }) => {
  await resetMockData(page)
})

test.describe('規則：成功註冊管理員', () => {
  test('成功註冊管理員', async ({ page }) => {
    // Given：Anonymous 開啟註冊頁，admin@example.com 尚未被任何管理員使用
    await page.goto('/register', { waitUntil: 'networkidle' })

    // When：填寫 email 與顯示名稱並提交
    await page.getByLabel(/電子郵件|email/i).fill('admin@example.com')
    await page.getByLabel(/顯示名稱|名稱/).fill('王小明')

    // 主要 outcome：API spy 驗證 POST /api/v1/admins 被呼叫，payload 含 email / displayName
    const apiCall = waitForApiCall(page, /\/admins(\?|$)/, 'POST')
    await page.getByRole('button', { name: /註冊|建立帳號|送出/ }).click()
    const request = await apiCall
    expect(request.postDataJSON()).toMatchObject({
      email: 'admin@example.com',
      displayName: '王小明',
    })

    // Then：使用者感知成功（成功反饋 / 導向後台）
    await expect(getFeedbackElement(page)).toBeVisible()
  })
})

test.describe('規則：Email 已被註冊', () => {
  test('Email 已被註冊', async ({ page }) => {
    // Given：已有管理員使用 admin@example.com（先透過 API 佔用該 email）
    await page.request.post('/api/v1/admins', {
      data: { email: 'admin@example.com', displayName: '已存在的管理員' },
    })
    await page.goto('/register', { waitUntil: 'networkidle' })

    // When：用相同 email 嘗試註冊
    await page.getByLabel(/電子郵件|email/i).fill('admin@example.com')
    await page.getByLabel(/顯示名稱|名稱/).fill('李小華')
    await page.getByRole('button', { name: /註冊|建立帳號|送出/ }).click()

    // Then：使用者能感知失敗原因（API 合約錯誤訊息）
    await expect(page.getByText('此電子郵件已被註冊')).toBeVisible()
  })
})
