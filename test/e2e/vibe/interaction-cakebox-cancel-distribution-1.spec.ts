// Source: app/pages/weddings/[weddingId]/cake-box.vue + server .../cake-box-distribution.delete.ts（取消喜餅發放，issue #101 後續回饋）
// Pattern: interaction（後台由新人／管理者取消發放，二次確認）+ RBAC（接待員無取消權 → 403）
// 需求：接待台維持單向「確認發放」；取消改在後台，天然只有新人／管理者能改（DELETE 不在接待員白名單）

import { expect, test } from '@playwright/test'

import { login, resetMockData, TestUsers } from '../helpers'

const WID = 'wedding-001'
const DIST_PATH = `/api/v1/weddings/${WID}/guests/guest-003/cake-box-distribution`

test.describe('vibe：後台取消喜餅發放', () => {
  test('已發放 → 後台取消 → 回未發放（reception-status 該款回 null）', async ({ page }) => {
    await resetMockData(page)
    await login(page, TestUsers.admin.account, TestUsers.admin.password)
    // 先發放喜餅給 guest-003
    expect((await page.request.post(DIST_PATH, { data: { cakeBoxTypeId: 'cakeboxtype-002' } })).ok()).toBeTruthy()

    await page.goto(`/weddings/${WID}/cake-box`, { waitUntil: 'networkidle' })

    // 後台顯示「已發放」+ 取消鈕
    const cancelBtn = page.getByTestId('vibe-cancel-distribution-guest-003')
    await expect(cancelBtn).toBeVisible()

    // 取消 → 二次確認
    await cancelBtn.click()
    await page.getByTestId('confirm-ok').click()

    // 回未發放：取消鈕消失
    await expect(page.getByTestId('vibe-cancel-distribution-guest-003')).toHaveCount(0)

    // 後端狀態：reception-status 該賓客 cakeBoxTypeId 回 null
    const items = await (await page.request.get(`/api/v1/weddings/${WID}/reception-status`)).json()
    expect(items.find((s: { guestId: string }) => s.guestId === 'guest-003')?.cakeBoxTypeId).toBeNull()
  })

  test('RBAC：接待員可發放但不可取消（DELETE → 403）', async ({ page }) => {
    await resetMockData(page)
    const loginRes = await page.request.post('/api/v1/auth/login', {
      data: { username: TestUsers.receptionist.account, password: TestUsers.receptionist.password },
    })
    const { accessToken } = await loginRes.json()
    const headers = { Authorization: `Bearer ${accessToken}` }

    // 接待員可發放
    expect((await page.request.post(DIST_PATH, { data: { cakeBoxTypeId: 'cakeboxtype-002' }, headers })).ok()).toBeTruthy()
    // 接待員取消 → 403
    const cancel = await page.request.delete(DIST_PATH, { headers })
    expect(cancel.status()).toBe(403)
  })
})
