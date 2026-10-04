import { expect, test } from '@playwright/test'
import { login, TestUsers } from '../helpers'

test.setTimeout(60000)

test('RSVP 回覆可獨立隱藏指定賓客花朵，保留下載與重新回覆後的隱藏設定', async ({ page }) => {
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

for (const width of [375, 1440]) {
  test(`大量花朵不互相遮擋或溢出（${width}px）`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await page.route('**/api/v1/weddings/wedding-001/flowers*', route => route.fulfill({ json: Array.from({ length: 40 }, (_, i) => ({ guestId: `flower-${i}`, name: `花朵${i}`, flowerDrawing: '/images/invite/flower-single.webp' })) }))
    await page.goto('/story/wedding-001', { waitUntil: 'networkidle' })
    const flowers = page.getByTestId('flower-field').locator('img')
    await expect(flowers).toHaveCount(40)
    // 等待入場動畫完成後，在搖曳期間確認圖片實際外框互不相交。
    await page.waitForTimeout(5000)
    const boxes = await flowers.evaluateAll(elements => elements.map((el) => {
      const { left, top, right, bottom } = el.getBoundingClientRect()
      return { left, top, right, bottom }
    }))
    for (let i = 0; i < boxes.length; i++) {
      expect(boxes[i]!.left).toBeGreaterThanOrEqual(0)
      expect(boxes[i]!.right).toBeLessThanOrEqual(width)
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i]!
        const b = boxes[j]!
        expect(a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top).toBe(true)
      }
    }
  })
}
