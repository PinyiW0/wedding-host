// Source: server/utils/cakebox-default.ts + guests 寫入端點（index.post／index.patch／batch-category）
//         + app/pages/weddings/[weddingId]/cake-box.vue 依分類帶入（issue #105）
// Pattern: interaction（男方親屬預設不發放：建立／編輯／批次分類轉換 + 依分類帶入一鍵套用）
// 需求：台灣婚俗喜餅發女方親友——男方親屬（side=groom × 家屬層分類 tier=1）預設不發放，可手動覆寫

import type { Page } from '@playwright/test'

import { expect, test } from '@playwright/test'

import { login, resetMockData, TestUsers } from '../helpers'

const WID = 'wedding-001'
const GUESTS = `/api/v1/weddings/${WID}/guests`
const EXCLUSIONS = `/api/v1/weddings/${WID}/cake-box-exclusions`

async function excludedIds(page: Page): Promise<string[]> {
  const rows: { guestId: string }[] = await (await page.request.get(EXCLUSIONS)).json()
  return rows.map(r => r.guestId)
}

test.describe('vibe：男方親屬預設不發放喜餅', () => {
  test.beforeEach(async ({ page }) => {
    await resetMockData(page)
    await login(page, TestUsers.admin.account, TestUsers.admin.password)
  })

  test('建立賓客：男方親戚自動入不發放；女方親戚／男方朋友不受影響', async ({ page }) => {
    const create = async (data: Record<string, unknown>): Promise<string> =>
      (await (await page.request.post(GUESTS, { data })).json()).guestId

    // contact 為 NOT NULL 無預設欄位，直打 API 必帶（UI 表單一律有送）
    const groomRelative = await create({ name: '測試男方長輩', side: 'groom', diet: 'meat', category: '親戚', contact: '0900000001' })
    const brideRelative = await create({ name: '測試女方長輩', side: 'bride', diet: 'meat', category: '親戚', contact: '0900000002' })
    const groomFriend = await create({ name: '測試男方同窗', side: 'groom', diet: 'meat', category: '朋友', contact: '0900000003' })

    const ids = await excludedIds(page)
    expect(ids).toContain(groomRelative)
    expect(ids).not.toContain(brideRelative)
    expect(ids).not.toContain(groomFriend)
  })

  test('編輯轉換：改成男方親屬 → 自動不發放；改離男方親屬 → 解除', async ({ page }) => {
    const res = await page.request.post(GUESTS, { data: { name: '測試轉換賓客', side: 'bride', diet: 'meat', category: '親戚', contact: '0900000004' } })
    const { guestId } = await res.json()
    expect(await excludedIds(page)).not.toContain(guestId)

    // 女方親戚 → 男方親戚：進入預設 → 不發放
    expect((await page.request.patch(`${GUESTS}/${guestId}`, { data: { side: 'groom' } })).ok()).toBeTruthy()
    expect(await excludedIds(page)).toContain(guestId)

    // 男方親戚 → 男方朋友：離開預設 → 解除
    expect((await page.request.patch(`${GUESTS}/${guestId}`, { data: { category: '朋友' } })).ok()).toBeTruthy()
    expect(await excludedIds(page)).not.toContain(guestId)
  })

  test('批次改分類同樣套用轉換', async ({ page }) => {
    // guest-009 鄭家豪（男方朋友）→ 批次改「親戚」→ 不發放；改回「朋友」→ 解除
    expect((await page.request.post(`${GUESTS}/batch-category`, { data: { guestIds: ['guest-009'], category: '親戚' } })).ok()).toBeTruthy()
    expect(await excludedIds(page)).toContain('guest-009')

    expect((await page.request.post(`${GUESTS}/batch-category`, { data: { guestIds: ['guest-009'], category: '朋友' } })).ok()).toBeTruthy()
    expect(await excludedIds(page)).not.toContain('guest-009')
  })

  test('依分類帶入：預設勾選男方親屬不發放，套用後 seed 男方家人／雙親全數排除', async ({ page }) => {
    await page.goto(`/weddings/${WID}/cake-box`, { waitUntil: 'networkidle' })
    await page.getByTestId('cake-box-auto-assign').click()

    // 選項預設勾選（開 modal 即重置為勾選）
    await expect(page.getByTestId('vibe-exclude-groom-relatives')).toBeVisible()
    await page.getByTestId('cake-box-auto-apply').click()

    // toast 回報排除數：seed 男方家人 guest-003/007/011 + 男方雙親 guest-103/104 = 5
    await expect(page.getByText(/男方親屬 5 位設為不發放/).first()).toBeVisible()

    const ids = await excludedIds(page)
    for (const gid of ['guest-003', 'guest-007', 'guest-011', 'guest-103', 'guest-104'])
      expect(ids).toContain(gid)
    // 女方雙親與新人本人不受影響
    expect(ids).not.toContain('guest-105')
    expect(ids).not.toContain('guest-106')
    expect(ids).not.toContain('guest-101')
  })
})
