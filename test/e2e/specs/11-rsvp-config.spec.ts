import { expect, test } from '@playwright/test'

import {
  getFeedbackElement,
  login,
  resetMockData,
  TestUsers,
  waitForApiCall,
} from '../helpers'

// 對應 spec/e2e-flows/11-rsvp-config.flow.md（設定 RSVP 表單題目與外觀 + 賓客依設定渲染）
// Feature Background：
//   - 設定：已登入為管理員（Admin）；wedding-001 已選定
//   - 渲染：賓客（Guest）端透過專屬連結操作，不需登入
// mock seed：wedding-001、guest-001（陳大明 / 未提交 RSVP）；rsvp-config 未設定（回預設範本）

// === Admin 端：設定 RSVP 表單（需登入） ===
test.describe('RSVP 表單設定（Admin 端）', () => {
  test.beforeEach(async ({ page }) => {
    await resetMockData(page)
    await login(page, TestUsers.admin.account, TestUsers.admin.password)
  })

  test.describe('規則：成功設定 RSVP 表單', () => {
    test('成功設定 RSVP 表單（API 邊界）', async ({ page }) => {
      // When：設定模板 floral + 題目（停用接駁、加一題自訂單選）
      const res = await page.request.put('/api/v1/weddings/wedding-001/rsvp-config', {
        data: {
          weddingId: 'wedding-001',
          theme: 'floral',
          banner: null,
          questions: [
            { type: 'builtin', key: 'attending', label: '是否會出席婚禮？', enabled: true, order: 1 },
            { type: 'builtin', key: 'shuttle', label: '高雄地區接駁車', enabled: false, order: 2 },
            { type: 'single', id: 'q-song', label: '想點播的歌曲？', required: false, order: 3, options: [{ value: 'ballad', label: '抒情' }] },
          ],
        },
      })
      // Then：設定成功，回應含 theme=floral
      expect(res.ok()).toBeTruthy()
      expect(await res.json()).toMatchObject({ weddingId: 'wedding-001', theme: 'floral' })
    })
  })

  test.describe('規則：設定不存在的婚禮', () => {
    test('婚禮不存在', async ({ page }) => {
      // 性質：API 邊界保護
      const res = await page.request.put('/api/v1/weddings/wedding-999/rsvp-config', {
        data: { weddingId: 'wedding-999', theme: 'minimal', banner: null, questions: [] },
      })
      expect(res.status()).toBe(404)
      expect(JSON.stringify(await res.json())).toContain('婚禮不存在')
    })
  })

  test.describe('規則：未設定過回預設範本', () => {
    test('讀回預設範本（API 邊界）', async ({ page }) => {
      // 性質：未設定過時 GET 回預設範本（不回 null），賓客表單一律有可用設定
      const res = await page.request.get('/api/v1/weddings/wedding-001/rsvp-config')
      expect(res.ok()).toBeTruthy()
      const config = await res.json()
      expect(config.theme).toBe('minimal')
      // 預設範本含 8 題系統題（含出席題）
      expect(config.questions.length).toBeGreaterThanOrEqual(8)
      expect(config.questions.some((q: { key?: string }) => q.key === 'attending')).toBeTruthy()
    })
  })

  test.describe('規則：後台設定頁可儲存設定', () => {
    test('於設定頁儲存設定', async ({ page }) => {
      // Given：進入題目設定頁（GET 載入現有設定）
      await page.goto('/weddings/wedding-001/rsvp/questions', { waitUntil: 'networkidle' })

      // When：儲存設定
      const apiCall = waitForApiCall(page, /\/weddings\/wedding-001\/rsvp-config(\?|$)/, 'PUT')
      await page.getByRole('button', { name: /儲存/ }).first().click()
      const request = await apiCall

      // Then：送出設定（含題目陣列）
      expect(request.postDataJSON()).toMatchObject({ weddingId: 'wedding-001' })
      expect(Array.isArray(request.postDataJSON().questions)).toBeTruthy()
    })
  })
})

// === Guest 端：表單依設定渲染（不需登入） ===
test.describe('賓客表單依設定渲染（Guest 端）', () => {
  test.beforeEach(async ({ page }) => {
    await resetMockData(page)
  })

  test.describe('規則：賓客表單呈現自訂題且答案隨提交送出', () => {
    test('自訂題渲染並提交', async ({ page }) => {
      // Given：管理員已設定一題自訂單行文字題
      const put = await page.request.put('/api/v1/weddings/wedding-001/rsvp-config', {
        data: {
          weddingId: 'wedding-001',
          theme: 'minimal',
          banner: null,
          questions: [
            { type: 'builtin', key: 'attending', label: '是否會出席婚禮？', enabled: true, order: 1 },
            { type: 'text', id: 'q-song', label: '想點播的歌曲？', required: false, order: 2 },
          ],
        },
      })
      expect(put.ok()).toBeTruthy()

      // When：賓客進入回覆頁，填寫自訂題並提交
      await page.goto('/rsvp/guest-001?weddingId=wedding-001', { waitUntil: 'networkidle' })
      await page.getByLabel(/想點播的歌曲/).fill('婚禮進行曲')

      // 主要 outcome：API spy 驗證 customAnswers 隨提交送出
      const apiCall = waitForApiCall(page, /\/guests\/guest-001\/rsvp(\?|$)/, 'POST')
      await page.getByRole('button', { name: /送出|提交|確定/ }).click()
      const request = await apiCall
      expect(request.postDataJSON().customAnswers).toMatchObject({ 'q-song': '婚禮進行曲' })

      // Then：使用者能感知提交成功
      await expect(getFeedbackElement(page)).toBeVisible()
    })
  })
})
