// Source: server/api/v1/health.get.ts（公開健康檢查，issue #26）
// Pattern: api-contract——外部監測（UptimeRobot 等）依賴的回應形狀

import { expect, test } from '@playwright/test'

test.describe('vibe：健康檢查端點', () => {
  test('GET /api/v1/health：公開可達、回報 DB 正常', async ({ page }) => {
    // 不帶任何認證（公開分類，enforced 模式也不需登入）
    const res = await page.request.get('/api/v1/health')
    expect(res.status()).toBe(200)
    expect(await res.json()).toMatchObject({ status: 'ok', db: true })
  })
})
