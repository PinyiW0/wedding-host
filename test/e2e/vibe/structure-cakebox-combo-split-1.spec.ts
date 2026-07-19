// Source: server/api/.../cake-box-types/*（componentTypeIds 驗證與刪除守門）
//         + server/utils/cakebox-combo.ts + cake-box.vue 訂購總覽拆算（issue #106）
// Pattern: structure（組合款建立／防巢狀／刪除守門）+ interaction（訂購總覽自動拆算）
// 需求：發兩款喜餅給同一位賓客——組合當單一款式指派與發放，下單數量由訂購總覽拆算回單款

import { expect, test } from '@playwright/test'

import { login, resetMockData, TestUsers } from '../helpers'

const WID = 'wedding-001'
const TYPES = `/api/v1/weddings/${WID}/cake-box-types`

interface TypeRow {
  cakeBoxTypeId: string
  componentTypeIds: string[] | null
}

test.describe('vibe：喜餅組合款與訂購拆算', () => {
  test.beforeEach(async ({ page }) => {
    await resetMockData(page)
    await login(page, TestUsers.admin.account, TestUsers.admin.password)
  })

  test('建立組合款：componentTypeIds 入庫且清單可讀回', async ({ page }) => {
    const res = await page.request.post(TYPES, {
      data: { name: '大餅＋豪華組', isDefault: false, componentTypeIds: ['cakeboxtype-001', 'cakeboxtype-002'] },
    })
    expect(res.status()).toBe(201)
    const { cakeBoxTypeId } = await res.json()

    const list: TypeRow[] = await (await page.request.get(TYPES)).json()
    const combo = list.find(t => t.cakeBoxTypeId === cakeBoxTypeId)
    expect(combo?.componentTypeIds).toEqual(['cakeboxtype-001', 'cakeboxtype-002'])
  })

  test('防巢狀：組合款不可內含組合款、不可含不存在款式', async ({ page }) => {
    const combo = await (await page.request.post(TYPES, {
      data: { name: '組合A', isDefault: false, componentTypeIds: ['cakeboxtype-001'] },
    })).json()

    const nested = await page.request.post(TYPES, {
      data: { name: '組合B', isDefault: false, componentTypeIds: [combo.cakeBoxTypeId] },
    })
    expect(nested.status()).toBe(400)

    const missing = await page.request.post(TYPES, {
      data: { name: '組合C', isDefault: false, componentTypeIds: ['cakeboxtype-nope'] },
    })
    expect(missing.status()).toBe(404)
  })

  test('刪除守門：被組合引用的單款 409，解除引用後可刪', async ({ page }) => {
    // 自建單款＋引用它的組合，避免動 seed 既有款式（其自帶指派）
    const single = await (await page.request.post(TYPES, { data: { name: '守門單款', isDefault: false } })).json()
    const combo = await (await page.request.post(TYPES, {
      data: { name: '守門組合', isDefault: false, componentTypeIds: [single.cakeBoxTypeId] },
    })).json()

    const blocked = await page.request.delete(`${TYPES}/${single.cakeBoxTypeId}`)
    expect(blocked.status()).toBe(409)

    // 解除引用（空陣列＝解除組合）後可刪
    expect((await page.request.patch(`${TYPES}/${combo.cakeBoxTypeId}`, { data: { componentTypeIds: [] } })).ok()).toBeTruthy()
    expect((await page.request.delete(`${TYPES}/${single.cakeBoxTypeId}`)).status()).toBe(204)
  })

  test('訂購總覽拆算：組合款額外配發 2 份 → 內含單款各 +2 盒、組合列標示已拆算', async ({ page }) => {
    const combo = await (await page.request.post(TYPES, {
      data: { name: '雙喜組合', isDefault: false, componentTypeIds: ['cakeboxtype-001', 'cakeboxtype-002'] },
    })).json()
    expect((await page.request.post(`/api/v1/weddings/${WID}/cake-box-extra-orders`, {
      data: { cakeBoxTypeId: combo.cakeBoxTypeId, quantity: 2 },
    })).ok()).toBeTruthy()

    await page.goto(`/weddings/${WID}/cake-box`, { waitUntil: 'networkidle' })

    // 組合列標示已拆算、不計入下單；內含單款列各出現拆算數
    await expect(page.getByTestId(`vibe-order-row-${combo.cakeBoxTypeId}`)).toContainText('（組合，已拆算至單款）')
    await expect(page.getByTestId('vibe-order-row-cakeboxtype-001')).toContainText('組合拆算 2')
    await expect(page.getByTestId('vibe-order-row-cakeboxtype-002')).toContainText('組合拆算 2')
  })
})
