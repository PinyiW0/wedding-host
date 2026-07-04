import { expect, test } from '@playwright/test'

import { login, resetMockData, TestUsers, waitForApiCall } from '../helpers'

// 對應 spec/e2e-flows/15-projection.flow.md（推到投影幕 + 投影牆呈現）
// mock seed：wedding-001、blessing-001/002/003（皆 submitted）、guest-001（陳大明）

test.describe('投影即時牆（Admin 端）', () => {
  test.beforeEach(async ({ page }) => {
    await resetMockData(page)
    await login(page, TestUsers.admin.account, TestUsers.admin.password)
  })

  test.describe('規則：成功推到投影幕', () => {
    test('通過後推到投影幕', async ({ page }) => {
      await page.goto('/weddings/wedding-001/blessings', { waitUntil: 'networkidle' })

      // 通過 blessing-001
      await page.getByTestId('blessing-approve-blessing-001').click()
      await page.getByRole('button', { name: /確認通過|確定|通過/ }).click()

      // 推到投影幕
      const apiCall = waitForApiCall(page, /\/blessings\/blessing-001\/project(\?|$)/, 'POST')
      await page.getByTestId('blessing-project-blessing-001').click()
      await apiCall

      // 上牆狀態顯示「已上牆」
      await expect(
        page.getByTestId('blessing-row-blessing-001').getByText('已上牆'),
      ).toBeVisible()
    })
  })

  test.describe('規則：祝福尚未通過審核', () => {
    test('未審核不可推到投影幕（API 邊界）', async ({ page }) => {
      const res = await page.request.post(
        '/api/v1/weddings/wedding-001/blessings/blessing-002/project',
      )
      expect(res.status()).toBe(409)
      expect(JSON.stringify(await res.json())).toContain('祝福尚未通過審核')
    })
  })

  test.describe('規則：祝福不存在', () => {
    test('祝福不存在（API 邊界）', async ({ page }) => {
      const res = await page.request.post(
        '/api/v1/weddings/wedding-001/blessings/blessing-999/project',
      )
      expect(res.status()).toBe(404)
      expect(JSON.stringify(await res.json())).toContain('祝福不存在')
    })
  })
})

test.describe('投影即時牆（公開端）', () => {
  test.beforeEach(async ({ page }) => {
    await resetMockData(page)
  })

  test.describe('規則：投影牆只呈現已通過審核的祝福', () => {
    test('已通過祝福顯示於投影牆', async ({ page }) => {
      // 先通過 blessing-001
      const approve = await page.request.post(
        '/api/v1/weddings/wedding-001/blessings/blessing-001/approve',
      )
      expect(approve.ok()).toBeTruthy()

      await page.goto('/projection/wedding-001', { waitUntil: 'networkidle' })
      await expect(page.getByTestId('projection-message')).toBeVisible()
      await expect(page.getByTestId('projection-message')).toContainText('百年好合')
    })
  })
})
