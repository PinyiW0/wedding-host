// Source: server/api/.../cake-box-extra-orders/[extraOrderId].patch.ts + cake-box.vue（issue #108）
// Pattern: interaction（額外配發：控制面板留右欄、清單併入賓客分配表；列「⋯」選單編輯／刪除、分類 filter 篩出額外列）

import { expect, test } from '@playwright/test'

import { login, resetMockData, TestUsers } from '../helpers'

const WID = 'wedding-001'
const EXTRA = `/api/v1/weddings/${WID}/cake-box-extra-orders`

test.describe('vibe：額外配發清單與編輯', () => {
  test.beforeEach(async ({ page }) => {
    await resetMockData(page)
    await login(page, TestUsers.admin.account, TestUsers.admin.password)
  })

  test('PATCH 可改數量／姓名，清空選填欄存回 null；不存在 → 404', async ({ page }) => {
    const created = await (await page.request.post(EXTRA, {
      data: { cakeBoxTypeId: 'cakeboxtype-001', quantity: 3, recipientName: '公關甲', note: '公司同事' },
    })).json()

    const res = await page.request.patch(`${EXTRA}/${created.extraOrderId}`, {
      data: { quantity: 5, recipientName: '公關乙', note: null },
    })
    expect(res.ok()).toBeTruthy()
    const updated = await res.json()
    expect(updated.quantity).toBe(5)
    expect(updated.recipientName).toBe('公關乙')
    expect(updated.note).toBeNull()

    expect((await page.request.patch(`${EXTRA}/extra-nope`, { data: { quantity: 1 } })).status()).toBe(404)
  })

  test('UI：額外配發列顯示於賓客分配表，「⋯」編輯 → 右欄表單帶回舊值 → 更新後列同步', async ({ page }) => {
    const created = await (await page.request.post(EXTRA, {
      data: { cakeBoxTypeId: 'cakeboxtype-001', quantity: 2, recipientName: '公關丙' },
    })).json()

    await page.goto(`/weddings/${WID}/cake-box`, { waitUntil: 'networkidle' })

    // 額外配發列在左側賓客分配表中，帶「額外配發」標記
    const row = page.getByTestId(`vibe-extra-row-${created.extraOrderId}`)
    await expect(row).toContainText('公關丙')
    await expect(row).toContainText('額外配發')

    // 「⋯」選單 → 編輯 → 右欄控制面板帶回舊值，送出鈕轉為「更新」
    await page.getByTestId(`vibe-extra-menu-${created.extraOrderId}`).click()
    await page.getByRole('menuitem', { name: '編輯' }).click()
    await expect(page.getByTestId('cake-box-extra-qty')).toHaveValue('2')
    await expect(page.getByTestId('cake-box-extra-add')).toContainText('更新')

    // 改數量與姓名 → 更新 → 列同步、表單回到「加入」狀態
    await page.getByTestId('cake-box-extra-qty').fill('4')
    await page.getByTestId('cake-box-extra-name').fill('公關丁')
    await page.getByTestId('cake-box-extra-add').click()

    await expect(page.getByText('已更新額外配發').first()).toBeVisible()
    await expect(row).toContainText('公關丁')
    await expect(row).toContainText('×4 盒')
    await expect(page.getByTestId('cake-box-extra-add')).toContainText('加入')
  })

  test('UI：分類 filter 選「額外配發」→ 只剩額外列', async ({ page }) => {
    const created = await (await page.request.post(EXTRA, {
      data: { cakeBoxTypeId: 'cakeboxtype-002', quantity: 1, recipientName: '公關戊' },
    })).json()

    await page.goto(`/weddings/${WID}/cake-box`, { waitUntil: 'networkidle' })

    await page.getByTestId('vibe-category-filter').click()
    await page.getByRole('option', { name: '額外配發' }).click()
    await expect(page.getByTestId(`vibe-extra-row-${created.extraOrderId}`)).toBeVisible()
    // seed 賓客（陳大明）被篩掉
    await expect(page.getByText('陳大明')).toHaveCount(0)
  })

  test('UI：列「⋯」選單刪除 → 列消失', async ({ page }) => {
    const created = await (await page.request.post(EXTRA, {
      data: { cakeBoxTypeId: 'cakeboxtype-002', quantity: 1 },
    })).json()

    await page.goto(`/weddings/${WID}/cake-box`, { waitUntil: 'networkidle' })
    await page.getByTestId(`vibe-extra-menu-${created.extraOrderId}`).click()
    await page.getByRole('menuitem', { name: '刪除' }).click()

    await expect(page.getByText('已移除額外配發').first()).toBeVisible()
    await expect(page.getByTestId(`vibe-extra-row-${created.extraOrderId}`)).toHaveCount(0)
  })
})
