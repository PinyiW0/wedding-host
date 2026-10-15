// Source: app/composables/useSeatingChartExport.ts + app/pages/weddings/[weddingId]/seating.vue（下載桌次圖，issue #101）
// Pattern: menu（互動：下拉兩組——備餐地圖 / 賓客名單，各含 JPEG / PDF；賓客名單另有 Excel，issue #194）+ 下載事件
// 新增「賓客名單」版本（圈內列賓客姓名）不取代既有「備餐地圖」版本；此處驗證兩組並存且名單版可觸發下載

import { expect, test } from '@playwright/test'
import ExcelJS from 'exceljs'

import { login, resetMockData, TestUsers } from '../helpers'

const SEATING_URL = '/weddings/wedding-001/seating'

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
})
