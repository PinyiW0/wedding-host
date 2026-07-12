import { Buffer } from 'node:buffer'

import { expect, test } from '@playwright/test'

import {
  login,
  resetMockData,
  TestUsers,
  waitForApiCall,
} from '../helpers'

// 桌次規劃頁改版（issue #53）：批次新增、舞台位置反映、預設佈局、場地參考圖上傳。
// 主 spec 未凍結這些新行為，以 vibe spec 固化避免後續 vibe 誤破。

const SEATING_001 = '/weddings/wedding-001/seating'
const SEATING_002 = '/weddings/wedding-002/seating' // seed 無桌次、無場地佈局 → 觸發預設佈局

// 1x1 透明 PNG
const PNG_1PX = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
)
// 極小合法單頁 PDF（驗證 PDF 轉第一頁 PNG 流程）
const PDF_MIN = Buffer.from(`%PDF-1.1
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj
3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 100]>>endobj
trailer<</Root 1 0 R>>`)

test.beforeEach(async ({ page }) => {
  await resetMockData(page)
  await login(page, TestUsers.admin.account, TestUsers.admin.password)
})

test.describe('vibe：批次新增桌次', () => {
  test('指定數量 3 → 一次建立 3 桌，名稱加流水號、位置階梯展開', async ({ page }) => {
    // Given：進入桌次規劃頁
    await page.goto(SEATING_001, { waitUntil: 'networkidle' })

    // When：開新增桌次表單，填名稱與數量 3
    await page.getByTestId('table-create').click()
    await page.getByTestId('table-name').fill('加開桌')
    await page.getByTestId('table-capacity').fill('8')
    await page.getByTestId('table-batch-count').fill('3')
    await page.getByTestId('table-position-x').fill('60')
    await page.getByTestId('table-position-y').fill('2500')
    await page.getByTestId('table-submit').click()

    // Then：三桌各自可辨識、名稱含流水號
    for (const name of ['加開桌1', '加開桌2', '加開桌3'])
      await expect(page.getByRole('article', { name })).toBeVisible()

    // And：位置階梯展開（不疊在同一點）
    const left1 = await page.getByRole('article', { name: '加開桌1' }).evaluate(el => (el as HTMLElement).style.left)
    const left2 = await page.getByRole('article', { name: '加開桌2' }).evaluate(el => (el as HTMLElement).style.left)
    expect(left1).not.toBe(left2)
  })

  test('編輯模式不顯示數量欄位（單桌行為不變）', async ({ page }) => {
    // Given：進入桌次規劃頁
    await page.goto(SEATING_001, { waitUntil: 'networkidle' })

    // When：對既有桌次開編輯表單
    await page.getByRole('article', { name: '主桌' }).getByRole('button', { name: /編輯/ }).click()

    // Then：表單無「一次新增幾桌」欄位
    await expect(page.getByTestId('table-form-modal')).toBeVisible()
    await expect(page.getByTestId('table-batch-count')).not.toBeVisible()
  })
})

test.describe('vibe：舞台位置設定即時反映', () => {
  test('送出舞台位置與尺寸後，畫布舞台元素立即套用新值', async ({ page }) => {
    // Given：進入桌次規劃頁（seed 已有場地佈局 500,100 / 300x150）
    await page.goto(SEATING_001, { waitUntil: 'networkidle' })
    await expect(page.getByTestId('vibe-stage')).toBeVisible()

    // When：以「設定舞台位置」表單更新位置與尺寸
    await page.getByTestId('venue-layout').click()
    await page.getByTestId('stage-position-x').fill('40')
    await page.getByTestId('stage-position-y').fill('60')
    await page.getByTestId('stage-width').fill('280')
    await page.getByTestId('stage-height').fill('90')
    const apiCall = waitForApiCall(page, /\/venue-layout(\?|$)/, 'PUT')
    await page.getByTestId('venue-submit').click()
    await apiCall

    // Then：畫布上的舞台即時反映新位置與尺寸
    const stage = page.getByTestId('vibe-stage')
    await expect(stage).toHaveCSS('left', '40px')
    await expect(stage).toHaveCSS('top', '60px')
    await expect(stage).toHaveCSS('width', '280px')
    await expect(stage).toHaveCSS('height', '90px')
  })
})

test.describe('vibe：空婚禮自動帶入預設佈局', () => {
  test('無桌次且未設定舞台 → 自動出現置中舞台與五桌（每桌 10 席）', async ({ page }) => {
    // Given/When：進入沒有任何桌次的婚禮
    await page.goto(SEATING_002, { waitUntil: 'networkidle' })

    // Then：預設五桌自動建立（自動帶入需時，放寬等待）
    for (const name of ['主桌', '第一桌', '第二桌', '第三桌', '第四桌'])
      await expect(page.getByRole('article', { name })).toBeVisible({ timeout: 15_000 })

    // And：每桌 10 席、舞台（venueLayout 驅動）出現
    await expect(page.getByRole('article', { name: '主桌' }).getByText('10 席')).toBeVisible()
    await expect(page.getByTestId('vibe-stage')).toBeVisible()

    // And：重整後佈局持久存在（已寫入後端）
    await page.reload({ waitUntil: 'networkidle' })
    await expect(page.getByRole('article', { name: '第四桌' })).toBeVisible()
  })

  test('既有桌次的婚禮不重複帶入', async ({ page }) => {
    // Given/When：進入已有 15 桌的 wedding-001
    await page.goto(SEATING_001, { waitUntil: 'networkidle' })
    await expect(page.getByRole('article', { name: '主桌' })).toBeVisible()

    // Then：桌數維持 seed 的 15，不多不少
    await expect(page.locator('article')).toHaveCount(15)
  })
})

test.describe('vibe：場地參考圖上傳', () => {
  test('非 jpg/png/pdf 或超過 5MB 被拒並提示原因', async ({ page }) => {
    // Given：進入桌次規劃頁
    await page.goto(SEATING_001, { waitUntil: 'networkidle' })

    // When：上傳文字檔 → Then：格式被拒
    await page.locator('input[type=file]').setInputFiles({ name: 'x.txt', mimeType: 'text/plain', buffer: Buffer.from('hi') })
    await expect(page.getByText('格式不支援').first()).toBeVisible()

    // When：上傳 >5MB 的 PNG → Then：大小被拒
    await page.locator('input[type=file]').setInputFiles({
      name: 'big.png',
      mimeType: 'image/png',
      buffer: Buffer.alloc(5 * 1024 * 1024 + 100, 1),
    })
    await expect(page.getByText('檔案過大').first()).toBeVisible()
  })

  test('上傳 PNG → 底圖顯示、重整後仍在、可移除', async ({ page }) => {
    // Given：進入桌次規劃頁
    await page.goto(SEATING_001, { waitUntil: 'networkidle' })

    // When：上傳合法 PNG
    const putCall = waitForApiCall(page, /\/venue-layout(\?|$)/, 'PUT')
    await page.locator('input[type=file]').setInputFiles({ name: 'venue.png', mimeType: 'image/png', buffer: PNG_1PX })
    await putCall

    // Then：畫布出現參考圖底圖
    await expect(page.getByTestId('vibe-venue-ref-image')).toBeVisible()

    // And：重整後仍保留（持久化於 venue-layout）
    await page.reload({ waitUntil: 'networkidle' })
    await expect(page.getByTestId('vibe-venue-ref-image')).toBeVisible()

    // When：移除參考圖 → Then：底圖消失
    const removeCall = waitForApiCall(page, /\/venue-layout(\?|$)/, 'PUT')
    await page.getByTestId('vibe-venue-ref-remove').click()
    await removeCall
    await expect(page.getByTestId('vibe-venue-ref-image')).not.toBeVisible()
  })

  test('上傳 PDF → 轉第一頁為 PNG 後作為底圖', async ({ page }) => {
    // Given：進入桌次規劃頁
    await page.goto(SEATING_001, { waitUntil: 'networkidle' })

    // When：上傳單頁 PDF（pdfjs 動態載入轉圖，放寬等待）
    const putCall = waitForApiCall(page, /\/venue-layout(\?|$)/, 'PUT')
    await page.locator('input[type=file]').setInputFiles({ name: 'venue.pdf', mimeType: 'application/pdf', buffer: PDF_MIN })
    await putCall

    // Then：底圖顯示且來源已是 PNG 圖（轉檔成功）
    const img = page.getByTestId('vibe-venue-ref-image')
    await expect(img).toBeVisible({ timeout: 15_000 })
    await expect(img).toHaveAttribute('src', /^data:image\/png|^https?:/)
  })
})

test.describe('vibe：依參考圖帶入（AI 分析，issue #56）', () => {
  test('未設定 API key 時優雅降級：入口存在、觸發後顯示明確提示', async ({ page }) => {
    // Given：進入桌次規劃頁（尚無參考圖 → 入口不存在）
    await page.goto(SEATING_001, { waitUntil: 'networkidle' })
    await expect(page.getByTestId('vibe-venue-analyze')).not.toBeVisible()

    // When：上傳參考圖 → 入口出現
    const putCall = waitForApiCall(page, /\/venue-layout(\?|$)/, 'PUT')
    await page.locator('input[type=file]').setInputFiles({ name: 'venue.png', mimeType: 'image/png', buffer: PNG_1PX })
    await putCall
    const analyzeBtn = page.getByTestId('vibe-venue-analyze')
    await expect(analyzeBtn).toBeVisible()

    // Then：e2e 環境無 NUXT_ANTHROPIC_API_KEY → 顯示明確未設定提示（非未處理錯誤）
    await analyzeBtn.click()
    await expect(page.getByText(/尚未設定 AI 分析功能/).first()).toBeVisible()
  })

  test('無參考圖的婚禮直打 analyze 端點回 4xx／501（邊界保護）', async ({ page }) => {
    const res = await page.request.post('/api/v1/weddings/wedding-003/venue-layout/analyze')
    expect([400, 501]).toContain(res.status())
  })
})
