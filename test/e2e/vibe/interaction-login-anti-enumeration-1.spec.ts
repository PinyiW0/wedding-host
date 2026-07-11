// Source: server/api/v1/auth/login.post.ts、app/pages/login.vue（issue #38 防帳號枚舉）
// Pattern: error-feedback——查無帳號與密碼錯誤的回應必須一致（同訊息），
// 使外部無法從登入回應分辨帳號是否存在；登入頁不再提供公開註冊入口
// （正式站 bootstrap 已關閉，/register 僅供 open 模式 e2e 與首次開通直接進入）

import { expect, test } from '@playwright/test'

import { resetMockData } from '../helpers'

test.describe('vibe：登入防帳號枚舉', () => {
  test.beforeEach(async ({ page }) => {
    await resetMockData(page)
  })

  test('不存在的帳號登入：顯示與密碼錯誤相同的「帳號或密碼錯誤」', async ({ page }) => {
    // Given：開啟登入頁
    await page.goto('/login', { waitUntil: 'networkidle' })

    // When：以系統中不存在的帳號嘗試登入
    await page.getByTestId('login-account').fill('no-such-user')
    await page.getByTestId('login-password').fill('whatever')
    await page.getByTestId('login-submit').click()

    // Then：錯誤訊息與密碼錯誤一致，不洩漏「帳號不存在」
    await expect(page.getByText('帳號或密碼錯誤').first()).toBeVisible()
    await expect(page.getByText('帳號不存在')).toHaveCount(0)
  })

  test('登入頁不提供公開註冊入口', async ({ page }) => {
    // Given：開啟登入頁
    await page.goto('/login', { waitUntil: 'networkidle' })

    // Then：不出現「前往註冊」連結（管理員帳號由既有管理員建立，非公開註冊）
    await expect(page.getByText('前往註冊')).toHaveCount(0)
  })
})
