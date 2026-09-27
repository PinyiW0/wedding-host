import { expect, test } from '@playwright/test'
import { login, resetMockData, TestUsers } from '../helpers'

for (const width of [390, 980, 1280]) {
  test(`桌次畫布與待排名單不重疊，寬度 ${width}`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 844 })
    await resetMockData(page)
    await login(page, TestUsers.admin.account, TestUsers.admin.password)
    await page.goto('/weddings/wedding-001/seating', { waitUntil: 'networkidle' })
    const floor = page.getByTestId('seating-floor-plan')
    const sidebar = page.getByTestId('seating-guest-sidebar')
    await expect(floor).toBeVisible()
    const box = (await floor.boundingBox())!
    const listBox = (await sidebar.boundingBox())!
    expect(box.height).toBeGreaterThanOrEqual(320)
    expect(box.width).toBeGreaterThan(250)
    if (width < 1024) {
      expect(listBox.y).toBeGreaterThanOrEqual(box.y + box.height)
      expect(box.x + box.width).toBeLessThanOrEqual(width)
      const mainTable = (await page.getByTestId('table-row-table-001').boundingBox())!
      expect(mainTable.x).toBeGreaterThanOrEqual(box.x)
      expect(mainTable.x + mainTable.width).toBeLessThanOrEqual(box.x + box.width)
      expect(mainTable.y).toBeGreaterThanOrEqual(box.y)
      expect(mainTable.y + mainTable.height).toBeLessThanOrEqual(box.y + box.height)
    }
    else {
      expect(listBox.x).toBeGreaterThanOrEqual(box.x + box.width)
    }
    await floor.scrollIntoViewIfNeeded()
    await page.screenshot({ path: testInfo.outputPath('seating-responsive.png') })
    // 場地大於容器時仍可捲動到遠處桌位，不把整頁撐寬。
    const scroll = await floor.evaluate((el) => {
      el.scrollLeft = el.scrollWidth
      el.scrollTop = el.scrollHeight
      return { x: el.scrollLeft, y: el.scrollTop, maxX: el.scrollWidth - el.clientWidth, maxY: el.scrollHeight - el.clientHeight }
    })
    expect(scroll.x).toBe(scroll.maxX)
    expect(scroll.y).toBe(scroll.maxY)
  })
}
