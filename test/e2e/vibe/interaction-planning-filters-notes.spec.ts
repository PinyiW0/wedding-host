import type { APIRequestContext, Page } from '@playwright/test'
import { expect, test } from '@playwright/test'
import { login, resetMockData, TestUsers } from '../helpers'

async function selectOption(page: Page, testId: string, label: string) {
  await page.getByTestId(testId).click()
  await page.getByRole('option', { name: label, exact: true }).click()
  await expect(page.getByRole('listbox')).toHaveCount(0)
}

const base = '/api/v1/weddings/wedding-001'
const cakePath = '/weddings/wedding-001/cake-box'
const longName = '法式手工喜餅經典雙層綜合禮盒二十字款式'
async function createReply(request: APIRequestContext, name: string, side: string, diet: string, attending?: string, invitation?: string) {
  const created = await request.post(`${base}/guests`, { data: { name, side, diet, category: '測試親友', contact: '' } })
  expect(created.ok()).toBe(true)
  const { guestId } = await created.json()
  if (attending) {
    const response = await request.post(`${base}/guests/${guestId}/rsvp`, { data: { attending, diet, plusOneCount: 0, childChairCount: 0, invitation } })
    expect(response.ok(), await response.text()).toBe(true)
  }
  return guestId
}
async function openCake(page: Page) {
  await page.goto(cakePath, { waitUntil: 'networkidle' })
  await expect(page.getByTestId('cake-box-list')).toBeVisible()
}

test.beforeEach(async ({ page }) => {
  await resetMockData(page)
  await login(page, TestUsers.admin.account, TestUsers.admin.password)
})

test('回覆總覽四種條件交集，未回覆／未填及無結果可辨識', async ({ page }, testInfo) => {
  await createReply(page.request, '符合全部', 'bride', 'vegetarian', 'attending', 'physical')
  await createReply(page.request, '不同男女方', 'groom', 'vegetarian', 'attending', 'physical')
  await createReply(page.request, '不同飲食', 'bride', 'meat', 'attending', 'physical')
  await createReply(page.request, '婉拒回覆', 'bride', 'vegetarian', 'declined', 'physical')
  await createReply(page.request, '電子喜帖對象', 'bride', 'vegetarian', 'attending', 'e-card')
  await createReply(page.request, '未回覆對象', 'bride', 'vegetarian')
  await page.goto('/weddings/wedding-001/rsvp', { waitUntil: 'networkidle' })
  await selectOption(page, 'rsvp-side-filter', '女方')
  await selectOption(page, 'rsvp-attending-filter', '出席')
  await selectOption(page, 'rsvp-diet-filter', '素食')
  await selectOption(page, 'rsvp-invitation-filter', '紙本喜帖')
  const rows = page.getByTestId('rsvp-list').locator('tbody tr')
  await expect(rows).toHaveCount(1)
  await expect(rows).toContainText('符合全部')
  await page.screenshot({ path: testInfo.outputPath('wedding-rsvp-filters.png') })
  await selectOption(page, 'rsvp-attending-filter', '未回覆')
  await expect(rows).toContainText('目前沒有賓客符合這組篩選條件')
  await selectOption(page, 'rsvp-invitation-filter', '未填')
  await expect(rows.filter({ hasText: '未回覆對象' })).toHaveCount(1)
})

test('喜餅分類、禮盒款式與發放狀態獨立組合', async ({ page }) => {
  expect((await page.request.post(`${base}/cake-box-types/cakeboxtype-002/assignment`, { data: { guestId: 'guest-001', assignmentRule: '' } })).ok()).toBe(true)
  expect((await page.request.post(`${base}/guests/guest-001/cake-box-distribution`, { data: { cakeBoxTypeId: 'cakeboxtype-002' } })).ok()).toBe(true)
  const type = (await (await page.request.get(`${base}/cake-box-types`)).json()).find((t: any) => t.cakeBoxTypeId === 'cakeboxtype-002')
  await openCake(page)
  await selectOption(page, 'vibe-category-filter', '同事')
  await selectOption(page, 'cake-style-filter', type.name)
  await selectOption(page, 'cake-distribution-filter', '已發放')
  await expect(page.getByTestId('cake-guest-row-guest-001')).toBeVisible()
  await expect(page.locator('[data-testid^="cake-guest-row-"]')).toHaveCount(1)
  await selectOption(page, 'cake-distribution-filter', '未發放')
  await expect(page.getByTestId('cake-guest-row-guest-001')).toHaveCount(0)
})

test('款式點擊預覽組合內容，長名稱在選單及表格完整呈現', async ({ page }, testInfo) => {
  const imageUrl = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'
  await page.request.patch(`${base}/cake-box-types/cakeboxtype-001`, { data: { name: longName, description: '手工餅乾、鳳梨酥與茶點', imageUrl } })
  await page.request.patch(`${base}/cake-box-types/cakeboxtype-002`, { data: { componentTypeIds: ['cakeboxtype-001', 'cakeboxtype-003'] } })
  await openCake(page)
  const card = page.getByTestId('cake-box-row-cakeboxtype-001')
  await expect(card.getByRole('button', { name: longName, exact: true })).toHaveAttribute('title', longName)
  await card.getByRole('button', { name: longName, exact: true }).click()
  await expect(page.getByTestId('cake-box-preview')).toContainText('手工餅乾、鳳梨酥與茶點')
  await page.keyboard.press('Escape')
  await page.getByTestId('cake-box-row-cakeboxtype-002').getByRole('button', { name: /^預覽/ }).click()
  const preview = page.getByTestId('cake-box-preview')
  await expect(preview).toContainText('組合內容')
  await expect(preview).toContainText(longName)
  await expect(preview.getByRole('img', { name: longName })).toBeVisible()
  await page.getByRole('dialog').screenshot({ path: testInfo.outputPath('wedding-cake-preview.png') })
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('vibe-row-style-guest-001')).toHaveAttribute('title', longName)
  await page.getByRole('button', { name: '設定指派', exact: true }).click()
  await selectOption(page, 'assignment-type-select', longName)
  await expect(page.getByTestId('assignment-type-select')).toHaveAttribute('title', longName)
  await expect(page.getByTestId('assignment-type-select')).toContainText(longName)
})

test('喜餅備註儲存、重新整理、改款及不發放後保留，跨婚禮不可寫入', async ({ page }, testInfo) => {
  await openCake(page)
  const row = page.getByTestId('cake-guest-row-guest-001')
  await page.screenshot({ path: testInfo.outputPath('wedding-cake-layout.png') })
  await row.getByTestId('cake-note-edit').click()
  await row.getByTestId('cake-note-input').fill('請由媽媽代領\n提前一天取貨')
  await row.getByTestId('cake-note-save').click()
  await expect(row).toContainText('請由媽媽代領')
  await expect(row.getByTestId('cake-note-input')).toHaveCount(0)
  await page.reload({ waitUntil: 'networkidle' })
  await expect(row).toContainText('提前一天取貨')
  await page.request.post(`${base}/cake-box-types/cakeboxtype-002/assignment`, { data: { guestId: 'guest-001', assignmentRule: '' } })
  await page.request.post(`${base}/cake-box-exclusions`, { data: { guestId: 'guest-001' } })
  await page.reload({ waitUntil: 'networkidle' })
  await expect(row).toContainText('請由媽媽代領')
  await expect(row.getByTestId('vibe-row-style-guest-001')).toContainText('不發放')
  await selectOption(page, 'cake-distribution-filter', '不發放')
  await expect(row).toBeVisible()
  const invalid = await page.request.put('/api/v1/weddings/wedding-002/cake-box-notes/guest-001', { data: { note: '跨婚禮' } })
  expect(invalid.status()).toBe(404)
  expect((await page.request.put(`${base}/cake-box-notes/guest-001`, { data: { note: 123 } })).status()).toBe(400)
  await row.getByTestId('cake-note-edit').click()
  await row.getByTestId('cake-note-input').fill('')
  await row.getByTestId('cake-note-save').click()
  await expect(row.getByTestId('cake-note-edit')).toHaveText('新增備註')
  expect((await (await page.request.get(`${base}/cake-box-notes`)).json()).find((n: any) => n.guestId === 'guest-001').note).toBe('')
})

test('備註儲存失敗保留輸入，額外配發也可在表格編輯備註', async ({ page }) => {
  const res = await page.request.post(`${base}/cake-box-extra-orders`, { data: { cakeBoxTypeId: 'cakeboxtype-001', quantity: 1, recipientName: '公關收件人' } })
  const { extraOrderId } = await res.json()
  await openCake(page)
  const row = page.getByTestId('cake-guest-row-guest-001')
  await row.getByTestId('cake-note-edit').click()
  await row.getByTestId('cake-note-input').fill('不可遺失的備註')
  await page.route(`**/cake-box-notes/guest-001`, route => route.fulfill({ status: 500, contentType: 'application/json', body: '{}' }))
  await row.getByTestId('cake-note-save').click()
  await expect(row.getByRole('alert')).toContainText('輸入內容已保留')
  await expect(row.getByTestId('cake-note-input')).toHaveValue('不可遺失的備註')
  await page.unroute('**/cake-box-notes/guest-001')
  await row.getByTestId('cake-note-save').click()
  await expect(row.getByTestId('cake-note-input')).toHaveCount(0)
  await selectOption(page, 'vibe-category-filter', '額外配發')
  const extra = page.getByTestId(`vibe-extra-row-${extraOrderId}`)
  await extra.getByTestId('cake-note-edit').click()
  await extra.getByTestId('cake-note-input').fill('寄到公司')
  await extra.getByTestId('cake-note-save').click()
  await expect(extra.getByTestId('cake-note-input')).toHaveCount(0)
  await page.reload({ waitUntil: 'networkidle' })
  await selectOption(page, 'vibe-category-filter', '額外配發')
  await expect(extra).toContainText('寄到公司')
})
