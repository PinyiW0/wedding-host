import { expect, test } from '@playwright/test'

import {
  findEntity,
  getFeedbackElement,
  login,
  resetMockData,
  selectOption,
  TestUsers,
  waitForApiCall,
} from '../helpers'

// 對應 spec/e2e-flows/07-reception.flow.md
// Feature Background（各 feature 共通）：guest-001（陳大明）已新增、
//   未報到 / 未登記禮金 / 未發放喜餅；wedding-001；cakeboxtype-001（經典禮盒）。
//
// 多角色 / 多端：
//   - Receptionist 端（接待人員，需登入 receptionist/star1122）：/reception
//     → 報到 / 登記禮金 / 更正禮金 / 發放喜餅
//   - Guest 端（公開）：/checkin?guestId=...&weddingId=...
//     → 自助報到
//
// 註：mock 喜餅款式 ID 為 cakeboxtype-001（flow 文件以 cake-type-001 示意），
//     spec 一律以 mock 實際 ID 為準。

const RECEPTION_PATH = '/reception?weddingId=wedding-001'
const WEDDING_GUEST = '/api/v1/weddings/wedding-001/guests/guest-001'
// not-found 場景：mock seed 必含 guest-001，故以不存在的 guestId 觸發 404（坑 #6）
const MISSING_GUEST = '/api/v1/weddings/wedding-001/guests/guest-999'

test.describe('接待端：報到（Receptionist）', () => {
  test.beforeEach(async ({ page }) => {
    await resetMockData(page)
    await login(page, TestUsers.receptionist.account, TestUsers.receptionist.password)
  })

  test.describe('規則：成功接待報到', () => {
    test('成功接待報到', async ({ page }) => {
      // Given：guest-001（陳大明）已新增、尚未報到
      await page.goto(RECEPTION_PATH, { waitUntil: 'networkidle' })

      // When：在 guest-001 範圍內觸發「報到」
      const apiCall = waitForApiCall(page, /\/guests\/guest-001\/check-in(\?|$)/, 'POST')
      await findEntity(page, /陳大明/).getByRole('button', { name: /報到/ }).click()
      await apiCall

      // Then：UI 反饋 + guest-001 顯示為「已報到」
      await expect(getFeedbackElement(page)).toBeVisible()
      await expect(findEntity(page, /陳大明/).getByText(/已報到/)).toBeVisible()
    })
  })

  test.describe('規則：賓客不存在', () => {
    test('賓客不存在', async ({ page }) => {
      // 性質：API 邊界保護
      const res = await page.request.post(`${MISSING_GUEST}/check-in`)
      expect(res.status()).toBe(404)
      expect(JSON.stringify(await res.json())).toContain('賓客不存在')
    })
  })

  test.describe('規則：已報到', () => {
    test('已報到', async ({ page }) => {
      // 性質：API 邊界保護（先報到一次再重複）
      await page.request.post(`${WEDDING_GUEST}/check-in`)
      const res = await page.request.post(`${WEDDING_GUEST}/check-in`)
      expect(res.status()).toBe(409)
      expect(JSON.stringify(await res.json())).toContain('賓客已報到')
    })
  })
})

test.describe('賓客端：自助報到（Guest）', () => {
  test.beforeEach(async ({ page }) => {
    await resetMockData(page)
  })

  test.describe('規則：成功自助報到', () => {
    test('成功自助報到', async ({ page }) => {
      // Given：賓客掃共用 QRCode 進入自助報到頁（帶 guestId / weddingId）
      await page.goto('/checkin?guestId=guest-001&weddingId=wedding-001', {
        waitUntil: 'networkidle',
      })

      // When：輸入姓名 → 陳大明 → 提交報到
      await page.getByLabel(/姓名/).fill('陳大明')
      const apiCall = waitForApiCall(page, /\/guests\/guest-001\/self-check-in(\?|$)/, 'POST')
      await page.getByRole('button', { name: /報到|確認|送出/ }).click()
      const request = await apiCall
      expect(request.postDataJSON()).toMatchObject({ name: '陳大明' })

      // Then：使用者能感知報到成功
      await expect(getFeedbackElement(page)).toBeVisible()
    })
  })

  test.describe('規則：賓客不存在', () => {
    test('賓客不存在', async ({ page }) => {
      // 性質：API 邊界保護
      const res = await page.request.post(`${MISSING_GUEST}/self-check-in`, {
        data: { name: '陳大明' },
      })
      expect(res.status()).toBe(404)
      expect(JSON.stringify(await res.json())).toContain('賓客不存在')
    })
  })

  test.describe('規則：已報到', () => {
    test('已報到', async ({ page }) => {
      // 性質：API 邊界保護（先自助報到一次再重複）
      await page.request.post(`${WEDDING_GUEST}/self-check-in`, { data: { name: '陳大明' } })
      const res = await page.request.post(`${WEDDING_GUEST}/self-check-in`, {
        data: { name: '陳大明' },
      })
      expect(res.status()).toBe(409)
      expect(JSON.stringify(await res.json())).toContain('賓客已報到')
    })
  })
})

test.describe('接待端：禮金登記 / 更正（Receptionist）', () => {
  test.beforeEach(async ({ page }) => {
    await resetMockData(page)
    await login(page, TestUsers.receptionist.account, TestUsers.receptionist.password)
  })

  test.describe('規則：成功登記禮金', () => {
    test('成功登記禮金', async ({ page }) => {
      // Given：guest-001 尚未登記禮金
      await page.goto(RECEPTION_PATH, { waitUntil: 'networkidle' })

      // When：在 guest-001 範圍內觸發「登記禮金」並輸入 3600
      await findEntity(page, /陳大明/).getByRole('button', { name: /登記禮金|登記/ }).click()
      await page.getByLabel(/金額|禮金/).fill('3600')

      // 主要 outcome：API spy 驗證 POST .../gift-money，payload 含 amount=3600
      const apiCall = waitForApiCall(page, /\/guests\/guest-001\/gift-money(\?|$)/, 'POST')
      await page.getByRole('button', { name: /登記|送出|確定|儲存/ }).click()
      const request = await apiCall
      expect(request.postDataJSON()).toMatchObject({ amount: 3600 })

      // Then：登記後能在 guest-001 範圍讀到禮金 3600
      await expect(getFeedbackElement(page)).toBeVisible()
      await expect(findEntity(page, /陳大明/).getByText(/3[,，]?600/)).toBeVisible()
    })
  })

  test.describe('規則：登記禮金時賓客不存在', () => {
    test('賓客不存在', async ({ page }) => {
      // 性質：API 邊界保護
      const res = await page.request.post(`${MISSING_GUEST}/gift-money`, {
        data: { amount: 3600 },
      })
      expect(res.status()).toBe(404)
      expect(JSON.stringify(await res.json())).toContain('賓客不存在')
    })
  })

  test.describe('規則：成功更正禮金', () => {
    test('成功更正禮金', async ({ page }) => {
      // Given：guest-001 已登記禮金 3600（先用 API 建立此狀態）
      await page.request.post(`${WEDDING_GUEST}/gift-money`, { data: { amount: 3600 } })
      await page.goto(RECEPTION_PATH, { waitUntil: 'networkidle' })

      // When：在 guest-001 範圍內觸發「更正禮金」並改為 6000
      await findEntity(page, /陳大明/).getByRole('button', { name: /更正|修改/ }).click()
      await page.getByLabel(/金額|禮金/).fill('6000')

      // 主要 outcome：API spy 驗證 PATCH .../gift-money，payload 含 amount=6000
      const apiCall = waitForApiCall(page, /\/guests\/guest-001\/gift-money(\?|$)/, 'PATCH')
      await page.getByRole('button', { name: /更正|送出|確定|儲存|更新/ }).click()
      const request = await apiCall
      expect(request.postDataJSON()).toMatchObject({ amount: 6000 })

      // Then：更正後能讀到新金額 6000
      await expect(getFeedbackElement(page)).toBeVisible()
      await expect(findEntity(page, /陳大明/).getByText(/6[,，]?000/)).toBeVisible()
    })
  })

  test.describe('規則：更正禮金時賓客不存在', () => {
    test('賓客不存在', async ({ page }) => {
      // 性質：API 邊界保護
      const res = await page.request.patch(`${MISSING_GUEST}/gift-money`, {
        data: { amount: 6000 },
      })
      expect(res.status()).toBe(404)
      expect(JSON.stringify(await res.json())).toContain('賓客不存在')
    })
  })

  test.describe('規則：尚未登記禮金時更正', () => {
    test('尚未登記禮金', async ({ page }) => {
      // 性質：API 邊界保護（UI 正常對未登記者只顯示「登記」而非「更正」）
      const res = await page.request.patch(`${WEDDING_GUEST}/gift-money`, {
        data: { amount: 6000 },
      })
      expect(res.status()).toBe(409)
      expect(JSON.stringify(await res.json())).toContain('尚未登記禮金')
    })
  })
})

test.describe('接待端：喜餅發放（Receptionist）', () => {
  test.beforeEach(async ({ page }) => {
    await resetMockData(page)
    await login(page, TestUsers.receptionist.account, TestUsers.receptionist.password)
  })

  test.describe('規則：成功發放喜餅', () => {
    test('成功發放喜餅', async ({ page }) => {
      // Given：guest-001 尚未領取喜餅
      await page.goto(RECEPTION_PATH, { waitUntil: 'networkidle' })

      // When：在 guest-001 範圍內觸發「發放喜餅」並選擇款式（最後選下拉，坑 #8）
      await findEntity(page, /陳大明/).getByRole('button', { name: /發放喜餅|發放/ }).click()
      await selectOption(page, 'distribute-cake-select', /經典禮盒/)

      // 主要 outcome：API spy 驗證 POST .../cake-box-distribution，payload 含 cakeBoxTypeId
      const apiCall = waitForApiCall(
        page,
        /\/guests\/guest-001\/cake-box-distribution(\?|$)/,
        'POST',
      )
      await page.getByRole('button', { name: /發放|送出|確定|完成/ }).click()
      const request = await apiCall
      expect(request.postDataJSON()).toMatchObject({ cakeBoxTypeId: 'cakeboxtype-001' })

      // Then：guest-001 顯示為「已發放」
      await expect(getFeedbackElement(page)).toBeVisible()
      await expect(findEntity(page, /陳大明/).getByText(/已發放/)).toBeVisible()
    })
  })

  test.describe('規則：發放喜餅時賓客不存在', () => {
    test('賓客不存在', async ({ page }) => {
      // 性質：API 邊界保護
      const res = await page.request.post(`${MISSING_GUEST}/cake-box-distribution`, {
        data: { cakeBoxTypeId: 'cakeboxtype-001' },
      })
      expect(res.status()).toBe(404)
      expect(JSON.stringify(await res.json())).toContain('賓客不存在')
    })
  })

  test.describe('規則：重複發放喜餅', () => {
    test('已發放喜餅', async ({ page }) => {
      // 性質：API 邊界保護（先發放一次再重複）
      await page.request.post(`${WEDDING_GUEST}/cake-box-distribution`, {
        data: { cakeBoxTypeId: 'cakeboxtype-001' },
      })
      const res = await page.request.post(`${WEDDING_GUEST}/cake-box-distribution`, {
        data: { cakeBoxTypeId: 'cakeboxtype-002' },
      })
      expect(res.status()).toBe(409)
      expect(JSON.stringify(await res.json())).toContain('喜餅已發放')
    })
  })
})
