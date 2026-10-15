// Source: app/pages/weddings/[weddingId]/rundown.vue（issue #194）
// Pattern: 折疊（角色欄逐一顯示／隱藏＋記住選擇）
//
// 角色多時矩陣表太寬：每個角色欄標題可隱藏該欄，已隱藏的欄可逐一點回或一次全部顯示。
// 隱藏只影響這台裝置的畫面（存 cookie）：不動草稿、隱藏欄的內容照樣儲存；單一角色篩選時一律顯示該角色。

import { expect, test } from '@playwright/test'

import { login, resetMockData, selectOption, TestUsers, waitForApiCall } from '../helpers'

const WEDDING_ID = 'wedding-001'
const RUNDOWN_PATH = `/weddings/${WEDDING_ID}/rundown`

// seed 角色：接待、總場控（role-002）、新秘、平面攝影師
const ROLE = '總場控'
const ROLE_ID = 'role-002'

test.describe('vibe：當天流程角色欄顯示／隱藏', () => {
  test.beforeEach(async ({ page }) => {
    await resetMockData(page)
    await login(page, TestUsers.admin.account, TestUsers.admin.password)
    await page.goto(RUNDOWN_PATH, { waitUntil: 'networkidle' })
  })

  test('隱藏一欄後表格少一欄，可逐一顯示回來', async ({ page }) => {
    const header = page.getByRole('columnheader', { name: new RegExp(ROLE) })
    await expect(header).toBeVisible()
    await expect(page.getByText(/已隱藏 \d 欄/)).toHaveCount(0)

    await page.getByRole('button', { name: `隱藏 ${ROLE} 欄` }).click()

    await expect(header).toHaveCount(0)
    await expect(page.getByTestId(`rundown-cell-role-${ROLE_ID}`)).toHaveCount(0)
    await expect(page.getByText('已隱藏 1 欄：')).toBeVisible()

    await page.getByRole('button', { name: `顯示 ${ROLE} 欄` }).click()
    await expect(header).toBeVisible()
    await expect(page.getByText(/已隱藏 \d 欄/)).toHaveCount(0)
  })

  test('隱藏狀態重整後保留，「全部顯示」一次還原', async ({ page }) => {
    await page.getByRole('button', { name: `隱藏 ${ROLE} 欄` }).click()
    await page.getByRole('button', { name: '隱藏 接待 欄' }).click()
    await expect(page.getByText('已隱藏 2 欄：')).toBeVisible()

    await page.reload({ waitUntil: 'networkidle' })
    await expect(page.getByText('已隱藏 2 欄：')).toBeVisible()
    await expect(page.getByRole('columnheader', { name: new RegExp(ROLE) })).toHaveCount(0)

    await page.getByRole('button', { name: '全部顯示' }).click()
    await expect(page.getByRole('columnheader', { name: new RegExp(ROLE) })).toBeVisible()
    await expect(page.getByRole('columnheader', { name: /接待/ })).toBeVisible()
  })

  test('隱藏欄的內容照樣儲存，顯示回來後還在', async ({ page }) => {
    const task = '確認音控與燈光進場時間'
    await page.getByTestId(`rundown-cell-role-${ROLE_ID}`).first().fill(task)
    await page.getByRole('button', { name: `隱藏 ${ROLE} 欄` }).click()

    const apiCall = waitForApiCall(page, /\/rundown-items(\?|$)/, 'PUT')
    await page.getByTestId('rundown-save').click()
    const request = await apiCall
    expect(JSON.stringify(request.postDataJSON())).toContain(task)
    await expect(page.getByText('流程表已儲存').first()).toBeVisible()

    await page.getByRole('button', { name: `顯示 ${ROLE} 欄` }).click()
    await expect(page.getByTestId(`rundown-cell-role-${ROLE_ID}`).first()).toHaveValue(task)
  })

  test('單一角色篩選時，即使該角色已隱藏仍顯示其欄', async ({ page }) => {
    // 篩選只列出該角色有任務的列：先給總場控一個任務
    await page.getByTestId(`rundown-cell-role-${ROLE_ID}`).first().fill('確認進場時間')
    await page.getByRole('button', { name: `隱藏 ${ROLE} 欄` }).click()
    await selectOption(page, 'rundown-role-filter', ROLE)

    await expect(page.getByRole('columnheader', { name: new RegExp(ROLE) })).toBeVisible()
    await expect(page.getByText(/已隱藏 \d 欄/)).toHaveCount(0)
    await expect(page.getByRole('button', { name: `隱藏 ${ROLE} 欄` })).toHaveCount(0)
  })
})
