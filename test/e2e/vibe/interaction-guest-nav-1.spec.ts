// Source: app/components/GuestNav.vue + app/composables/useGuestNav.ts（賓客公開頁導覽列，issue #132）
// Pattern: interaction（選單開合）+ new-region（依簽名等級決定可見項目）

import type { Page } from '@playwright/test'
import { expect, test } from '@playwright/test'

import { resetMockData, TestUsers } from '../helpers'

const WEDDING_ID = 'wedding-001'
const GUEST_ID = 'guest-001'

// 取真實 HMAC 簽名：以 page.request 登入取 token，不寫入 page 的 auth store，
// 公開頁因此維持「未登入賓客」狀態，簽名等級才是真的守門條件
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

test.describe('vibe：賓客公開頁導覽列', () => {
  test.beforeEach(async ({ page }) => {
    await resetMockData(page)
  })

  test('婚禮級簽名：只給婚禮層級入口，個人頁入口不出現', async ({ page }) => {
    const sig = await fetchSig(page)
    await page.goto(`/rundown/${WEDDING_ID}?sig=${sig}`, { waitUntil: 'networkidle' })

    const nav = page.getByTestId('vibe-guest-nav')
    await expect(nav.getByTestId('vibe-guest-nav-item-rundown')).toBeVisible()
    await expect(nav.getByTestId('vibe-guest-nav-item-blessing')).toBeVisible()

    // 婚禮級簽名點進賓客專屬頁必定 401，因此三個個人入口不得出現
    await expect(nav.getByTestId('vibe-guest-nav-item-checkin')).toHaveCount(0)
    await expect(nav.getByTestId('vibe-guest-nav-item-thankyou')).toHaveCount(0)
    await expect(nav.getByTestId('vibe-guest-nav-item-bind')).toHaveCount(0)

    // 出席回覆改指向公開表單
    await expect(nav.getByTestId('vibe-guest-nav-cta')).toHaveAttribute('href', new RegExp(`/rsvp/public/${WEDDING_ID}`))
  })

  test('賓客級簽名：個人頁入口齊全，出席回覆指向個人表單', async ({ page }) => {
    const sig = await fetchSig(page, GUEST_ID)
    await page.goto(`/rundown/${WEDDING_ID}?sig=${sig}`, { waitUntil: 'networkidle' })

    const nav = page.getByTestId('vibe-guest-nav')
    for (const key of ['rundown', 'checkin', 'blessing', 'thankyou', 'bind'])
      await expect(nav.getByTestId(`vibe-guest-nav-item-${key}`)).toBeVisible()

    await expect(nav.getByTestId('vibe-guest-nav-cta')).toHaveAttribute('href', new RegExp(`/rsvp/${GUEST_ID}`))
  })

  test('跨頁導覽：簽名沿路帶著，目的頁不因缺簽名而讀取失敗', async ({ page }) => {
    const sig = await fetchSig(page, GUEST_ID)
    await page.goto(`/rundown/${WEDDING_ID}?sig=${sig}`, { waitUntil: 'networkidle' })

    await page.getByTestId('vibe-guest-nav').getByTestId('vibe-guest-nav-item-thankyou').click()
    await page.waitForURL(`**/thankyou/${WEDDING_ID}/${GUEST_ID}?sig=${sig}`)
    await page.waitForLoadState('networkidle')

    // 簽名掉了會被 server 擋成 401，useHttp 統一冒出讀取失敗提示
    await expect(page.getByText('資料載入失敗')).toHaveCount(0)
    // 導覽列本身跟著到下一頁，且仍在賓客級
    await expect(page.getByTestId('vibe-guest-nav').getByTestId('vibe-guest-nav-item-bind')).toBeVisible()
  })

  test.describe('行動裝置', () => {
    test.use({ viewport: { width: 375, height: 812 } })

    test('漢堡選單：展開後鎖住背景捲動，導覽後自動收合', async ({ page }) => {
      const sig = await fetchSig(page, GUEST_ID)
      await page.goto(`/rundown/${WEDDING_ID}?sig=${sig}`, { waitUntil: 'networkidle' })

      const overlay = page.getByTestId('vibe-guest-nav-overlay')
      await expect(overlay).toBeHidden()

      await page.getByTestId('vibe-guest-nav-toggle').click()
      await expect(overlay).toBeVisible()
      await expect(page.locator('body')).toHaveClass(/overflow-hidden/)

      await overlay.getByTestId('vibe-guest-nav-mobile-item-blessing').click()
      await page.waitForURL(`**/blessing/${WEDDING_ID}?**`)
      await expect(overlay).toBeHidden()
      await expect(page.locator('body')).not.toHaveClass(/overflow-hidden/)
    })

    test('漢堡選單：再按一次關閉，背景捲動解鎖', async ({ page }) => {
      const sig = await fetchSig(page)
      await page.goto(`/rundown/${WEDDING_ID}?sig=${sig}`, { waitUntil: 'networkidle' })

      const toggle = page.getByTestId('vibe-guest-nav-toggle')
      await toggle.click()
      await expect(page.getByTestId('vibe-guest-nav-overlay')).toBeVisible()

      await toggle.click()
      await expect(page.getByTestId('vibe-guest-nav-overlay')).toBeHidden()
      await expect(page.locator('body')).not.toHaveClass(/overflow-hidden/)
    })
  })
})
