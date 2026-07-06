// Source: app/pages/users.vue + server/api/v1/users/*（新人帳號管理，issue #23）
// Pattern: new-page + business guards（管理者限定、軟刪除、RBAC）

import { expect, test } from '@playwright/test'

import {
  confirmDelete,
  findEntity,
  login,
  resetMockData,
  TestUsers,
  waitForApiCall,
} from '../helpers'

// mock seed：user-001 Andrea（唯一管理者）、user-003 couple（新人，綁 wedding-001）
const COUPLE = { account: 'couple', password: 'couple1122' }

test.describe('vibe：新人帳號管理（管理員視角）', () => {
  test.beforeEach(async ({ page }) => {
    await resetMockData(page)
    await login(page, TestUsers.admin.account, TestUsers.admin.password)
  })

  test('建立新人帳號：POST /api/v1/users 且列表出現新實體', async ({ page }) => {
    await page.goto('/users', { waitUntil: 'networkidle' })

    await page.getByTestId('vibe-couple-create').click()
    await page.getByTestId('vibe-couple-username').fill('newlyweds')
    await page.getByTestId('vibe-couple-password').fill('newlyweds123')
    await page.getByTestId('vibe-couple-displayname').fill('小明小美')

    const apiCall = waitForApiCall(page, /\/api\/v1\/users(\?|$)/, 'POST')
    await page.getByTestId('vibe-couple-submit').click()
    const request = await apiCall
    expect(request.postDataJSON()).toMatchObject({
      username: 'newlyweds',
      displayName: '小明小美',
    })

    await expect(findEntity(page, /newlyweds/)).toBeVisible()

    // 新帳號可實際登入（密碼 scrypt 正確入庫）
    const res = await page.request.post('/api/v1/auth/login', {
      data: { username: 'newlyweds', password: 'newlyweds123' },
    })
    expect(res.status()).toBe(201)
    expect((await res.json()).role).toBe('新人')
  })

  test('重設密碼：PATCH 後新密碼可登入', async ({ page }) => {
    await page.goto('/users', { waitUntil: 'networkidle' })

    await findEntity(page, /couple/).getByRole('button', { name: /重設.*密碼/ }).click()
    await page.getByTestId('vibe-couple-new-password').fill('brandnew456')

    // 等 PATCH「回應完成」而非僅請求發出，避免後續登入驗證與寫入賽跑
    const patchDone = page.waitForResponse(res =>
      /\/api\/v1\/users\/user-003(?:\?|$)/.test(res.url()) && res.request().method() === 'PATCH' && res.ok())
    await page.getByTestId('vibe-couple-reset-submit').click()
    await patchDone
    await expect(page.getByTestId('vibe-couple-reset-modal')).toBeHidden()

    const res = await page.request.post('/api/v1/auth/login', {
      data: { username: COUPLE.account, password: 'brandnew456' },
    })
    expect(res.status()).toBe(201)
  })

  test('停用新人帳號：軟刪除後顯示已停用、login 拒絕', async ({ page }) => {
    await page.goto('/users', { waitUntil: 'networkidle' })

    const apiCall = waitForApiCall(page, /\/api\/v1\/users\/user-003(\?|$)/, 'DELETE')
    await findEntity(page, /couple/).getByRole('button', { name: /停用/ }).click()
    await confirmDelete(page)
    await apiCall

    // 業務狀態可被識別：已停用
    await expect(findEntity(page, /couple/).getByText('已停用')).toBeVisible()

    // 停用後 login 拒絕（deletedAt 過濾）
    const res = await page.request.post('/api/v1/auth/login', {
      data: { username: COUPLE.account, password: COUPLE.password },
    })
    expect(res.status()).toBe(404)
  })

  test('business guards：不得停用最後一個管理者（409）、不可停用自己（403）', async ({ page }) => {
    // seed 僅 user-001 一位管理者；open 模式無 token 時視同 user-001 → 先命中「最後管理者」409
    const lastAdmin = await page.request.delete('/api/v1/users/user-001')
    expect(lastAdmin.status()).toBe(409)
    expect(JSON.stringify(await lastAdmin.json())).toContain('不得停用最後一個管理者')

    // 建第二位管理員（帶密碼）並登入，停用自己 → 非最後一位，命中「不可停用自己」403
    const created = await page.request.post('/api/v1/admins', {
      data: { email: 'second-admin@example.com', displayName: '第二管理員', password: 'admin2pass' },
    })
    const { userId: adminId } = await created.json()
    const loginRes = await page.request.post('/api/v1/auth/login', {
      data: { username: 'second-admin@example.com', password: 'admin2pass' },
    })
    const { accessToken } = await loginRes.json()

    const self = await page.request.delete(`/api/v1/users/${adminId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    expect(self.status()).toBe(403)
    expect(JSON.stringify(await self.json())).toContain('不可停用自己的帳號')
  })

  test('RBAC：新人以自己的 token 存取 users 管理端點 → 403', async ({ page }) => {
    const loginRes = await page.request.post('/api/v1/auth/login', {
      data: { username: COUPLE.account, password: COUPLE.password },
    })
    const { accessToken } = await loginRes.json()

    const res = await page.request.get('/api/v1/users', {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    expect(res.status()).toBe(403)
    expect(JSON.stringify(await res.json())).toContain('只有管理者可以執行此操作')
  })
})

test.describe('vibe：新人帳號管理入口（非管理者隱藏＋導走）', () => {
  test('新人登入：側欄無「新人帳號」入口，直訪 /users 被導回自己的婚禮', async ({ page }) => {
    await resetMockData(page)
    await login(page, COUPLE.account, COUPLE.password)

    // 入口對非管理者隱藏
    const sidebar = page.getByTestId('vibe-sidebar')
    await expect(sidebar).toBeVisible()
    await expect(sidebar.getByText('新人帳號')).toHaveCount(0)

    // 直訪被守衛導回自己的婚禮
    await page.goto('/users')
    await page.waitForURL(/\/weddings\/wedding-001(\/|$|\?)/)
  })

  test('管理者登入：側欄有「新人帳號」入口', async ({ page }) => {
    await resetMockData(page)
    await login(page, TestUsers.admin.account, TestUsers.admin.password)
    await page.goto('/weddings', { waitUntil: 'networkidle' })

    await page.getByTestId('vibe-sidebar').getByText('新人帳號').click()
    await page.waitForURL(/\/users(\/|$|\?)/)
    await expect(page.getByTestId('vibe-couples-page')).toBeVisible()
  })
})
