// Source: app/composables/useSeatingChartExport.ts + app/pages/weddings/[weddingId]/seating.vue（下載桌次圖，issue #101）
// Pattern: menu（互動：下拉兩組——備餐地圖 / 賓客名單，各含 JPEG / PDF；賓客名單另有 Excel，issue #194）+ 下載事件
// 新增「賓客名單」版本（圈內列賓客姓名）不取代既有「備餐地圖」版本；此處驗證兩組並存且名單版可觸發下載
// issue #219：圈內桌名 6 字以內不截「…」，放不下改排兩行、同一張圖兩行桌名字級一致（攔 canvas fillText 讀出畫了什麼）

import type { Page } from '@playwright/test'

import { expect, test } from '@playwright/test'
import ExcelJS from 'exceljs'

import { login, resetMockData, TestUsers } from '../helpers'

const SEATING_URL = '/weddings/wedding-001/seating'

interface DrawnText { text: string, font: string }

// 記下 canvas 每一次 fillText 的文字與字型；要在頁面載入前掛上，所以掛完要重新載入
async function recordCanvasText(page: Page) {
  await page.addInitScript(() => {
    const drawn: { text: string, font: string }[] = []
    Object.assign(window, { __drawn: drawn })
    const original = CanvasRenderingContext2D.prototype.fillText
    CanvasRenderingContext2D.prototype.fillText = function (this: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth?: number) {
      drawn.push({ text, font: this.font })
      if (maxWidth === undefined)
        original.call(this, text, x, y)
      else
        original.call(this, text, x, y, maxWidth)
    }
  })
  await page.reload({ waitUntil: 'networkidle' })
}

async function takeDrawn(page: Page): Promise<DrawnText[]> {
  return page.evaluate(() => (window as unknown as { __drawn: DrawnText[] }).__drawn.splice(0))
}

test.beforeEach(async ({ page }) => {
  await resetMockData(page)
  await login(page, TestUsers.admin.account, TestUsers.admin.password)
  await page.goto(SEATING_URL, { waitUntil: 'networkidle' })
})

test.describe('vibe：下載桌次圖（備餐地圖 + 賓客名單兩版本）', () => {
  test('下拉同時提供備餐地圖與賓客名單兩組', async ({ page }) => {
    await page.getByTestId('vibe-seating-download').click()
    await expect(page.getByRole('menuitem', { name: '備餐地圖 · JPEG' })).toBeVisible()
    await expect(page.getByRole('menuitem', { name: '備餐地圖 · PDF' })).toBeVisible()
    await expect(page.getByRole('menuitem', { name: '賓客名單 · JPEG' })).toBeVisible()
    await expect(page.getByRole('menuitem', { name: '賓客名單 · PDF' })).toBeVisible()
    await expect(page.getByRole('menuitem', { name: '賓客名單 · Excel' })).toBeVisible()
  })

  test('選「賓客名單 · JPEG」觸發桌位示意圖下載', async ({ page }) => {
    await page.getByTestId('vibe-seating-download').click()
    const download = page.waitForEvent('download')
    await page.getByRole('menuitem', { name: '賓客名單 · JPEG' }).click()
    const file = await download
    expect(file.suggestedFilename()).toContain('桌位示意圖')
  })

  test('選「賓客名單 · Excel」下載名單表格＋桌位示意圖，依桌號排序、拆桌與未排桌標示清楚', async ({ page }) => {
    const base = '/api/v1/weddings/wedding-001'
    async function addGuest(name: string, partySize: number) {
      const res = await page.request.post(`${base}/guests`, {
        data: { name, side: 'bride', diet: 'vegetarian', partySize, childChairCount: 0, category: '', contact: '' },
      })
      expect(res.ok()).toBe(true)
      return (await res.json()).guestId as string
    }
    async function seat(tableId: string, guestId: string) {
      const res = await page.request.post(`${base}/tables/${tableId}/seats`, { data: { guestId, seatNumber: 1, allowPartial: true } })
      expect(res.ok()).toBe(true)
    }
    // 第4桌一組 2 人；男方家屬桌一組 3 人；12 人那組拆進 10 人的第5桌、餘 2 位未排；另一組完全未排
    await seat('table-004', await addGuest('名單第四桌', 2))
    await seat('table-002', await addGuest('名單男方桌', 3))
    await seat('table-005', await addGuest('名單拆桌', 12))
    await addGuest('名單未排桌', 2)
    await page.reload({ waitUntil: 'networkidle' })

    await page.getByTestId('vibe-seating-download').click()
    const download = page.waitForEvent('download')
    await page.getByRole('menuitem', { name: '賓客名單 · Excel' }).click()
    const file = await download
    expect(file.suggestedFilename()).toBe('賓客名單-wedding-001.xlsx')

    const book = new ExcelJS.Workbook()
    await book.xlsx.readFile(await file.path())
    expect(book.worksheets.map(w => w.name)).toEqual(['賓客名單', '桌位示意圖'])

    const list = book.getWorksheet('賓客名單')!
    expect(list.getRow(1).values).toEqual([undefined, '桌號', '桌名', '姓名', '同行人數', '葷素', '兒童椅', '備註'])
    const rows: (string | number)[][] = []
    list.eachRow((row, n) => {
      if (n > 1)
        rows.push((row.values as (string | number)[]).slice(1))
    })
    // 已排桌的列在前、桌號遞增；未排桌的全在最後
    const seated = rows.filter(r => r[1] !== '未排桌')
    const unseated = rows.slice(seated.length)
    expect(unseated.every(r => r[1] === '未排桌')).toBe(true)
    for (let i = 1; i < seated.length; i++)
      expect(Number(seated[i]![0])).toBeGreaterThan(Number(seated[i - 1]![0]) - 1)
    const byName = (name: string) => rows.filter(r => r[2] === name)
    expect(byName('名單第四桌')).toEqual([[expect.any(Number), '第4桌', '名單第四桌', 2, '素食', 0, '']])
    expect(byName('名單男方桌')[0]!.slice(1, 4)).toEqual(['男方家屬桌', '名單男方桌', 3])
    // 拆桌：第5桌坐 10 位並註明，剩下 2 位列在未排桌
    expect(byName('名單拆桌')).toEqual([
      [expect.any(Number), '第5桌', '名單拆桌', 10, '素食', 0, '拆桌：本桌 10 位／共 12 位'],
      ['', '未排桌', '名單拆桌', 2, '素食', 0, '部分已入座：尚有 2 位未排'],
    ])
    expect(byName('名單未排桌')).toEqual([['', '未排桌', '名單未排桌', 2, '素食', 0, '']])

    expect(book.getWorksheet('桌位示意圖')!.getImages()).toHaveLength(1)
  })

  test('長桌名在備餐地圖與賓客名單場地圖都完整畫出，不截「…」、長桌名字級一致', async ({ page }) => {
    const longNames: Record<string, string> = {
      'table-004': '你懂 AI 嗎',
      'table-005': '叫我乾爸爸',
      'table-006': '天天有錢賺啦',
    }
    for (const [tableId, tableName] of Object.entries(longNames)) {
      const res = await page.request.patch(`/api/v1/weddings/wedding-001/tables/${tableId}`, { data: { tableName } })
      expect(res.ok()).toBe(true)
    }
    await recordCanvasText(page)
    // 種子的「男方家屬桌」「女方家屬桌」也是 5 字
    const expected = [...Object.values(longNames), '男方家屬桌', '女方家屬桌']
    const compact = (text: string) => text.replaceAll(' ', '')

    for (const item of ['備餐地圖 · JPEG', '賓客名單 · PDF']) {
      await page.getByTestId('vibe-seating-download').click()
      const download = page.waitForEvent('download')
      await page.getByRole('menuitem', { name: item }).click()
      await download
      const drawn = await takeDrawn(page)

      // 場地圖先畫（名單卡、索引在後），取第一次出現：整個桌名單行，或相鄰兩段接起來等於桌名
      const longFonts = new Set<string>()
      for (const name of expected) {
        const index = drawn.findIndex((d, i) => d.text === name || (i + 1 < drawn.length && compact(d.text + drawn[i + 1]!.text) === compact(name)))
        expect(index, `${item}：「${name}」沒有完整畫出`).toBeGreaterThanOrEqual(0)
        longFonts.add(drawn[index]!.font)
        if (drawn[index]!.text !== name)
          longFonts.add(drawn[index + 1]!.font)
      }
      expect([...longFonts], `${item}：長桌名字級不一致`).toHaveLength(1)
      // 短桌名維持單行
      expect(drawn.map(d => d.text), `${item}：主桌不是單行`).toContain('主桌')
      expect(drawn.filter(d => d.text.endsWith('…') && expected.some(name => compact(name).startsWith(compact(d.text.slice(0, -1))))), `${item}：有桌名被截斷`).toEqual([])
    }
  })
})
