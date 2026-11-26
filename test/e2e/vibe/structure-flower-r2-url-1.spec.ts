// Source: app/components/FlowerField.vue、app/utils/trimTransparent.ts、app/pages/projection/[weddingId].vue（issue #226）
// Pattern: 結構（花圖來源從 dataURL 換成跨來源網址後，顯示與裁切不變）
//
// 花圖搬到 R2 之後，欄位裡是另一個網域的網址。故事頁花圈要讀像素裁掉畫布空白，
// 跨來源圖片沒帶許可標頭就讀不到像素、花會小到看不見。這支用假的圖片主機模擬 R2：只有帶 Origin 的請求才回許可標頭。

import type { Page } from '@playwright/test'

import { Buffer } from 'node:buffer'
import { expect, test } from '@playwright/test'

import { resetMockData } from '../helpers'

const STORY_WEDDING_ID = 'wedding-2cf97d94'
const IMAGE_HOST = 'https://r2.example.test'
const FLOWER_COUNT = 3
const CANVAS = 120
const DRAWN = 30

// 120×120 的透明畫布，只在左上角畫 30×30——賓客「整張畫布只畫一小角」的情況
async function drawCornerFlower(page: Page): Promise<string> {
  return page.evaluate(({ canvasSize, drawn }) => {
    const canvas = document.createElement('canvas')
    canvas.width = canvasSize
    canvas.height = canvasSize
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#c0392b'
    ctx.fillRect(4, 4, drawn, drawn)
    return canvas.toDataURL('image/png')
  }, { canvasSize: CANVAS, drawn: DRAWN })
}

// 模擬 R2 公開網址：跟 R2 一樣，只有請求帶 Origin 才回 Access-Control-Allow-Origin
async function mockImageHost(page: Page, png: Buffer, seen: { url: string, origin: string | undefined }[]) {
  await page.route(`${IMAGE_HOST}/**`, async (route) => {
    const origin = route.request().headers().origin
    seen.push({ url: route.request().url(), origin })
    await route.fulfill({
      body: png,
      contentType: 'image/png',
      headers: origin ? { 'access-control-allow-origin': origin } : {},
    })
  })
}

// 花圈裡每朵花最後顯示的圖：裁過的是 dataURL，量它的原始尺寸
async function trimmedSizes(page: Page): Promise<{ w: number, h: number }[]> {
  const imgs = page.getByTestId('flower-field').locator('img')
  await expect(imgs).toHaveCount(FLOWER_COUNT)
  // 花圈在頁面很下面且圖是 lazy 載入：先捲到位，圖才會載
  await page.getByTestId('flower-field').first().scrollIntoViewIfNeeded()
  await expect.poll(async () => imgs.evaluateAll(els => els.every((el) => {
    const img = el as HTMLImageElement
    return img.src.startsWith('data:') && img.naturalWidth > 0
  })), { message: '每朵花都應換成裁過的圖' }).toBe(true)
  return imgs.evaluateAll(els => els.map((el) => {
    const img = el as HTMLImageElement
    return { w: img.naturalWidth, h: img.naturalHeight }
  }))
}

test.describe('花圖是 R2 網址時的顯示與裁切', () => {
  test('故事頁花圈：網址形式的花圖裁掉空白後，大小與 dataURL 時一致', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 900 })
    const dataUrl = await drawCornerFlower(page)
    const png = Buffer.from(dataUrl.split(',')[1]!, 'base64')
    let expected: { w: number, h: number }[] = []

    await test.step('花圖是 dataURL（本機現況）：裁掉空白', async () => {
      const flowers = Array.from({ length: FLOWER_COUNT }, (_, i) => ({ guestId: `g-${i}`, name: `賓客${i}`, flowerDrawing: dataUrl }))
      await page.route(`**/api/v1/weddings/${STORY_WEDDING_ID}/flowers*`, route => route.fulfill({ json: flowers }))
      await page.goto(`/story/${STORY_WEDDING_ID}`, { waitUntil: 'networkidle' })
      expected = await trimmedSizes(page)
      for (const size of expected) {
        expect(size.w, '裁過的圖應比原畫布小').toBeLessThan(CANVAS)
        expect(size.w).toBeGreaterThanOrEqual(DRAWN)
      }
    })

    await test.step('花圖是 R2 網址：裁出一樣大的圖', async () => {
      const seen: { url: string, origin: string | undefined }[] = []
      await mockImageHost(page, png, seen)
      const flowers = Array.from({ length: FLOWER_COUNT }, (_, i) => ({ guestId: `g-${i}`, name: `賓客${i}`, flowerDrawing: `${IMAGE_HOST}/weddings/w/flower/${i}.png` }))
      await page.unroute(`**/api/v1/weddings/${STORY_WEDDING_ID}/flowers*`)
      await page.route(`**/api/v1/weddings/${STORY_WEDDING_ID}/flowers*`, route => route.fulfill({ json: flowers }))
      await page.goto(`/story/${STORY_WEDDING_ID}`, { waitUntil: 'networkidle' })

      expect(await trimmedSizes(page)).toEqual(expected)
      // 讀像素那一次請求要帶 Origin，而且用另一個網址（不跟 <img> 共用瀏覽器快取）
      const corsLoads = seen.filter(r => r.origin && r.url.includes('cors=1'))
      expect(corsLoads.length).toBeGreaterThanOrEqual(FLOWER_COUNT)
    })
  })

  test('祝福花田與投影頁：網址形式的花圖載得出來', async ({ page }) => {
    // 這兩頁由伺服器先取資料，瀏覽器端攔不到 API：改在資料庫放 60 朵網址形式的花（seed-scale 的網址主機就是 IMAGE_HOST）
    await resetMockData(page)
    expect((await page.request.post('/api/__test__/seed-scale?flowers=url')).ok()).toBe(true)
    const dataUrl = await drawCornerFlower(page)
    await mockImageHost(page, Buffer.from(dataUrl.split(',')[1]!, 'base64'), [])
    const SAMPLE = 3

    async function expectUrlFlowersLoaded() {
      const imgs = page.locator(`img[src^="${IMAGE_HOST}/"]`)
      await expect.poll(() => imgs.count(), { message: '頁面上應有網址形式的花圖' }).toBeGreaterThanOrEqual(SAMPLE)
      for (let i = 0; i < SAMPLE; i++) {
        const img = imgs.nth(i)
        await img.scrollIntoViewIfNeeded()
        await expect.poll(() => img.evaluate(el => (el as HTMLImageElement).naturalWidth)).toBe(CANVAS)
      }
    }

    await test.step('祝福花田', async () => {
      await page.goto('/flowers/wedding-001', { waitUntil: 'networkidle' })
      await expect(page.getByTestId('flower-field')).toBeVisible()
      await expectUrlFlowersLoaded()
    })

    await test.step('投影頁', async () => {
      await page.goto('/projection/wedding-001')
      await expect(page.getByTestId('projection-page')).toBeVisible()
      await expectUrlFlowersLoaded()
    })
  })
})
