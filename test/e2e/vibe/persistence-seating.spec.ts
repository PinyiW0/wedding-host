import { expect, test } from '@playwright/test'

import {
  login,
  resetMockData,
  TestUsers,
  waitForApiCall,
} from '../helpers'

// 持久化盲區補測（組2）：原 specs 只驗「寫入→當下/PUT spy」，未驗「寫入→重整→還在」。
// 場地佈局契約落差（缺 GET、前端硬編 state）修復後，
// 重開 modal 應由 GET 還原既有值，而非回到硬編預設。
// （禮俗設定持久化測試已隨禮俗建議功能移除，issue #59）

const SEATING_PATH = '/weddings/wedding-001/seating'

test.describe('持久化：場地佈局重整後仍在', () => {
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
})
