import { expect, test } from '@playwright/test'
import { login, resetMockData, TestUsers } from '../helpers'

test.setTimeout(60000)

test('RSVP 回覆可獨立隱藏指定賓客花朵，保留下載與重新回覆後的隱藏設定', async ({ page }) => {
  await resetMockData(page)
  await login(page, TestUsers.admin.account, TestUsers.admin.password)
  const created = await page.request.post('/api/v1/weddings', { data: { title: '花朵開關測試', venue: '測試', address: '測試', date: '2027-01-01' } })
  expect(created.ok()).toBeTruthy()
  const { weddingId } = await created.json()
  const base = `/api/v1/weddings/${weddingId}`
  try {
    const ids: string[] = []
    const drawing = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII='
    const rsvp = { attending: 'attending', diet: 'meat', plusOneCount: 0, childChairCount: 0, flowerDrawing: drawing }
    for (const name of ['測試花朵甲', '測試花朵乙']) {
      const guest = await (await page.request.post(`${base}/guests`, { data: { name, side: 'groom', diet: 'meat', category: '', contact: '' } })).json()
      ids.push(guest.guestId)
      expect((await page.request.post(`${base}/guests/${guest.guestId}/rsvp`, { data: rsvp })).ok()).toBeTruthy()
    }
    const guestUrl = `${base}/guests/${ids[0]}`
    await page.goto(`/weddings/${weddingId}/rsvp`, { waitUntil: 'networkidle' })
    await page.getByRole('button', { name: '查看 測試花朵甲 的回覆' }).click()
    const toggle = page.getByTestId('rsvp-flower-visible')
    await expect(toggle).toBeChecked()
    const saved = page.waitForResponse(r => r.url().endsWith(`/guests/${ids[0]}`) && r.request().method() === 'PATCH')
    await toggle.click()
    expect((await saved).ok()).toBeTruthy()
    await expect(toggle).not.toBeChecked()
    await expect(page.getByTestId('rsvp-flower-download')).toBeVisible()
    await page.reload({ waitUntil: 'networkidle' })
    await page.getByRole('button', { name: '查看 測試花朵甲 的回覆' }).click()
    await expect(toggle).not.toBeChecked()
    expect((await (await page.request.get(`${base}/flowers`)).json()).map((f: { guestId: string }) => f.guestId)).toEqual([ids[1]])
    expect((await page.request.post(`${guestUrl}/rsvp`, { data: { ...rsvp, flowerVisible: true } })).ok()).toBeTruthy()
    expect((await (await page.request.get(`${base}/flowers`)).json())).toHaveLength(1)
    const guests = await (await page.request.get(`${base}/guests?fields=full`)).json()
    expect(guests.find((g: { guestId: string }) => g.guestId === ids[0]).flowerDrawing).toBe(drawing)
    expect((await page.request.patch(guestUrl, { data: { flowerVisible: 'false' } })).status()).toBe(400)
    expect((await page.request.patch(`/api/v1/weddings/wedding-001/guests/${ids[0]}`, { data: { flowerVisible: false } })).status()).toBe(404)
    const restored = page.waitForResponse(r => r.url().endsWith(`/guests/${ids[0]}`) && r.request().method() === 'PATCH')
    await toggle.click()
    expect((await restored).ok()).toBeTruthy()
    expect(await (await page.request.get(`${base}/flowers`)).json()).toHaveLength(2)
  }
  finally {
    await page.request.delete(base)
  }
})

// issue #194：故事頁賓客花像半個花圈沿著花田長——1024px 以上是上方的弧＋花田左右兩叢（三區上緣對齊，左上右上不空），
// 窄螢幕只有上方那道弧（同樣降到三朵花兩側）；區域高度固定，花多才互疊，但不小於 44px、每朵中心點得到自己、不溢出畫面；
// 空白畫布略過；上層的花不能擋住新人那三朵花
for (const width of [375, 1440]) {
  test(`大量花朵散落固定區域、中心點得到且不溢出（${width}px）`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    const blank = await page.evaluate(() => {
      const canvas = document.createElement('canvas')
      canvas.width = 120
      canvas.height = 120
      return canvas.toDataURL('image/png')
    })
    const flowers = Array.from({ length: 40 }, (_, i) => ({ guestId: `flower-${i}`, name: `花朵${i}`, flowerDrawing: '/images/invite/flower-single.webp' }))
    flowers.push({ guestId: 'flower-blank', name: '空白', flowerDrawing: blank })
    await page.route('**/api/v1/weddings/wedding-2cf97d94/flowers*', route => route.fulfill({ json: flowers }))
    await page.goto('/story/wedding-2cf97d94', { waitUntil: 'networkidle' })
    const fields = page.getByTestId('flower-field')
    await expect(fields.locator('img')).toHaveCount(40)
    await expect(page.getByTestId('flower-flower-blank')).toHaveCount(0)
    await expect(fields).toHaveCount(width >= 1024 ? 3 : 1)
    const tops = await fields.evaluateAll(els => els.map(el => Math.round(el.getBoundingClientRect().top + window.scrollY)))
    // 區域高度固定（不隨花數長高）；桌機三區上緣對齊
    expect((await fields.first().boundingBox())!.height).toBeLessThanOrEqual(280)
    for (const top of tops)
      expect(Math.abs(top - tops[0]!)).toBeLessThanOrEqual(2)
    // 新人的三朵花仍點得到（上方那層花蓋在它們上面）
    for (const i of [1, 2, 3]) {
      const button = page.getByRole('button', { name: `第 ${i} 朵祝福小花` })
      // 三朵花是 lazy 載入，圖沒到之前按鈕高度是 0，先等圖載完
      await button.scrollIntoViewIfNeeded()
      await expect.poll(() => button.locator('img').evaluate(img => (img as HTMLImageElement).naturalWidth)).toBeGreaterThan(0)
      expect(await button.evaluate((el) => {
        // 頁面是平滑捲動，要瞬間捲到位再量，否則量到的是捲動途中的位置
        el.scrollIntoView({ block: 'center', behavior: 'instant' })
        const r = el.getBoundingClientRect()
        return el.contains(document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2))
      })).toBe(true)
    }
    // 等待入場動畫完成後，在搖曳期間檢查
    await page.waitForTimeout(3000)
    const result = await fields.locator('figure').evaluateAll(elements => elements.map((el) => {
      el.scrollIntoView({ block: 'center', behavior: 'instant' })
      const img = el.querySelector('img')!.getBoundingClientRect()
      const box = el.getBoundingClientRect()
      const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2)
      return { left: img.left, right: img.right, width: box.width, hitsSelf: hit?.closest('figure') === el }
    }))
    for (const flower of result) {
      expect(flower.left).toBeGreaterThanOrEqual(0)
      expect(flower.right).toBeLessThanOrEqual(width)
      expect(flower.width).toBeGreaterThanOrEqual(44)
      expect(flower.hitsSelf).toBe(true)
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
  })
}
