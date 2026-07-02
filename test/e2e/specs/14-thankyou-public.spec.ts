import { expect, test } from '@playwright/test'

import { resetMockData } from '../helpers'

// 對應 spec/e2e-flows/14-thankyou-public.flow.md（賓客公開謝卡 + 內容帶入賓客名）
// mock seed：wedding-001、guest-001（陳大明）

test.describe('賓客公開謝卡（Guest 端，公開）', () => {
  test.beforeEach(async ({ page }) => {
    await resetMockData(page)
  })

  test.describe('規則：成功讀取謝卡', () => {
    test('謝卡帶入賓客名與已替換內容（API 邊界）', async ({ page }) => {
      // 設定含 {{guestName}} 的範本
      const put = await page.request.put('/api/v1/weddings/wedding-001/thank-you-card/template', {
        data: { templateContent: '親愛的{{guestName}}，謝謝您的祝福' },
      })
      expect(put.ok()).toBeTruthy()

      const res = await page.request.get('/api/v1/weddings/wedding-001/thank-you-card/public/guest-001')
      expect(res.ok()).toBeTruthy()
      const card = await res.json()
      expect(card.guestName).toBe('陳大明')
      expect(card.content).toContain('陳大明')
    })

    test('賓客開啟信封後顯示謝卡與自己的姓名', async ({ page }) => {
      await page.goto('/thankyou/wedding-001/guest-001', { waitUntil: 'networkidle' })

      // 信封可見 → 開封
      const envelope = page.getByTestId('thankyou-envelope')
      await expect(envelope).toBeVisible()
      await envelope.click()

      // 謝卡顯示、帶入賓客名
      await expect(page.getByTestId('thankyou-card')).toBeVisible()
      await expect(page.getByText('陳大明')).toBeVisible()
    })
  })

  test.describe('規則：讀取不存在賓客的謝卡', () => {
    test('賓客不存在', async ({ page }) => {
      const res = await page.request.get('/api/v1/weddings/wedding-001/thank-you-card/public/guest-999')
      expect(res.status()).toBe(404)
      expect(JSON.stringify(await res.json())).toContain('賓客不存在')
    })
  })
})
