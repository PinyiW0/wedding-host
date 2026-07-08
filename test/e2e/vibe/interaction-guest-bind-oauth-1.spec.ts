// Source: server/api/.../guests/[guestId]/line-login.get.ts、server/api/line-login/callback.get.ts、
//         app/pages/guest/[guestId]/bind.vue（M4 issue #30：賓客 LINE Login OAuth 綁定）
// Pattern: api-contract + conditional-render——
// e2e 環境未設定 LINE Login 金鑰（playwright.config 強制清空），驗 mock 閘門與 callback 導回回饋

import { expect, test } from '@playwright/test'

test.describe('vibe：賓客 LINE OAuth 綁定', () => {
  test('OAuth 起手端點：未設定金鑰時回 configured false（bind 頁據此走 mock 綁定）', async ({ page }) => {
    const res = await page.request.get('/api/v1/weddings/wedding-001/guests/guest-001/line-login')
    expect(res.status()).toBe(200)
    expect(await res.json()).toMatchObject({ configured: false, authorizeUrl: null })
  })

  test('OAuth callback：偽造 state 被拒（403），不寫入綁定', async ({ page }) => {
    const res = await page.request.get('/api/line-login/callback?state=b.wedding-001.guest-001.9999999999999.forged&code=x')
    expect(res.status()).toBe(403)
  })

  test('callback 導回 bindResult=success：顯示綁定成功回饋', async ({ page }) => {
    await page.goto('/guest/guest-001/bind?weddingId=wedding-001&bindResult=success', { waitUntil: 'networkidle' })
    await expect(page.getByTestId('guest-bind-success')).toBeVisible()
    await expect(page.getByText(/綁定成功/)).toBeVisible()
  })

  test('callback 導回 bindResult=cancelled：顯示取消授權提示、仍可重試', async ({ page }) => {
    await page.goto('/guest/guest-001/bind?weddingId=wedding-001&bindResult=cancelled', { waitUntil: 'networkidle' })
    await expect(page.getByTestId('guest-bind-error')).toBeVisible()
    await expect(page.getByText(/已取消 LINE 授權/)).toBeVisible()
    // 取消後綁定按鈕仍在（可重試的可達路徑）
    await expect(page.getByRole('button', { name: /綁定|LINE/ })).toBeVisible()
  })

  test('callback 導回 bindResult=already：顯示已綁定語意', async ({ page }) => {
    await page.goto('/guest/guest-001/bind?weddingId=wedding-001&bindResult=already', { waitUntil: 'networkidle' })
    await expect(page.getByTestId('guest-bind-error')).toBeVisible()
    await expect(page.getByText(/已綁定 LINE/)).toBeVisible()
  })
})
