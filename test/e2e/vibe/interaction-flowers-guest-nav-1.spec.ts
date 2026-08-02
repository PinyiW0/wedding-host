// Source: app/pages/flowers/[weddingId].vue + app/composables/useGuestNav.ts（花田頁導覽列，issue #135）
// Pattern: new-region（花田頁改掛共用導覽列）+ interaction（導覽至花田，簽名沿路帶著）

import type { Page } from '@playwright/test'
import { expect, test } from '@playwright/test'

import { resetMockData, TestUsers } from '../helpers'

const WEDDING_ID = 'wedding-001'
const GUEST_ID = 'guest-001'

// 與 interaction-guest-nav-1 同法：以 page.request 取真實 HMAC 簽名，
// page 本身維持未登入賓客狀態，簽名等級才是真的守門條件
async function fetchSig(page: Page, guestId?: string): Promise<string> {
  const loginRes = await page.request.post('/api/v1/auth/login', {
    data: { username: TestUsers.admin.account, password: TestUsers.admin.password },
  })
  const { accessToken } = await loginRes.json()
  const res = await page.request.get(
    `/api/v1/weddings/${WEDDING_ID}/signed-links${guestId ? `?guestId=${guestId}` : ''}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  )
  const { sig } = await res.json()
  return sig
}

test.describe('vibe：花田頁賓客導覽列', () => {
  test.beforeEach(async ({ page }) => {
    await resetMockData(page)
  })

  test('花田頁掛上共用導覽列，且花田項目標為當前頁', async ({ page }) => {
    const sig = await fetchSig(page)
    await page.goto(`/flowers/${WEDDING_ID}?sig=${sig}`, { waitUntil: 'networkidle' })

    const nav = page.getByTestId('vibe-guest-nav')
    await expect(nav).toBeVisible()
    await expect(nav.getByTestId('vibe-guest-nav-item-flowers')).toHaveAttribute('aria-current', 'page')

    // 花田是滿版 landing，導覽列進駐後主視覺仍在
    await expect(page.getByTestId('flower-field')).toBeVisible()
  })

  test('婚禮級簽名：導覽列給出花田入口，點擊後簽名沿路帶著', async ({ page }) => {
    const sig = await fetchSig(page)
    await page.goto(`/rundown/${WEDDING_ID}?sig=${sig}`, { waitUntil: 'networkidle' })

    await page.getByTestId('vibe-guest-nav').getByTestId('vibe-guest-nav-item-flowers').click()
    await page.waitForURL(`**/flowers/${WEDDING_ID}?sig=${sig}`)
    await page.waitForLoadState('networkidle')

    await expect(page.getByTestId('flower-field-page')).toBeVisible()
    await expect(page.getByText('資料載入失敗')).toHaveCount(0)
  })

  test('賓客級簽名：花田與個人頁入口並存', async ({ page }) => {
    const sig = await fetchSig(page, GUEST_ID)
    await page.goto(`/flowers/${WEDDING_ID}?sig=${sig}`, { waitUntil: 'networkidle' })

    const nav = page.getByTestId('vibe-guest-nav')
    for (const key of ['rundown', 'checkin', 'blessing', 'flowers', 'thankyou', 'bind'])
      await expect(nav.getByTestId(`vibe-guest-nav-item-${key}`)).toBeVisible()
  })

  test.describe('行動裝置', () => {
    test.use({ viewport: { width: 375, height: 812 } })

    test('花田頁漢堡選單同樣可導覽至其他公開頁', async ({ page }) => {
      const sig = await fetchSig(page, GUEST_ID)
      await page.goto(`/flowers/${WEDDING_ID}?sig=${sig}`, { waitUntil: 'networkidle' })

      await page.getByTestId('vibe-guest-nav-toggle').click()
      const overlay = page.getByTestId('vibe-guest-nav-overlay')
      await expect(overlay).toBeVisible()

      await overlay.getByTestId('vibe-guest-nav-mobile-item-rundown').click()
      await page.waitForURL(`**/rundown/${WEDDING_ID}?**`)
      await expect(overlay).toBeHidden()
    })
  })
})
