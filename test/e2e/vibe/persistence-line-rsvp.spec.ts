import { expect, test } from '@playwright/test'

import {
  findEntity,
  login,
  resetMockData,
  selectOption,
  TestUsers,
  waitForApiCall,
} from '../helpers'

// 持久化盲區補測：原 specs 只驗「寫入→當下顯示」，未驗「寫入→重整→還在」。
// 這兩個契約落差（LINE OA 缺 GET、guests GET 漏 rsvpAttending）修復後，
// 重整應仍能還原狀態。

const LINE_PATH = '/weddings/wedding-001/line'
const RSVP_PATH = '/weddings/wedding-001/rsvp'

test.describe('持久化：LINE OA 與 RSVP 重整後仍在', () => {
  test.beforeEach(async ({ page }) => {
    await resetMockData(page)
    await login(page, TestUsers.admin.account, TestUsers.admin.password)
  })

  test('LINE OA：連結後重整仍顯示已連結與 OA 名稱', async ({ page }) => {
    await page.goto(LINE_PATH, { waitUntil: 'networkidle' })

    // 連結 LINE OA
    await page.getByRole('button', { name: /連結|綁定/ }).click()
    await page.getByLabel(/OA 名稱|官方帳號名稱/).fill('王李婚禮小助手')
    await page.getByLabel(/Channel ID|頻道/).fill('1234567890')

    const apiCall = waitForApiCall(page, /\/line-oa(\?|$)/, 'POST')
    await page.getByRole('button', { name: /儲存|送出|確定/ }).click()
    await apiCall

    // 寫入當下：顯示已連結與 OA 名稱
    await expect(page.getByText(/王李婚禮小助手/)).toBeVisible()

    // 重整後仍在（重點：靠 GET 還原，非 ref 暫存）
    await page.reload({ waitUntil: 'networkidle' })
    await expect(page.getByText(/已連結/)).toBeVisible()
    await expect(page.getByText(/王李婚禮小助手/)).toBeVisible()
  })

  test('RSVP：覆寫出席狀態後重整仍正確（非未提交）', async ({ page }) => {
    await page.goto(RSVP_PATH, { waitUntil: 'networkidle' })

    // 覆寫 guest-001（陳大明）為缺席
    await findEntity(page, /陳大明/)
      .getByRole('button', { name: /覆寫/ })
      .click()
    await page.getByLabel(/原因/).fill('賓客臨時通知無法出席')
    await selectOption(page, 'rsvp-override-attending', /缺席/)

    const apiCall = waitForApiCall(
      page,
      /\/guests\/guest-001\/rsvp-override(\?|$)/,
      'POST',
    )
    await page.getByRole('button', { name: /送出|覆寫|確定/ }).click()
    await apiCall

    // 寫入當下：顯示缺席
    const statusCell = page.getByTestId('rsvp-status-guest-001')
    await expect(statusCell).toHaveText(/缺席/)

    // 重整後仍是缺席（重點：靠 GET 的 rsvpAttending 還原，非本地 map）
    await page.reload({ waitUntil: 'networkidle' })
    await expect(page.getByTestId('rsvp-status-guest-001')).toHaveText(/缺席/)
    await expect(page.getByTestId('rsvp-status-guest-001')).not.toHaveText(/未提交/)
  })
})
