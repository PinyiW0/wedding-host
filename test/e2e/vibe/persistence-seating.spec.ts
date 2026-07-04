import { expect, test } from '@playwright/test'

import {
  login,
  resetMockData,
  TestUsers,
  waitForApiCall,
} from '../helpers'

// 持久化盲區補測（組2）：原 specs 只驗「寫入→當下/PUT spy」，未驗「寫入→重整→還在」。
// 場地佈局與禮俗設定兩個契約落差（缺 GET、前端硬編 state）修復後，
// 重開 modal 應由 GET 還原既有值，而非回到硬編預設。

const SEATING_PATH = '/weddings/wedding-001/seating'

test.describe('持久化：場地佈局與禮俗設定重整後仍在', () => {
  test.beforeEach(async ({ page }) => {
    await resetMockData(page)
    await login(page, TestUsers.admin.account, TestUsers.admin.password)
  })

  test('場地佈局：設定舞台寬高/位置後重整，重開 modal 仍是剛存的值', async ({ page }) => {
    await page.goto(SEATING_PATH, { waitUntil: 'networkidle' })

    // 開場地佈局 modal，填入有別於 seed 預設（300/150/500/100）的明顯值
    await page.getByTestId('venue-layout').click()
    await page.getByTestId('stage-width').fill('999')
    await page.getByTestId('stage-height').fill('888')
    await page.getByTestId('stage-position-x').fill('777')
    await page.getByTestId('stage-position-y').fill('666')

    const apiCall = waitForApiCall(page, /\/venue-layout(\?|$)/, 'PUT')
    await page.getByTestId('venue-submit').click()
    await apiCall

    // 重整後重開 modal：值應由 GET 還原為剛存的，而非硬編預設
    await page.reload({ waitUntil: 'networkidle' })
    await page.getByTestId('venue-layout').click()
    await expect(page.getByTestId('venue-form-modal')).toBeVisible()
    await expect(page.getByTestId('stage-width')).toHaveValue('999')
    await expect(page.getByTestId('stage-height')).toHaveValue('888')
    await expect(page.getByTestId('stage-position-x')).toHaveValue('777')
    await expect(page.getByTestId('stage-position-y')).toHaveValue('666')
  })

  test('禮俗設定：切換開關後重整，重開 modal 開關狀態仍是剛存的', async ({ page }) => {
    await page.goto(SEATING_PATH, { waitUntil: 'networkidle' })

    // seed：elderNearMain=true、sameCategoryTogether=false。切換兩者使其翻轉。
    // （「男女分桌」開關已依需求自禮俗設定移除，故改驗「同分類同桌」開關的持久化）
    await page.getByTestId('etiquette-settings').click()
    await expect(page.getByTestId('etiquette-form-modal')).toBeVisible()

    const elderSwitch = page.getByTestId('etiquette-elder-near-main')
    const sameCategorySwitch = page.getByTestId('etiquette-same-category-together')

    // 確認載入既有值（seed）後再切換，驗證翻轉結果可被持久化
    await expect(elderSwitch).toHaveAttribute('aria-checked', 'true')
    await expect(sameCategorySwitch).toHaveAttribute('aria-checked', 'false')
    await elderSwitch.click() // true -> false
    await sameCategorySwitch.click() // false -> true

    const apiCall = waitForApiCall(page, /\/etiquette-settings(\?|$)/, 'PUT')
    await page.getByTestId('etiquette-submit').click()
    await apiCall

    // 重整後重開 modal：開關狀態應由 GET 還原為剛存的翻轉結果，而非硬編預設
    await page.reload({ waitUntil: 'networkidle' })
    await page.getByTestId('etiquette-settings').click()
    await expect(page.getByTestId('etiquette-form-modal')).toBeVisible()
    await expect(page.getByTestId('etiquette-elder-near-main')).toHaveAttribute('aria-checked', 'false')
    await expect(page.getByTestId('etiquette-same-category-together')).toHaveAttribute('aria-checked', 'true')
  })
})
