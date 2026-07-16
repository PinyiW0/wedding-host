// Source: issue #92 — 喜餅／小物資料一致性守門（純 server handler 邊界保護，無 UI）
//   cake-box-types/[id]/index.delete.ts、guests/[id]/cake-box-distribution.post.ts、
//   gift-items/{index.post,[id]/index.patch}.ts、cake-box-exclusions/index.post.ts
// Pattern: security-guard——狀態守門（既成事實不可湮滅）＋輸入白名單＋租戶存在性。
//   gate 於 open 模式跑：page.request 無 token 退回預設管理員，即模擬管理端登入態。
// 註：刪款式對「指派（cake_box_assignments）」的級聯清除在 API 層不可觀察
//   （assignments.get.ts 以 typeMap 過濾，款式一刪該指派本就不再回傳），故此處只驗
//   「僅有指派的款式可正常刪除、不被 in-use 守門誤擋」；殭屍列清除的正確性靠 review。

import { expect, test } from '@playwright/test'

import { resetMockData } from '../helpers'

// seed（wedding-001）：款式 001 經典／002 豪華／003 輕巧；
//   指派 guest-004→001、guest-006/012→003、guest-002/003/007/011→002；
//   無任何發放（guests.cakeBoxDistributedTypeId 皆 null）、無額外配發、無排除。
const WEDDING = 'wedding-001'

test.describe('vibe：喜餅／小物一致性守門（issue #92）', () => {
  test.beforeEach(async ({ page }) => {
    await resetMockData(page)
  })

  test.describe('規則：刪除喜餅款式時，既成事實不可湮滅', () => {
    test('已有賓客領取該款式 → 409，款式仍在', async ({ page }) => {
      // Given：guest-004 領取 cakeboxtype-001
      const distribute = await page.request.post(
        `/api/v1/weddings/${WEDDING}/guests/guest-004/cake-box-distribution`,
        { data: { cakeBoxTypeId: 'cakeboxtype-001' } },
      )
      expect(distribute.status()).toBe(201)

      // When：移除該款式
      const res = await page.request.delete(`/api/v1/weddings/${WEDDING}/cake-box-types/cakeboxtype-001`)

      // Then：被擋（409），款式仍存在
      expect(res.status()).toBe(409)
      expect(JSON.stringify(await res.json())).toContain('領取')
      const list = await (await page.request.get(`/api/v1/weddings/${WEDDING}/cake-box-types`)).json()
      expect(list.some((t: { cakeBoxTypeId: string }) => t.cakeBoxTypeId === 'cakeboxtype-001')).toBe(true)
    })

    test('該款式仍有額外配發 → 409，款式仍在', async ({ page }) => {
      // Given：cakeboxtype-002 有一筆額外配發
      const order = await page.request.post(
        `/api/v1/weddings/${WEDDING}/cake-box-extra-orders`,
        { data: { cakeBoxTypeId: 'cakeboxtype-002', quantity: 10 } },
      )
      expect(order.status()).toBe(201)

      // When：移除該款式
      const res = await page.request.delete(`/api/v1/weddings/${WEDDING}/cake-box-types/cakeboxtype-002`)

      // Then：被擋（409），款式仍存在
      expect(res.status()).toBe(409)
      expect(JSON.stringify(await res.json())).toContain('額外配發')
      const list = await (await page.request.get(`/api/v1/weddings/${WEDDING}/cake-box-types`)).json()
      expect(list.some((t: { cakeBoxTypeId: string }) => t.cakeBoxTypeId === 'cakeboxtype-002')).toBe(true)
    })

    test('僅有指派、無發放無配發 → 正常刪除（204），不被 in-use 守門誤擋', async ({ page }) => {
      // Given：cakeboxtype-003 在 seed 有指派（guest-006／012）但無發放無配發
      // When：移除該款式
      const res = await page.request.delete(`/api/v1/weddings/${WEDDING}/cake-box-types/cakeboxtype-003`)

      // Then：成功（指派屬「預定發哪款」的計畫，款式沒了即無意義，隨款式一併清除）
      expect(res.status()).toBe(204)
      const list = await (await page.request.get(`/api/v1/weddings/${WEDDING}/cake-box-types`)).json()
      expect(list.some((t: { cakeBoxTypeId: string }) => t.cakeBoxTypeId === 'cakeboxtype-003')).toBe(false)
    })
  })

  test.describe('規則：發放喜餅必須指定款式', () => {
    test('未帶 cakeBoxTypeId → 400（不再退回 seed 專屬 id 繞過租戶驗證）', async ({ page }) => {
      const res = await page.request.post(`/api/v1/weddings/${WEDDING}/guests/guest-001/cake-box-distribution`, { data: {} })
      expect(res.status()).toBe(400)
      expect(JSON.stringify(await res.json())).toContain('請選擇喜餅款式')
    })
  })

  test.describe('規則：小物類別限六類白名單', () => {
    test('新增帶非白名單類別 → 400', async ({ page }) => {
      const res = await page.request.post(`/api/v1/weddings/${WEDDING}/gift-items`, {
        data: { category: 'not_a_category', description: '毒值測試', unitPrice: 0, quantity: 0 },
      })
      expect(res.status()).toBe(400)
      expect(JSON.stringify(await res.json())).toContain('禮物類別')
    })

    test('更新帶非白名單類別 → 400', async ({ page }) => {
      const res = await page.request.patch(`/api/v1/weddings/${WEDDING}/gift-items/giftitem-001`, {
        data: { category: 'not_a_category' },
      })
      expect(res.status()).toBe(400)
      expect(JSON.stringify(await res.json())).toContain('禮物類別')
    })
  })

  test.describe('規則：喜餅排除需指向本婚禮既有賓客', () => {
    test('排除不存在的賓客 → 404', async ({ page }) => {
      const res = await page.request.post(`/api/v1/weddings/${WEDDING}/cake-box-exclusions`, {
        data: { guestId: 'guest-999' },
      })
      expect(res.status()).toBe(404)
      expect(JSON.stringify(await res.json())).toContain('賓客不存在')
    })
  })
})
