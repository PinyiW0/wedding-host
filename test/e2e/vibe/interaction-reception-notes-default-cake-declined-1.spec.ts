// Source: app/pages/reception/index.vue + server .../guests/[guestId]/notes.put.ts、server/utils/route-auth.ts（issue #217）
// Pattern: 條件顯示（預設款退回、不出席分流）+ modal 編輯持久化（備註）+ API 守門（接待帳號只能改備註）
// 需求：1) 沒有個別指派的賓客顯示預設款並可打勾發放
//      2) 不出席的賓客移出主名單與報到率，改列「不出席」區，仍可登記禮金
//      3) 報到卡片顯示賓客備註，接待帳號可新增、修改、清空

import { expect, test } from '@playwright/test'

import { login, resetMockData, selectOption, TestUsers } from '../helpers'

const WID = 'wedding-001'
const RECEPTION_PATH = `/reception?weddingId=${WID}`
const GUEST_API = `/api/v1/weddings/${WID}/guests`

test.describe('vibe：報到頁預設款、不出席分流、備註', () => {
  test('沒有個別指派 → 顯示預設款並可打勾發放；個別指派仍標「指定」', async ({ page }) => {
    await resetMockData(page)
    await login(page, TestUsers.admin.account, TestUsers.admin.password)
    await page.goto(RECEPTION_PATH, { waitUntil: 'networkidle' })

    // guest-001 在 seed 沒有指派 → 退回預設款（經典禮盒）；guest-002 有指派 → 指定
    const tick = page.getByTestId('reception-cake-tick-guest-001')
    await expect(tick).toBeVisible()
    await expect(page.getByTestId('reception-row-guest-001')).toContainText('經典禮盒（預設）')
    await expect(page.getByTestId('reception-row-guest-002')).toContainText('（指定）')
    await expect(page.getByTestId('reception-row-guest-001')).not.toContainText('未指定款式')

    const distributed = page.waitForRequest(r =>
      r.method() === 'POST' && /\/guests\/guest-001\/cake-box-distribution(?:\?|$)/.test(r.url()))
    await tick.click()
    expect((await distributed).postDataJSON()).toMatchObject({ cakeBoxTypeId: 'cakeboxtype-001' })
    await expect(page.getByTestId('reception-row-guest-001')).toContainText('已發放（經典禮盒）')
  })

  test('不出席 → 移出主名單與報到率分母，改列「不出席」區且沒有報到按鈕', async ({ page }) => {
    await resetMockData(page)
    await login(page, TestUsers.admin.account, TestUsers.admin.password)

    const all: { deletedAt: string | null }[] = await (await page.request.get(GUEST_API)).json()
    const total = all.filter(g => !g.deletedAt).length
    expect((await page.request.post(`${GUEST_API}/guest-004/rsvp-override`, {
      data: { attending: 'declined', reason: '朋友代轉禮金' },
    })).ok()).toBeTruthy()

    await page.goto(RECEPTION_PATH, { waitUntil: 'networkidle' })

    // 分母少一位；主名單看不到 guest-004
    await expect(page.getByTestId('reception-page')).toContainText(`/ ${total - 1}`)
    await expect(page.getByTestId('reception-row-guest-004')).toHaveCount(0)

    // 展開「不出席」區：看得到人、可登記禮金、沒有報到按鈕
    const toggle = page.getByTestId('vibe-reception-declined-toggle')
    await expect(toggle).toContainText('不出席 1 位')
    await toggle.click()
    const row = page.getByTestId('reception-row-guest-004')
    await expect(row).toBeVisible()
    await expect(row).toContainText('不出席')
    await expect(page.getByTestId('reception-gift-guest-004')).toBeVisible()
    await expect(page.getByTestId('reception-checkin-guest-004')).toHaveCount(0)

    // 收合後用姓名搜尋也找得到
    await toggle.click()
    await expect(row).toHaveCount(0)
    await page.getByTestId('vibe-reception-search').fill('李淑芬')
    await expect(row).toBeVisible()
  })

  test('不出席賓客可現場發放喜餅：以已發放顯示，不發放標記保留', async ({ page }) => {
    await resetMockData(page)
    await login(page, TestUsers.admin.account, TestUsers.admin.password)

    // 轉為不出席會被自動加進不發放名單（既有規則）
    expect((await page.request.post(`${GUEST_API}/guest-004/rsvp-override`, {
      data: { attending: 'declined', reason: '朋友代轉禮金' },
    })).ok()).toBeTruthy()
    const exclusionApi = `/api/v1/weddings/${WID}/cake-box-exclusions`
    const before: { guestId: string }[] = await (await page.request.get(exclusionApi)).json()
    expect(before.some(e => e.guestId === 'guest-004')).toBeTruthy()

    await page.goto(RECEPTION_PATH, { waitUntil: 'networkidle' })
    await page.getByTestId('vibe-reception-declined-toggle').click()

    // 不出席區：「不發放」旁有發放入口
    await expect(page.getByTestId('vibe-reception-cake-nobox-guest-004')).toHaveText('不發放')
    await page.getByTestId('reception-cake-guest-004').click()
    await selectOption(page, 'distribute-cake-select', '經典禮盒')
    const distributed = page.waitForResponse(r =>
      r.request().method() === 'POST' && /\/guests\/guest-004\/cake-box-distribution(?:\?|$)/.test(r.url()))
    await page.getByTestId('reception-cake-submit').click()
    expect((await distributed).ok()).toBeTruthy()

    await expect(page.getByTestId('reception-row-guest-004')).toContainText('已發放（經典禮盒）')
    await expect(page.getByTestId('vibe-reception-cake-nobox-guest-004')).toHaveCount(0)
    // 標記不解除：伺服器分不出是自動加上還是新人刻意設的，訂購數量也維持不含這盒
    const after: { guestId: string }[] = await (await page.request.get(exclusionApi)).json()
    expect(after.some(e => e.guestId === 'guest-004')).toBeTruthy()
  })

  test('備註：卡片顯示既有備註，接待帳號可修改與清空，重新整理後仍在', async ({ page }) => {
    await resetMockData(page)
    await login(page, TestUsers.receptionist.account, TestUsers.receptionist.password)
    await page.goto(RECEPTION_PATH, { waitUntil: 'networkidle' })

    // guest-001 在 seed 有備註；guest-002 沒有 → 只有新增入口
    const notes = page.getByTestId('vibe-reception-notes-guest-001')
    await expect(notes).toHaveText('需要靠近舞台')
    await expect(page.getByTestId('vibe-reception-notes-guest-002')).toHaveCount(0)
    await expect(page.getByTestId('vibe-reception-notes-edit-guest-002')).toHaveText('新增備註')

    // 修改
    await page.getByTestId('vibe-reception-notes-edit-guest-001').click()
    const modal = page.getByTestId('vibe-reception-notes-modal')
    await modal.getByRole('textbox').fill('代收同事禮金')
    const saved = page.waitForResponse(r =>
      r.request().method() === 'PUT' && /\/guests\/guest-001\/notes(?:\?|$)/.test(r.url()))
    await page.getByTestId('vibe-reception-notes-submit').click()
    expect((await saved).ok()).toBeTruthy()
    await expect(notes).toHaveText('代收同事禮金')

    await page.reload({ waitUntil: 'networkidle' })
    await expect(notes).toHaveText('代收同事禮金')

    // 清空
    await page.getByTestId('vibe-reception-notes-edit-guest-001').click()
    await modal.getByRole('textbox').fill('')
    const cleared = page.waitForResponse(r =>
      r.request().method() === 'PUT' && /\/guests\/guest-001\/notes(?:\?|$)/.test(r.url()))
    await page.getByTestId('vibe-reception-notes-submit').click()
    expect((await cleared).ok()).toBeTruthy()
    await expect(notes).toHaveCount(0)
    await expect(page.getByTestId('vibe-reception-notes-edit-guest-001')).toHaveText('新增備註')
  })

  test('接待帳號只能改備註：整筆修改賓客 403、超過長度 400', async ({ page }) => {
    await resetMockData(page)
    const loginRes = await page.request.post('/api/v1/auth/login', {
      data: { username: TestUsers.receptionist.account, password: TestUsers.receptionist.password },
    })
    const { accessToken } = await loginRes.json()
    const headers = { Authorization: `Bearer ${accessToken}` }

    const ok = await page.request.put(`${GUEST_API}/guest-001/notes`, { data: { notes: '現場補寫' }, headers })
    expect(ok.ok()).toBeTruthy()
    expect(await ok.json()).toEqual({ guestId: 'guest-001', notes: '現場補寫' })

    const patch = await page.request.patch(`${GUEST_API}/guest-001`, { data: { name: '被改名' }, headers })
    expect(patch.status()).toBe(403)

    const tooLong = await page.request.put(`${GUEST_API}/guest-001/notes`, { data: { notes: 'a'.repeat(501) }, headers })
    expect(tooLong.status()).toBe(400)
  })
})
