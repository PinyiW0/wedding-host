// Source: app/components/GuestLinkCenter.vue（連結中心，issue #15）
// Pattern: new-region

import { expect, test } from '@playwright/test'

import { login, resetMockData, TestUsers } from '../helpers'

const GUESTS_URL = '/weddings/wedding-001/guests'

test.describe('vibe：賓客連結中心', () => {
  test.beforeEach(async ({ page }) => {
    await resetMockData(page)
    await login(page, TestUsers.admin.account, TestUsers.admin.password)
    await page.goto(GUESTS_URL, { waitUntil: 'networkidle' })
  })

  test('開啟連結面板：四類連結各附 QR code 與複製按鈕', async ({ page }) => {
    await page.getByTestId('guest-row-guest-001').getByTestId('vibe-guest-links').click()

    const panel = page.getByTestId('vibe-link-center-panel')
    await expect(panel).toBeVisible()

    for (const key of ['rsvp', 'blessing', 'checkin', 'thankyou']) {
      const entry = panel.getByTestId(`vibe-link-entry-${key}`)
      await expect(entry).toBeVisible()
      await expect(entry.locator('img')).toBeVisible()
      await expect(entry.getByTestId(`vibe-link-copy-${key}`)).toBeVisible()
    }
  })

  test('複製 RSVP 連結：剪貼簿內容為該賓客的簽名連結', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write'])
    await page.getByTestId('guest-row-guest-001').getByTestId('vibe-guest-links').click()

    const panel = page.getByTestId('vibe-link-center-panel')
    await panel.getByTestId('vibe-link-copy-rsvp').click()
    // exact 鎖定 toast title：sr-only 的 aria-live 通知也含同文字，非 exact 會 strict mode violation
    await expect(page.getByText('已複製RSVP 出席回覆連結', { exact: true })).toBeVisible()

    const copied = await page.evaluate(() => navigator.clipboard.readText())
    expect(copied).toContain('/rsvp/guest-001?weddingId=wedding-001&sig=g.guest-001.')
  })
})
