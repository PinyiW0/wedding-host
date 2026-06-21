import { Buffer } from 'node:buffer'

import { expect, test } from '@playwright/test'

import {
  findEntity,
  getFeedbackElement,
  login,
  maybeConfirm,
  resetMockData,
  TestUsers,
  waitForApiCall,
} from '../helpers'

// 對應 spec/e2e-flows/03-guests.flow.md（賓客 CRUD + 軟刪 / 恢復 + 批次匯入 + LINE 綁定）
// Feature Background：
//   - 賓客 CRUD / 匯入：已登入為管理員（Admin）；wedding-001 已選定
//   - LINE 綁定：賓客（Guest）端透過專屬連結操作，不需登入
// mock seed（全集，皆屬 wedding-001）：
//   guest-001(陳大明/男方/葷食/同事/未綁定 LINE) ... guest-012，
//   其中 guest-003 已綁定 LINE（line-u-003）

// === Admin 端：賓客 CRUD + 匯入（需登入） ===
test.describe('賓客名單（Admin 端）', () => {
  test.beforeEach(async ({ page }) => {
    await resetMockData(page)
    await login(page, TestUsers.admin.account, TestUsers.admin.password)
  })

  test.describe('規則：成功新增賓客', () => {
    test('成功新增賓客', async ({ page }) => {
      // Given：進入賓客名單頁
      await page.goto('/weddings/wedding-001/guests', { waitUntil: 'networkidle' })

      // When：觸發新增並填寫表單
      await page.getByRole('button', { name: /新增賓客|新增/ }).click()
      await page.getByLabel(/姓名|名稱/).fill('陳大明')
      // 男女方 → 男方（groom）
      await page.getByRole('button', { name: /^男方$/ }).click()
      // 飲食 → 葷食（meat）
      await page.getByRole('button', { name: /^葷食$/ }).click()
      await page.getByLabel(/分類/).fill('同事')
      await page.getByLabel(/聯絡方式|電話|聯絡/).fill('0912345678')
      await page.getByLabel(/備註/).fill('需要靠近舞台')

      // 主要 outcome：API spy 驗證 POST .../guests，payload 含核心欄位
      const apiCall = waitForApiCall(page, /\/guests(\?|$)/, 'POST')
      await page.getByRole('button', { name: /新增|建立|送出|確定/ }).click()
      const request = await apiCall
      expect(request.postDataJSON()).toMatchObject({
        name: '陳大明',
        side: 'groom',
        diet: 'meat',
        category: '同事',
        contact: '0912345678',
        needChildSeat: false,
        notes: '需要靠近舞台',
      })

      // Then：列表新增可識別的「陳大明」實體，且能讀到 side / category
      const entity = findEntity(page, /陳大明/)
      await expect(entity).toBeVisible()
      await expect(entity.getByText(/男方/)).toBeVisible()
      await expect(entity.getByText(/同事/)).toBeVisible()
    })
  })

  test.describe('規則：成功更新賓客', () => {
    test('成功更新賓客', async ({ page }) => {
      // Given：guest-001（陳大明）已存在
      await page.goto('/weddings/wedding-001/guests', { waitUntil: 'networkidle' })

      // When：在 guest-001 範圍觸發編輯並修改欄位
      await findEntity(page, /陳大明/).getByRole('button', { name: /編輯/ }).click()
      await page.getByRole('button', { name: /^素食$/ }).click()
      await page.getByRole('button', { name: /^女方$/ }).click()
      await page.getByLabel(/分類/).fill('朋友')
      await page.getByLabel(/聯絡方式|電話|聯絡/).fill('0987654321')
      await page.getByLabel(/備註/).fill('改為素食')

      // 主要 outcome：API spy 驗證 PATCH .../guests/guest-001
      const apiCall = waitForApiCall(page, /\/guests\/guest-001(\?|$)/, 'PATCH')
      await page.getByRole('button', { name: /儲存|更新|送出|確定/ }).click()
      const request = await apiCall
      expect(request.postDataJSON()).toMatchObject({
        diet: 'vegetarian',
        side: 'bride',
        category: '朋友',
        contact: '0987654321',
        notes: '改為素食',
      })

      // Then：更新後能讀到新分類「朋友」
      await expect(findEntity(page, /陳大明/).getByText(/朋友/)).toBeVisible()
    })
  })

  test.describe('規則：更新不存在的賓客', () => {
    test('賓客不存在', async ({ page }) => {
      // 性質：API 邊界保護（UI 正常只對既有賓客顯示編輯動作）
      const res = await page.request.patch(
        '/api/v1/weddings/wedding-001/guests/guest-999',
        { data: { category: '不存在' } },
      )
      expect(res.status()).toBe(404)
      expect(JSON.stringify(await res.json())).toContain('賓客不存在')
    })
  })

  test.describe('規則：成功移除賓客', () => {
    test('成功移除賓客', async ({ page }) => {
      // Given：guest-001（陳大明）已存在、未移除
      await page.goto('/weddings/wedding-001/guests', { waitUntil: 'networkidle' })

      // When：在 guest-001 範圍觸發移除並完成確認
      const apiCall = waitForApiCall(page, /\/guests\/guest-001(\?|$)/, 'DELETE')
      await findEntity(page, /陳大明/).getByRole('button', { name: /移除|刪除/ }).click()
      await maybeConfirm(page)

      // Then：軟刪端點被呼叫，陳大明不在預設清單
      await apiCall
      await expect(getFeedbackElement(page)).toBeVisible()
      await expect(findEntity(page, /陳大明/)).not.toBeVisible()
    })
  })

  test.describe('規則：移除不存在的賓客', () => {
    test('賓客不存在', async ({ page }) => {
      // 性質：API 邊界保護
      const res = await page.request.delete(
        '/api/v1/weddings/wedding-001/guests/guest-999',
      )
      expect(res.status()).toBe(404)
      expect(JSON.stringify(await res.json())).toContain('賓客不存在')
    })
  })

  test.describe('規則：重複移除賓客', () => {
    test('賓客已移除', async ({ page }) => {
      // 性質：API 邊界保護
      // Given：先軟刪除 guest-001
      const first = await page.request.delete(
        '/api/v1/weddings/wedding-001/guests/guest-001',
      )
      expect(first.ok()).toBeTruthy()

      // When：再次移除已移除的 guest-001
      const res = await page.request.delete(
        '/api/v1/weddings/wedding-001/guests/guest-001',
      )
      expect(res.status()).toBe(409)
      expect(JSON.stringify(await res.json())).toContain('賓客已移除')
    })
  })

  test.describe('規則：成功恢復賓客', () => {
    test('成功恢復賓客', async ({ page }) => {
      // Given：guest-001 已新增且已移除
      await page.request.delete('/api/v1/weddings/wedding-001/guests/guest-001')
      await page.goto('/weddings/wedding-001/guests', { waitUntil: 'networkidle' })

      // When：在已移除的 guest-001 範圍觸發恢復
      const apiCall = waitForApiCall(
        page,
        /\/guests\/guest-001\/restore(\?|$)/,
        'POST',
      )
      await findEntity(page, /陳大明/).getByRole('button', { name: /恢復/ }).click()
      await maybeConfirm(page)

      // Then：restore 端點被呼叫，陳大明重新出現於預設清單
      await apiCall
      await expect(getFeedbackElement(page)).toBeVisible()
    })
  })

  test.describe('規則：恢復不存在的賓客', () => {
    test('賓客不存在', async ({ page }) => {
      // 性質：API 邊界保護
      const res = await page.request.post(
        '/api/v1/weddings/wedding-001/guests/guest-999/restore',
      )
      expect(res.status()).toBe(404)
      expect(JSON.stringify(await res.json())).toContain('賓客不存在')
    })
  })

  test.describe('規則：恢復未被移除的賓客', () => {
    test('賓客未被移除', async ({ page }) => {
      // 性質：API 邊界保護（guest-001 為未移除狀態）
      const res = await page.request.post(
        '/api/v1/weddings/wedding-001/guests/guest-001/restore',
      )
      expect(res.status()).toBe(409)
      expect(JSON.stringify(await res.json())).toContain('賓客未被移除')
    })
  })

  test.describe('規則：成功批次匯入賓客', () => {
    test('成功批次匯入賓客', async ({ page }) => {
      // Given：進入賓客名單頁
      await page.goto('/weddings/wedding-001/guests', { waitUntil: 'networkidle' })

      // When：觸發批次匯入並選擇合法 .xlsx
      await page.getByRole('button', { name: /批次匯入|匯入/ }).click()
      await page
        .getByTestId('file-upload-input')
        .setInputFiles({
          name: 'guests-2026.xlsx',
          mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          buffer: Buffer.from('mock xlsx content'),
        })

      // 主要 outcome：API spy 驗證 POST .../guests/import，payload 含 fileName
      const apiCall = waitForApiCall(page, /\/guests\/import(\?|$)/, 'POST')
      await page.getByRole('button', { name: /開始匯入|匯入|送出|確定/ }).click()
      const request = await apiCall
      expect(request.postDataJSON()).toMatchObject({
        fileName: 'guests-2026.xlsx',
      })

      // Then：使用者能感知匯入結果（含匯入筆數 25）
      await expect(page.getByText(/25/).first()).toBeVisible()
    })
  })

  test.describe('規則：匯入檔案格式不正確', () => {
    test('檔案格式不正確', async ({ page }) => {
      // Given：進入批次匯入入口
      await page.goto('/weddings/wedding-001/guests', { waitUntil: 'networkidle' })
      await page.getByRole('button', { name: /批次匯入|匯入/ }).click()

      // When：選擇非 Excel 檔（guests.pdf）並嘗試匯入
      await page
        .getByTestId('file-upload-input')
        .setInputFiles({
          name: 'guests.pdf',
          mimeType: 'application/pdf',
          buffer: Buffer.from('mock pdf content'),
        })
      await page.getByRole('button', { name: /開始匯入|匯入|送出|確定/ }).click()

      // Then：使用者能看到格式錯誤訊息（API 合約文字）
      await expect(
        page.getByText('檔案格式不正確，僅支援 .xlsx 或 .xls 格式'),
      ).toBeVisible()
    })
  })
})

// === Guest 端：LINE 綁定（不需登入，公開專屬連結） ===
test.describe('賓客 LINE 綁定（Guest 端）', () => {
  test.beforeEach(async ({ page }) => {
    await resetMockData(page)
  })

  test.describe('規則：成功綁定 LINE', () => {
    test('成功綁定 LINE', async ({ page }) => {
      // Given：guest-001 已新增、尚未綁定 LINE（seed 即為未綁定）
      // 進入賓客專屬綁定頁（帶 weddingId 情境）
      await page.goto('/guest/guest-001/bind?weddingId=wedding-001', {
        waitUntil: 'networkidle',
      })

      // When：觸發 LINE 綁定（模擬完成 LINE 授權回傳 lineUserId）
      const apiCall = waitForApiCall(
        page,
        /\/guests\/guest-001\/line-binding(\?|$)/,
        'POST',
      )
      await page.getByRole('button', { name: /綁定|連結 LINE|LINE/ }).click()
      const request = await apiCall
      expect(request.postDataJSON()).toMatchObject({
        lineUserId: expect.any(String),
      })

      // Then：使用者能感知綁定成功
      await expect(getFeedbackElement(page)).toBeVisible()
    })
  })

  test.describe('規則：綁定不存在的賓客', () => {
    test('賓客不存在', async ({ page }) => {
      // 性質：API 邊界保護
      const res = await page.request.post(
        '/api/v1/weddings/wedding-001/guests/guest-999/line-binding',
        { data: { lineUserId: 'line-u-test' } },
      )
      expect(res.status()).toBe(404)
      expect(JSON.stringify(await res.json())).toContain('賓客不存在')
    })
  })

  test.describe('規則：重複綁定 LINE', () => {
    test('已綁定 LINE', async ({ page }) => {
      // 性質：API 邊界保護
      // Given：先讓 guest-001 綁定 LINE（seed 為未綁定，先建立已綁定狀態）
      const first = await page.request.post(
        '/api/v1/weddings/wedding-001/guests/guest-001/line-binding',
        { data: { lineUserId: 'line-u-first' } },
      )
      expect(first.ok()).toBeTruthy()

      // When：再以新 lineUserId 綁定已綁定的 guest-001
      const res = await page.request.post(
        '/api/v1/weddings/wedding-001/guests/guest-001/line-binding',
        { data: { lineUserId: 'line-u-second' } },
      )
      expect(res.status()).toBe(409)
      expect(JSON.stringify(await res.json())).toContain('已綁定 LINE')
    })
  })
})
