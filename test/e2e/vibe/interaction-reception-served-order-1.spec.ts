// Source: app/pages/reception/index.vue（報到清單排序：三項皆完成者沉底，issue #101 後續回饋）
// Pattern: sort（三項＝報到／禮金／喜餅都完成 → 穩定沉到清單最下方；只報到者留在上方不干擾）

import { expect, test } from '@playwright/test'

import { login, resetMockData, TestUsers } from '../helpers'

const WID = 'wedding-001'
const RECEPTION_PATH = '/reception?weddingId=wedding-001'

async function rowOrder(page: import('@playwright/test').Page): Promise<string[]> {
  return page.locator('[data-testid^="reception-row-"]').evaluateAll(
    els => els.map(e => e.getAttribute('data-testid') ?? ''),
  )
}

test.describe('vibe：報到清單排序（三項完成沉底）', () => {
  test.beforeEach(async ({ page }) => {
    await resetMockData(page)
    await login(page, TestUsers.admin.account, TestUsers.admin.password)
  })

  test('三項（報到／禮金／喜餅）皆完成者沉到最下方；只報到者不沉底', async ({ page }) => {
    // guest-003：三項全部完成
    expect((await page.request.post(`/api/v1/weddings/${WID}/guests/guest-003/check-in`)).ok()).toBeTruthy()
    expect((await page.request.post(`/api/v1/weddings/${WID}/guests/guest-003/gift-money`, { data: { amount: 3600 } })).ok()).toBeTruthy()
    expect((await page.request.post(`/api/v1/weddings/${WID}/guests/guest-003/cake-box-distribution`, { data: { cakeBoxTypeId: 'cakeboxtype-002' } })).ok()).toBeTruthy()
    // guest-002：只報到（未登禮金、未發喜餅）
    expect((await page.request.post(`/api/v1/weddings/${WID}/guests/guest-002/check-in`)).ok()).toBeTruthy()

    await page.goto(RECEPTION_PATH, { waitUntil: 'networkidle' })

    const ids = await rowOrder(page)
    expect(ids.length).toBeGreaterThan(2)
    // 三項完成者沉到最後
    expect(ids.at(-1)).toBe('reception-row-guest-003')
    // 只報到者仍在完成者之上（不因報到就沉底）
    expect(ids.indexOf('reception-row-guest-002')).toBeLessThan(ids.indexOf('reception-row-guest-003'))
  })
})
