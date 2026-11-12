// Source: app/pages/reception/index.vue + server .../cake-box-exclusions/index.post.ts、cake-box-distribution.post.ts（issue #138）
// Pattern: interaction（不發放賓客收起所有發放操作）+ API 守門（409）+ 條件顯示（後台有設定款式就只有打勾，沒有選款按鈕）
// 需求：後台標記不發放後，接待端直接顯示「不發放」；打勾發放已是主要路徑，
//      issue #217 起，沒有個別指派的賓客退回預設款，同樣打勾發放；
//      後台已設定款式（個別指定或預設款）就照設定發，報到頁不提供現場改款，選款按鈕只留給完全沒有款式可發的賓客

import { expect, test } from '@playwright/test'

import { login, resetMockData, TestUsers } from '../helpers'

const WID = 'wedding-001'
const RECEPTION_PATH = `/reception?weddingId=${WID}`
const EXCLUSION_PATH = `/api/v1/weddings/${WID}/cake-box-exclusions`

test.describe('vibe：接待端不發放與發放按鈕條件', () => {
  test('後台標記不發放 → 接待端顯示「不發放」且無打勾與按鈕', async ({ page }) => {
    await resetMockData(page)
    await login(page, TestUsers.admin.account, TestUsers.admin.password)

    // guest-003 在 seed 有指派（豪華禮盒），標記不發放後指派應一併失效
    expect((await page.request.post(EXCLUSION_PATH, { data: { guestId: 'guest-003' } })).ok()).toBeTruthy()

    await page.goto(RECEPTION_PATH, { waitUntil: 'networkidle' })

    await expect(page.getByTestId('vibe-reception-cake-nobox-guest-003')).toHaveText('不發放')
    await expect(page.getByTestId('reception-cake-tick-guest-003')).toHaveCount(0)
    await expect(page.getByTestId('reception-cake-guest-003')).toHaveCount(0)
  })

  test('不發放賓客直接打發放 API → 409', async ({ page }) => {
    await resetMockData(page)
    await login(page, TestUsers.admin.account, TestUsers.admin.password)

    expect((await page.request.post(EXCLUSION_PATH, { data: { guestId: 'guest-003' } })).ok()).toBeTruthy()

    const res = await page.request.post(`/api/v1/weddings/${WID}/guests/guest-003/cake-box-distribution`, {
      data: { cakeBoxTypeId: 'cakeboxtype-002' },
    })
    expect(res.status()).toBe(409)
    expect((await res.json()).message).toContain('不發放')
  })

  test('有指定款只出現打勾、無選款按鈕；無指定款者退回預設款，同樣只有打勾', async ({ page }) => {
    await resetMockData(page)
    await login(page, TestUsers.admin.account, TestUsers.admin.password)
    await page.goto(RECEPTION_PATH, { waitUntil: 'networkidle' })

    // guest-002 在 seed 有指派 → 打勾發放，不給改款按鈕
    await expect(page.getByTestId('reception-cake-tick-guest-002')).toBeVisible()
    await expect(page.getByTestId('reception-cake-guest-002')).toHaveCount(0)

    // guest-001 刻意無指派（＝現場臨時來賓的情境）→ 退回預設款可打勾，不提供現場改款（issue #217）
    await expect(page.getByTestId('reception-cake-tick-guest-001')).toBeVisible()
    await expect(page.getByTestId('reception-cake-guest-001')).toHaveCount(0)
  })

  test('接待員可在現場新增賓客（原 RBAC 白名單漏列導致 403）', async ({ page }) => {
    await resetMockData(page)
    const loginRes = await page.request.post('/api/v1/auth/login', {
      data: { username: TestUsers.receptionist.account, password: TestUsers.receptionist.password },
    })
    const { accessToken } = await loginRes.json()

    const res = await page.request.post(`/api/v1/weddings/${WID}/guests`, {
      // 合約收分類「名稱」（後端 find-or-create 成 id）；用朋友避開男方親屬自動不發放的判定
      data: { name: '現場臨時來賓', side: 'groom', diet: 'meat', category: '朋友', contact: '0900000138' },
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    expect(res.ok()).toBeTruthy()
  })
})
