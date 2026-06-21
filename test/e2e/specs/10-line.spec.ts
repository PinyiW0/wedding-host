import { expect, test } from '@playwright/test'

import {
  getFeedbackElement,
  login,
  resetMockData,
  TestUsers,
  waitForApiCall,
} from '../helpers'

// 對應 spec/e2e-flows/10-line.flow.md
// Feature Background：wedding-001；管理員（Andrea/Andrea1122）。
//   Admin 端，頁面：/weddings/wedding-001/line
//   操作：將 LINE 官方帳號（oaName + channelId）連結至婚禮。
//
// mock 實況：mockLineOas 初始為空；POST .../line-oa 回 201 + LineOaConnectedEvent，
//   婚禮不存在回 404「婚禮不存在」。

const LINE_PATH = '/weddings/wedding-001/line'
// not-found 場景：mock seed 必含 wedding-001，故以不存在的 weddingId 觸發 404（坑 #5）
const MISSING_WEDDING = '/api/v1/weddings/wedding-999'

test.describe('管理端：連結 LINE 官方帳號（Admin）', () => {
  test.beforeEach(async ({ page }) => {
    await resetMockData(page)
    await login(page, TestUsers.admin.account, TestUsers.admin.password)
  })

  test.describe('規則：成功連結 LINE 官方帳號', () => {
    test('成功連結 LINE 官方帳號', async ({ page }) => {
      // Given：wedding-001 已建立
      await page.goto(LINE_PATH, { waitUntil: 'networkidle' })

      // When：觸發「連結 LINE 官方帳號」並填寫 OA 名稱與 Channel ID
      await page.getByRole('button', { name: /連結|綁定/ }).click()
      await page.getByLabel(/OA 名稱|官方帳號名稱/).fill('王李婚禮小助手')
      await page.getByLabel(/Channel ID|頻道/).fill('1234567890')

      // 主要 outcome：API spy 驗證 POST .../line-oa，payload 含 oaName / channelId
      const apiCall = waitForApiCall(page, /\/line-oa(\?|$)/, 'POST')
      await page.getByRole('button', { name: /儲存|送出|確定/ }).click()
      const request = await apiCall
      expect(request.postDataJSON()).toMatchObject({
        oaName: '王李婚禮小助手',
        channelId: '1234567890',
      })

      // Then：使用者能感知連結成功，且能讀到 OA 名稱與已連結狀態
      await expect(getFeedbackElement(page)).toBeVisible()
      await expect(page.getByText(/王李婚禮小助手/)).toBeVisible()
    })
  })

  test.describe('規則：連結時婚禮不存在', () => {
    test('婚禮不存在', async ({ page }) => {
      // 性質：API 邊界保護
      const res = await page.request.post(`${MISSING_WEDDING}/line-oa`, {
        data: { oaName: '王李婚禮小助手', channelId: '1234567890' },
      })
      expect(res.status()).toBe(404)
      expect(JSON.stringify(await res.json())).toContain('婚禮不存在')
    })
  })
})
