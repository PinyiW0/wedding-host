import { expect, test } from '@playwright/test'

import {
  login,
  resetMockData,
  selectOption,
  TestUsers,
  waitForApiCall,
} from '../helpers'

// 對應 spec/e2e-flows/18-invitations.flow.md（RSVP 喜帖管理：需求統計 + 篩選 + 已寄送記號）
// Feature Background：已登入為管理員（Admin）；wedding-001 已選定
// mock seed：guest-003（王志強）invitationPreference = e-card；全部 seed invitationSent = false

const RSVP_PATH = '/weddings/wedding-001/rsvp'
const GUESTS_API = '/api/v1/weddings/wedding-001/guests'

test.describe('RSVP 喜帖管理（Admin 端）', () => {
  test.beforeEach(async ({ page }) => {
    await resetMockData(page)
    await login(page, TestUsers.admin.account, TestUsers.admin.password)
  })

  test.describe('規則：喜帖需求統計與賓客資料一致', () => {
    test('電子/紙本/已寄送筆數與賓客資料一致', async ({ page }) => {
      // Given：以 API 回應推算預期值（不寫死 seed 數字，凍結「一致」而非數值）
      const res = await page.request.get(GUESTS_API)
      const guests = await res.json()
      const active = guests.filter(
        (g: { deletedAt: string | null }) => !g.deletedAt,
      )
      const ecard = active.filter(
        (g: { invitationPreference: string | null }) => g.invitationPreference === 'e-card',
      ).length
      const physical = active.filter(
        (g: { invitationPreference: string | null }) => g.invitationPreference === 'physical',
      ).length
      const sent = active.filter(
        (g: { invitationSent?: boolean }) => g.invitationSent,
      ).length

      // Then：頁面三個統計數字與推算一致（以賓客筆數計）
      await page.goto(RSVP_PATH, { waitUntil: 'networkidle' })
      await expect(page.getByTestId('rsvp-stat-ecard')).toContainText(String(ecard))
      await expect(page.getByTestId('rsvp-stat-physical')).toContainText(String(physical))
      await expect(page.getByTestId('rsvp-stat-sent')).toContainText(String(sent))
    })
  })

  test.describe('規則：可依喜帖需求篩選回覆清單', () => {
    test('篩選電子喜帖後僅 e-card 賓客可見', async ({ page }) => {
      // Given：從 API 找一位非 e-card 的賓客作反向斷言（不寫死 seed）
      const res = await page.request.get(GUESTS_API)
      const guests = await res.json()
      const nonEcard = guests.find(
        (g: { deletedAt: string | null, invitationPreference: string | null }) =>
          !g.deletedAt && g.invitationPreference !== 'e-card',
      )
      expect(nonEcard).toBeTruthy()

      await page.goto(RSVP_PATH, { waitUntil: 'networkidle' })

      // When：依「電子喜帖」篩選
      await selectOption(page, 'rsvp-invitation-filter', '電子喜帖')

      // Then：e-card 賓客（seed guest-003）的列可見、非 e-card 賓客的列不可見
      await expect(page.getByTestId('rsvp-row-guest-003')).toBeVisible()
      await expect(page.getByTestId(`rsvp-row-${nonEcard.guestId}`)).not.toBeVisible()
    })
  })

  test.describe('規則：成功標記喜帖已寄送', () => {
    test('勾選已寄送後重整仍保留', async ({ page }) => {
      // Given：seed guest-003（王志強）尚未標記已寄送
      await page.goto(RSVP_PATH, { waitUntil: 'networkidle' })
      const checkbox = page.getByRole('checkbox', { name: '標記 王志強 喜帖已寄送' })
      await expect(checkbox).not.toBeChecked()

      // When：勾選已寄送 → API spy 驗證 PUT payload { sent: true }
      const apiCall = waitForApiCall(page, /\/guests\/guest-003\/invitation-sent(\?|$)/, 'PUT')
      await checkbox.click()
      const request = await apiCall
      expect(request.postDataJSON()).toMatchObject({ sent: true })

      // Then：勾選狀態生效，且重整後仍保留（記號已落庫、由讀模型帶回）
      await expect(checkbox).toBeChecked()
      await page.reload({ waitUntil: 'networkidle' })
      await expect(
        page.getByRole('checkbox', { name: '標記 王志強 喜帖已寄送' }),
      ).toBeChecked()
    })
  })

  test.describe('規則：賓客不存在', () => {
    test('賓客不存在', async ({ page }) => {
      // 性質：API 邊界保護
      const res = await page.request.put(
        `${GUESTS_API}/guest-999/invitation-sent`,
        { data: { sent: true } },
      )
      expect(res.status()).toBe(404)
      expect(JSON.stringify(await res.json())).toContain('賓客不存在')
    })
  })
})
