import { expect, test } from '@playwright/test'

import {
  findEntity,
  login,
  resetMockData,
  selectOption,
  TestUsers,
  waitForApiCall,
} from '../helpers'

// 持久化盲區補測（組3）：原 specs 只驗「寫入→當下/API spy」，未驗「寫入→重整→還在」。
// 三個契約落差（謝卡範本缺 GET、謝卡客製缺 GET、喜餅指派缺 GET 且前端無顯示區）
// 修復後，重整應由 GET 還原狀態，而非靠本地 ref / 完全看不到。

const THANK_YOU_PATH = '/weddings/wedding-001/thank-you'
const CAKE_BOX_PATH = '/weddings/wedding-001/cake-box'

test.describe('持久化：謝卡與喜餅指派重整後仍在', () => {
  test.beforeEach(async ({ page }) => {
    await resetMockData(page)
    await login(page, TestUsers.admin.account, TestUsers.admin.password)
  })

  test('謝卡範本：設定內容後重整，預覽仍顯示內容（非「尚未設定」）', async ({ page }) => {
    await page.goto(THANK_YOU_PATH, { waitUntil: 'networkidle' })

    // 設定範本內容
    await page.getByRole('button', { name: /設定.*範本|編輯.*範本/ }).click()
    await page.getByTestId('template-content-input').fill('感謝您的祝福，我們會永遠珍惜！')

    const apiCall = waitForApiCall(page, /\/thank-you-card\/template(\?|$)/, 'PUT')
    await page.getByTestId('template-submit').click()
    await apiCall

    // 寫入當下：預覽顯示內容
    await expect(page.getByTestId('template-preview')).toHaveText(/感謝您的祝福，我們會永遠珍惜/)

    // 重整後仍在（重點：靠 GET 還原，非本地 ref）
    await page.reload({ waitUntil: 'networkidle' })
    await expect(page.getByTestId('template-preview')).toHaveText(/感謝您的祝福，我們會永遠珍惜/)
    await expect(page.getByText(/尚未設定謝卡範本/)).toBeHidden()
  })

  test('謝卡客製：客製某賓客後重整，客製內容仍在', async ({ page }) => {
    await page.goto(THANK_YOU_PATH, { waitUntil: 'networkidle' })

    // 為 guest-001（陳大明）客製（文字先填、下拉最後選，坑 #8）
    await page.getByRole('button', { name: /客製/ }).click()
    await page.getByTestId('customize-content-input').fill('親愛的陳大明，特別感謝您遠道而來！')
    await selectOption(page, 'customize-guest-select', /陳大明/)

    const apiCall = waitForApiCall(page, /\/thank-you-card\/customizations(\?|$)/, 'POST')
    await page.getByTestId('customize-submit').click()
    await apiCall

    // 寫入當下：清單出現客製賓客與內容
    await expect(findEntity(page, /陳大明/)).toBeVisible()
    await expect(page.getByText(/親愛的陳大明，特別感謝您遠道而來/)).toBeVisible()

    // 重整後仍在（重點：靠 GET 還原，非本地物件）
    await page.reload({ waitUntil: 'networkidle' })
    await expect(findEntity(page, /陳大明/)).toBeVisible()
    await expect(page.getByText(/親愛的陳大明，特別感謝您遠道而來/)).toBeVisible()
    await expect(page.getByText(/尚無客製謝卡/)).toBeHidden()
  })

  test('喜餅指派：設定指派後重整，指派結果仍顯示在指派區', async ({ page }) => {
    await page.goto(CAKE_BOX_PATH, { waitUntil: 'networkidle' })

    // 設定指派規則（文字先填、下拉最後選，坑 #8）
    await page.getByRole('button', { name: /設定.*指派|指派規則/ }).click()
    await page.getByTestId('assignment-rule').fill('家人→大餅＋豪華禮盒')
    await selectOption(page, 'assignment-type-select', /經典禮盒/)
    await selectOption(page, 'assignment-guest-select', /陳大明/)

    const apiCall = waitForApiCall(
      page,
      /\/cake-box-types\/cakeboxtype-001\/assignment(\?|$)/,
      'POST',
    )
    await page.getByTestId('assignment-submit').click()
    await apiCall

    // 寫入當下：指派區顯示結果（賓客 → 款式 + 規則）
    const assignmentSection = page.getByTestId('cake-box-assignment-list')
    await expect(assignmentSection.getByText(/陳大明/)).toBeVisible()
    await expect(assignmentSection.getByText(/家人→大餅＋豪華禮盒/)).toBeVisible()

    // 重整後仍在（重點：靠 GET 還原，新顯示區由 GET 渲染）
    await page.reload({ waitUntil: 'networkidle' })
    await expect(page.getByTestId('cake-box-assignment-list').getByText(/陳大明/)).toBeVisible()
    await expect(page.getByTestId('cake-box-assignment-list').getByText(/家人→大餅＋豪華禮盒/)).toBeVisible()
    await expect(page.getByText(/尚未設定指派規則/)).toBeHidden()
  })
})
