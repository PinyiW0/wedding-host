// Source: issue #207 — server/api/v1/weddings/[weddingId]/short-links.post.ts、server/routes/s/[code].get.ts、
//   server/api/v1/weddings/[weddingId]/rundown-roles/order.put.ts
// Pattern: security-guard——
//   1. 流程表短網址轉址時補的簽章，必須與原本長網址的簽章完全相同（角色簽章只通行該角色、總覽簽章讀不到別的）。
//      gate 於 open 模式跑、公開頁不強制簽章：簽錯畫面照樣綠燈，所以直接比對 302 的 Location
//   2. 角色版短網址的 roleId 必須屬於這場婚禮（跨租戶 IDOR）
//   3. 角色順序必須剛好是這場婚禮的全部角色，不多不少

import { expect, test } from '@playwright/test'

import { resetMockData } from '../helpers'

const WEDDING = 'wedding-001'
const API = `/api/v1/weddings/${WEDDING}`

test.describe('vibe：流程表短網址與角色順序 API（issue #207）', () => {
  test.beforeEach(async ({ page }) => {
    await resetMockData(page)
  })

  test('角色版短網址：同角色同短碼，轉址簽章與長網址相同', async ({ page }) => {
    const first = await (await page.request.post(`${API}/short-links`, { data: { kind: 'rundown-role', roleId: 'role-003' } })).json()
    const again = await (await page.request.post(`${API}/short-links`, { data: { kind: 'rundown-role', roleId: 'role-003' } })).json()
    expect(again.code).toBe(first.code)
    expect(first.code).toHaveLength(8)

    const { sig } = await (await page.request.get(`${API}/signed-links?roleId=role-003`)).json()
    const res = await page.request.get(`/s/${first.code}`, { maxRedirects: 0 })
    expect(res.status()).toBe(302)
    expect(res.headers().location).toBe(`/rundown/${WEDDING}?role=role-003&sig=${encodeURIComponent(sig)}`)
  })

  test('總覽短網址：轉址帶工作人員總覽簽章', async ({ page }) => {
    const { code } = await (await page.request.post(`${API}/short-links`, { data: { kind: 'rundown-staff' } })).json()
    expect(code).toHaveLength(8)

    const { sig } = await (await page.request.get(`${API}/signed-links?scope=staff`)).json()
    const res = await page.request.get(`/s/${code}`, { maxRedirects: 0 })
    expect(res.headers().location).toBe(`/rundown/${WEDDING}?sig=${encodeURIComponent(sig)}`)
  })

  test('角色版短網址：不帶角色 400、別場或不存在的角色 404', async ({ page }) => {
    expect((await page.request.post(`${API}/short-links`, { data: { kind: 'rundown-role' } })).status()).toBe(400)
    expect((await page.request.post(`${API}/short-links`, { data: { kind: 'rundown-role', roleId: 'role-999' } })).status()).toBe(404)
  })

  test('角色順序：清單少一個、重複或混進不存在的角色都 400，順序不變', async ({ page }) => {
    const order = ['role-004', 'role-003', 'role-002', 'role-001']
    for (const roleIds of [order.slice(1), [...order, 'role-001'], [...order.slice(1), 'role-999']]) {
      const res = await page.request.put(`${API}/rundown-roles/order`, { data: { roleIds } })
      expect(res.status()).toBe(400)
    }
    const roles = await (await page.request.get(`${API}/rundown-roles`)).json()
    expect(roles.map((r: { roleId: string }) => r.roleId)).toEqual(['role-001', 'role-002', 'role-003', 'role-004'])
  })
})
