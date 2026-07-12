// Hydration 守門 smoke（issue #66）：對每個 route 做「整頁載入」，斷言 console 無 hydration 警告。
// - hydration 只發生在 hard load（page.goto）；client-side 導航不會重 hydrate，逐 route hard load 即覆蓋全部 hydration 面
// - regex 只 match /hydration/i（Vue 的 mismatch 警告全含此字；不 match mismatch 避免誤殺應用層 log）
// - ⚠️ Vue 只在 dev build 輸出 hydration 警告：本守門僅在 dev-server gate 有效，docker gate（production build）恆綠不代表無 mismatch
import type { Page } from '@playwright/test'
import { expect, test } from '@playwright/test'
import { login, resetMockData, TestUsers } from '../helpers'

// 公開頁（不需登入；wedding-001 為 seed 婚禮）
const PUBLIC_PAGES = [
  '/login',
  '/register',
  '/rsvp/public/wedding-001',
  '/checkin',
  '/blessing/wedding-001',
  '/flowers/wedding-001',
  '/projection/wedding-001',
  '/rundown/wedding-001',
]

// 登入後後台頁（管理者）
const ADMIN_PAGES = [
  '/',
  '/weddings',
  '/weddings/wedding-001',
  '/weddings/wedding-001/guests',
  '/weddings/wedding-001/seating',
  '/users',
]

// 接待員頁
const RECEPTIONIST_PAGES = ['/reception?weddingId=wedding-001']

function collectHydrationWarnings(page: Page): string[] {
  const hits: string[] = []
  page.on('console', (msg) => {
    if ((msg.type() === 'warning' || msg.type() === 'error') && /hydration/i.test(msg.text()))
      hits.push(msg.text())
  })
  return hits
}

test.describe('Hydration 守門', () => {
  // 保證 seed 資料（wedding-001 等）存在，與其他 spec 的順序無關
  test.beforeEach(async ({ page }) => {
    await resetMockData(page)
  })

  for (const path of PUBLIC_PAGES) {
    test(`未登入整頁載入 ${path} 無 hydration 警告`, async ({ page }) => {
      const hits = collectHydrationWarnings(page)
      await page.goto(path, { waitUntil: 'networkidle' })
      expect(hits).toEqual([])
    })
  }

  for (const path of ADMIN_PAGES) {
    test(`管理者整頁載入 ${path} 無 hydration 警告`, async ({ page }) => {
      await login(page, TestUsers.admin.account, TestUsers.admin.password)
      const hits = collectHydrationWarnings(page)
      await page.goto(path, { waitUntil: 'networkidle' })
      expect(hits).toEqual([])
    })
  }

  for (const path of RECEPTIONIST_PAGES) {
    test(`接待員整頁載入 ${path} 無 hydration 警告`, async ({ page }) => {
      await login(page, TestUsers.receptionist.account, TestUsers.receptionist.password)
      const hits = collectHydrationWarnings(page)
      await page.goto(path, { waitUntil: 'networkidle' })
      expect(hits).toEqual([])
    })
  }
})
