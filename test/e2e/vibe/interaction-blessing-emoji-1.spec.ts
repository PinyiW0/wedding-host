// 批次 3 #5c：賓客送祝福 emoji 面板（點選插入留言游標處）
// Source: app/pages/blessing/[weddingId].vue（emoji 面板）
// Pattern: interaction

import { expect, test } from '@playwright/test'

import { resetMockData } from '../helpers'

const BLESSING_URL = '/blessing/wedding-001?guestId=guest-001'

test.describe('vibe：賓客祝福 emoji 插入', () => {
  test.beforeEach(async ({ page }) => {
    await resetMockData(page)
  })

  test('點選 emoji 插入留言游標處', async ({ page }) => {
    await page.goto(BLESSING_URL, { waitUntil: 'networkidle' })

    const field = page.getByTestId('blessing-message')
    await field.fill('祝福新人')

    // emoji 面板可見 → 點選 🎉
    await expect(page.getByTestId('blessing-emoji-panel')).toBeVisible()
    await page.getByTestId('blessing-emoji-🎉').click()

    // 留言含插入的 emoji
    await expect(field).toHaveValue(/🎉/)
  })
})
