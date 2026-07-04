import { expect, test } from '@playwright/test'

import { resetMockData } from '../helpers'

// 對應 spec/e2e-flows/13-flowers.flow.md（祝福花田公開呈現）
// mock seed：wedding-001、guest-003（王志強 / 已畫手繪小花）

test.describe('祝福花田（Guest 端，公開）', () => {
  test.beforeEach(async ({ page }) => {
    await resetMockData(page)
  })

  test.describe('規則：成功呈現花田', () => {
    test('花田回所有非空手繪小花（API 邊界）', async ({ page }) => {
      const res = await page.request.get('/api/v1/weddings/wedding-001/flowers')
      expect(res.ok()).toBeTruthy()
      const flowers = await res.json()
      const target = flowers.find((f: { guestId: string }) => f.guestId === 'guest-003')
      expect(target).toBeTruthy()
      expect(target.name).toBe('王志強')
      expect(typeof target.flowerDrawing).toBe('string')
      expect(target.flowerDrawing.length).toBeGreaterThan(0)
    })

    test('花田 landing 顯示賓客的手繪小花', async ({ page }) => {
      await page.goto('/flowers/wedding-001', { waitUntil: 'networkidle' })
      // 花田元件渲染、賓客名可見
      await expect(page.getByTestId('flower-field')).toBeVisible()
      await expect(page.getByText('王志強')).toBeVisible()
      await expect(page.getByAltText(/王志強.*手繪小花/)).toBeVisible()
    })
  })
})
