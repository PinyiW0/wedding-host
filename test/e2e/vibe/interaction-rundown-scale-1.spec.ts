// Source: app/pages/weddings/[weddingId]/rundown.vue、app/composables/usePointerReorder.ts、app/composables/useRundownExport.ts（issue #213）
// Pattern: structure（大量資料下的版面：角色彈窗、「調整順序」選單、矩陣表捲動與凍結左欄、角色篩選、匯出）
//
// 種子資料只有 4 個角色、1 列，彈窗與選單撐不滿；正式站 63 列 × 18 角色時「新增角色」被彈窗裁掉、選單超出視窗。
// 這支先建出 60 列 × 20 角色再檢查。toBeVisible 會把被外層裁掉的元素判成看得到，
// 所以「看得到」一律檢查：完整落在視窗內＋元素中心點 elementFromPoint 拿到的是它自己（沒被蓋住、沒被裁掉）。
// 檢查前不對目標元素做 click 等動作：Playwright 動作前會自動把元素捲進畫面，會蓋掉「人眼看不到」的問題。

import type { Locator, Page } from '@playwright/test'

import { readFile } from 'node:fs/promises'
import { expect, test } from '@playwright/test'
import ExcelJS from 'exceljs'

import { login, resetMockData, TestUsers } from '../helpers'

const WEDDING_ID = 'wedding-001'
const RUNDOWN_PATH = `/weddings/${WEDDING_ID}/rundown`
const API = `/api/v1/weddings/${WEDDING_ID}`

const ROW_COUNT = 60
const ROLE_COUNT = 20
// seed 已有 4 個角色，補到 20 個；新增的角色排在最後
const EXTRA_ROLES = Array.from({ length: ROLE_COUNT - 4 }, (_, i) => `工作人員${String(i + 5).padStart(2, '0')}`)
const FIRST_ROLE = '接待'
const LAST_ROLE = EXTRA_ROLES.at(-1)!
const LAST_TITLE = `第${ROW_COUNT}段`
// 長圖每列最矮 40px（useRundownExport BIG.minRowH）
const EXPORT_MIN_ROW_H = 40

const VIEWPORTS = [
  { name: '桌機', size: { width: 1280, height: 720 } },
  { name: '手機', size: { width: 390, height: 664 } },
] as const

function hhmm(minutes: number) {
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`
}

// 用 API 建出 60 列 × 20 角色，每列每個角色欄都有字
async function seedScale(page: Page) {
  for (const name of EXTRA_ROLES)
    expect((await page.request.post(`${API}/rundown-roles`, { data: { name } })).ok()).toBe(true)
  const roles: { roleId: string }[] = await (await page.request.get(`${API}/rundown-roles`)).json()
  expect(roles).toHaveLength(ROLE_COUNT)
  const items = Array.from({ length: ROW_COUNT }, (_, i) => ({
    time: hhmm(8 * 60 + i * 10),
    durationMinutes: 10,
    title: `第${i + 1}段`,
    location: '宴會廳',
    note: '備註',
    roleTasks: roles.map(r => ({ roleId: r.roleId, task: '事項' })),
  }))
  expect((await page.request.put(`${API}/rundown-items`, { data: { items } })).ok()).toBe(true)
}

// 完整落在視窗內，而且元素中心點最上層就是它自己（或它裡面的元素）
async function expectReachable(locator: Locator) {
  await expect(locator).toBeInViewport({ ratio: 1 })
  const hit = await locator.evaluate((el) => {
    const r = el.getBoundingClientRect()
    const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)
    return top !== null && (top === el || el.contains(top))
  })
  expect(hit, '元素中心點被別的東西蓋住或被外層裁掉').toBe(true)
}

// 把清單捲到底（使用者用滾輪捲的效果），不碰目標元素本身
async function scrollToBottom(list: Locator) {
  await list.evaluate((el) => {
    el.scrollTop = el.scrollHeight
  })
}

function roleDialog(page: Page) {
  return page.getByRole('dialog').filter({ has: page.getByRole('heading', { name: '工作人員角色' }) })
}

async function openColumnMenu(page: Page) {
  await page.getByRole('button', { name: /^調整順序/ }).click()
  await expect(page.getByRole('checkbox', { name: FIRST_ROLE })).toBeAttached()
}

function roleOrderSaved(page: Page) {
  return page.waitForResponse(res => res.url().includes('/rundown-roles/order') && res.request().method() === 'PUT')
}

async function roleHeaders(page: Page) {
  return (await page.getByRole('columnheader').allInnerTexts()).map(h => h.trim()).filter(h => h === FIRST_ROLE || h.startsWith('工作人員') || ['總場控', '新秘', '平面攝影師'].includes(h))
}

function matrixScroller(page: Page) {
  return page.getByRole('table')
}

for (const viewport of VIEWPORTS) {
  test.describe(`vibe：當天流程 60 列 × 20 角色（${viewport.name}）`, () => {
    test.use({ viewport: viewport.size })

    test.beforeEach(async ({ page }) => {
      await resetMockData(page)
      await seedScale(page)
      await login(page, TestUsers.admin.account, TestUsers.admin.password)
      await page.goto(RUNDOWN_PATH, { waitUntil: 'networkidle' })
      await expect(page.getByTestId('rundown-cell-title')).toHaveCount(ROW_COUNT)
    })

    test.describe('工作人員角色彈窗', () => {
      test('打開彈窗就看得到「新增角色」與「完成」；捲到清單底，兩顆仍在原位', async ({ page }) => {
        await page.getByRole('button', { name: /工作人員角色/ }).click()
        const dialog = roleDialog(page)
        await expect(dialog.getByRole('listitem', { name: FIRST_ROLE })).toBeVisible()

        const add = dialog.getByRole('button', { name: '新增角色' })
        const done = dialog.getByRole('button', { name: '完成' })
        await expectReachable(add)
        await expectReachable(done)

        const before = (await add.boundingBox())!.y
        await scrollToBottom(dialog.getByRole('list'))
        await expectReachable(add)
        expect(Math.abs((await add.boundingBox())!.y - before)).toBeLessThan(1)
      })

      test('清單捲到底，最後一個角色的連結、編輯、移除都點得到', async ({ page }) => {
        await page.getByRole('button', { name: /工作人員角色/ }).click()
        const dialog = roleDialog(page)
        await scrollToBottom(dialog.getByRole('list'))

        await expectReachable(dialog.getByRole('button', { name: `複製 ${LAST_ROLE} 的連結` }))
        await expectReachable(dialog.getByRole('button', { name: `編輯 ${LAST_ROLE}` }))
        const remove = dialog.getByRole('button', { name: `移除 ${LAST_ROLE}` })
        await expectReachable(remove)

        await remove.click()
        await dialog.getByRole('button', { name: '確認移除' }).click()
        await expect(dialog.getByRole('listitem', { name: LAST_ROLE })).toHaveCount(0)
        await expect(dialog.getByRole('listitem')).toHaveCount(ROLE_COUNT - 1)
      })

      test('從彈窗新增角色，新角色出現在清單與表頭', async ({ page }) => {
        await page.getByRole('button', { name: /工作人員角色/ }).click()
        const dialog = roleDialog(page)
        await expectReachable(dialog.getByRole('button', { name: '新增角色' }))
        await dialog.getByRole('button', { name: '新增角色' }).click()

        await page.getByTestId('rundown-role-name').fill('音控')
        await page.getByTestId('rundown-role-submit').click()

        await expect(dialog.getByRole('listitem', { name: '音控' })).toBeAttached()
        await expect(dialog.getByRole('listitem')).toHaveCount(ROLE_COUNT + 1)
        await dialog.getByRole('button', { name: '完成' }).click()
        await expect(page.getByRole('columnheader', { name: '音控' })).toBeAttached()
      })
    })

    test.describe('「調整順序」選單', () => {
      test('選單整個在視窗內；捲到底能取消勾選最後一個角色，表頭少一欄', async ({ page }) => {
        await openColumnMenu(page)
        const list = page.locator('ul:has([data-role-index])')
        await expect(list).toBeInViewport({ ratio: 1 })

        await scrollToBottom(list)
        const last = page.getByRole('checkbox', { name: LAST_ROLE })
        await expectReachable(last)
        await last.click()
        await expect(page.getByRole('columnheader', { name: LAST_ROLE })).toHaveCount(0)
      })

      test('鍵盤：最後一個角色連按上方向鍵移到第一個，重整後保留', async ({ page }) => {
        await openColumnMenu(page)
        await scrollToBottom(page.locator('ul:has([data-role-index])'))
        const handle = page.getByRole('button', { name: `拖曳調整 ${LAST_ROLE} 欄的順序` })
        await expectReachable(handle)
        await handle.focus()
        for (let i = 0; i < ROLE_COUNT - 1; i++) {
          const saved = roleOrderSaved(page)
          await page.keyboard.press('ArrowUp')
          expect((await saved).ok()).toBe(true)
          await expect(handle).toBeFocused()
        }
        // 移到最上面時把手仍看得到（清單跟著焦點捲動）
        await expectReachable(handle)

        await page.reload({ waitUntil: 'networkidle' })
        expect((await roleHeaders(page))[0]).toBe(LAST_ROLE)
      })

      test('拖曳：最後一個角色拖到清單頂端時清單自動往上捲，放到第一個', async ({ page }) => {
        await openColumnMenu(page)
        const list = page.locator('ul:has([data-role-index])')
        await scrollToBottom(list)
        const from = page.getByRole('button', { name: `拖曳調整 ${LAST_ROLE} 欄的順序` })
        await expectReachable(from)

        const a = (await from.boundingBox())!
        const box = (await list.boundingBox())!
        await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2)
        await page.mouse.down()
        // 停在清單頂端內緣：清單自己往上捲到頂
        await page.mouse.move(a.x + a.width / 2, box.y + 4, { steps: 10 })
        await expect.poll(() => list.evaluate(el => el.scrollTop), { timeout: 5000 }).toBe(0)

        const to = (await page.getByRole('button', { name: `拖曳調整 ${FIRST_ROLE} 欄的順序` }).boundingBox())!
        const saved = roleOrderSaved(page)
        await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 4 })
        await page.mouse.up()
        expect((await saved).ok()).toBe(true)

        await page.reload({ waitUntil: 'networkidle' })
        expect((await roleHeaders(page))[0]).toBe(LAST_ROLE)
      })
    })

    test.describe('矩陣表', () => {
      test('捲到最右邊看得到最後一個角色欄；桌機的主要事項欄留在原位、沒被角色欄蓋住', async ({ page }) => {
        // lg（1024px）以上才凍結左欄；手機凍結四欄會比螢幕還寬，設計上不凍結
        const frozen = viewport.size.width >= 1024
        const title = page.getByTestId('rundown-cell-title').first()
        if (frozen)
          await expectReachable(title)

        await matrixScroller(page).evaluate((table) => {
          const scroller = table.parentElement!
          scroller.scrollLeft = scroller.scrollWidth
        })

        await expectReachable(page.getByRole('columnheader', { name: LAST_ROLE }))
        if (frozen)
          await expectReachable(title)
      })

      test('捲到最底看得到最後一列；按「新增一列」，新列落在視窗內', async ({ page }) => {
        // 用每列最左邊的開始時間判斷：手機不凍結左欄，主要事項欄會被橫向捲動切掉一半
        const time = page.getByTestId('rundown-cell-time')
        await matrixScroller(page).evaluate((table) => {
          const scroller = table.parentElement!
          scroller.scrollTop = scroller.scrollHeight
        })
        await expect(page.getByTestId('rundown-cell-title').nth(ROW_COUNT - 1)).toHaveValue(LAST_TITLE)
        await expectReachable(time.nth(ROW_COUNT - 1))

        await page.getByRole('button', { name: /新增一列/ }).click()
        await expect(time).toHaveCount(ROW_COUNT + 1)
        await expectReachable(time.last())
      })
    })

    test.describe('角色篩選', () => {
      test('下拉在視窗內，捲到最後一個角色選取後只剩該角色欄', async ({ page }) => {
        await page.getByTestId('rundown-role-filter').click()
        const listbox = page.getByRole('listbox')
        await expect(listbox).toBeInViewport({ ratio: 1 })
        await expect(page.getByRole('option')).toHaveCount(ROLE_COUNT + 1)

        await scrollToBottom(listbox)
        const last = page.getByRole('option', { name: LAST_ROLE })
        await expectReachable(last)
        await last.click()

        expect(await roleHeaders(page)).toEqual([LAST_ROLE])
      })
    })

    test.describe('匯出', () => {
      test('Excel 含全部 60 列與 20 個角色欄', async ({ page }) => {
        await page.getByRole('button', { name: '匯出流程表' }).click()
        const download = page.waitForEvent('download')
        await page.getByRole('menuitem', { name: '完整大表 · Excel' }).click()
        const path = await (await download).path()

        const book = new ExcelJS.Workbook()
        await book.xlsx.readFile(path)
        const sheet = book.getWorksheet('流程表')!
        // 表頭 1 列＋資料 60 列；固定 7 欄＋角色 20 欄
        expect(sheet.rowCount).toBe(ROW_COUNT + 1)
        expect(sheet.getRow(1).cellCount).toBe(7 + ROLE_COUNT)
        expect(sheet.getRow(ROW_COUNT + 1).getCell(3).text).toBe(LAST_TITLE)
        expect(sheet.getRow(1).getCell(7 + ROLE_COUNT).text).toBe(LAST_ROLE)
      })

      test('完整大表長圖的高度容納得下 60 列', async ({ page }) => {
        await page.getByRole('button', { name: '匯出流程表' }).click()
        const download = page.waitForEvent('download')
        await page.getByRole('menuitem', { name: '完整大表 · 長圖 PNG' }).click()
        const png = await readFile(await (await download).path())
        // PNG 檔頭 IHDR：第 16–19 byte 是寬、20–23 byte 是高
        const height = png.readUInt32BE(20)
        expect(height).toBeGreaterThanOrEqual(ROW_COUNT * EXPORT_MIN_ROW_H)
      })
    })
  })
}
