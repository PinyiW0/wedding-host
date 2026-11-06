// Source: app/pages/weddings/[weddingId]/rundown.vue、app/components/PublicRundownOverview.vue（issue #207）
// Pattern: interaction（角色彈窗、「調整順序」選單顯示開關＋拖曳排序、多行輸入、凍結左欄、未儲存改動的防護、匯出）
//
// 角色管理收進彈窗，頁面高度全給矩陣表；角色連結改發短網址。
// 角色欄的顯示開關與左右順序集中在「調整順序」選單：開關只影響這台裝置（cookie），順序存進婚禮資料、總覽頁跟著排。
// 主要事項、共用物品、備註可多行，格子跟著長高。
// 表格往右捲時開始、結束、主要事項固定在左邊；整表儲存制下沒存就離開會整份不見，所以離開前詢問、刪列可復原、Cmd/Ctrl+S 可儲存。
// 匯出：完整大表長圖與 Excel 檔名帶匯出時間；篩選單一角色時多一項只含該角色的長圖（取代 50 列會疊字的 A4 JPEG）。
// 取代 issue #192 的角色區塊收合與 #194 的表頭逐欄隱藏。

import type { Page } from '@playwright/test'

import { expect, test } from '@playwright/test'

import { login, resetMockData, selectOption, TestUsers, waitForApiCall } from '../helpers'

const WEDDING_ID = 'wedding-001'
const RUNDOWN_PATH = `/weddings/${WEDDING_ID}/rundown`
const API = `/api/v1/weddings/${WEDDING_ID}`

// seed 角色：接待（role-001）、總場控（role-002）、新秘（role-003）、平面攝影師（role-004）
const ROLE = '總場控'
const ROLE_ID = 'role-002'
// seed 唯一一列
const SEED_TITLE = '新娘物品點交'

// 匯出檔名帶匯出時間（MMDD-HHmm），同一天多次匯出也分得出先後
const EXPORT_NAME_RE = {
  png: /^當天流程表-\d{4}-\d{4}\.png$/,
  xlsx: /^當天流程表-\d{4}-\d{4}\.xlsx$/,
} as const
const ROLE_EXPORT_NAME_RE = /^當天流程表-新秘-\d{4}-\d{4}\.png$/
const RUNDOWN_URL_RE = /\/rundown$/
const GUESTS_URL_RE = /\/guests$/

async function openColumnMenu(page: Page) {
  await page.getByRole('button', { name: /^調整順序/ }).click()
  await expect(page.getByRole('checkbox', { name: ROLE })).toBeVisible()
}

// 按住把手拖到目標把手的位置放開
async function dragHandle(page: Page, from: string, to: string) {
  const a = (await page.getByRole('button', { name: `拖曳調整 ${from} 欄的順序` }).boundingBox())!
  const b = (await page.getByRole('button', { name: `拖曳調整 ${to} 欄的順序` }).boundingBox())!
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2)
  await page.mouse.down()
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 8 })
  await page.mouse.up()
}

test.describe('vibe：當天流程角色彈窗與「調整順序」選單', () => {
  test.beforeEach(async ({ page }) => {
    await resetMockData(page)
    await login(page, TestUsers.admin.account, TestUsers.admin.password)
    await page.goto(RUNDOWN_PATH, { waitUntil: 'networkidle' })
  })

  test.describe('工作人員角色彈窗', () => {
    test('進頁不顯示角色清單，按鈕帶角色數；打開彈窗才看得到角色，按完成關閉', async ({ page }) => {
      const trigger = page.getByRole('button', { name: /工作人員角色/ })
      await expect(trigger).toContainText('4')
      await expect(page.getByRole('listitem', { name: ROLE })).toHaveCount(0)

      await trigger.click()
      const dialog = page.getByRole('dialog')
      await expect(dialog.getByRole('listitem', { name: ROLE })).toBeVisible()
      await expect(dialog.getByRole('button', { name: '新增角色' })).toBeVisible()

      await dialog.getByRole('button', { name: '完成' }).click()
      await expect(dialog).toHaveCount(0)
    })

    test('複製角色連結得到 /s/ 短網址，未登入開啟看得到該角色事項', async ({ page, context, browser }) => {
      await context.grantPermissions(['clipboard-read', 'clipboard-write'])
      await page.getByRole('button', { name: /工作人員角色/ }).click()
      await page.getByRole('button', { name: '複製 新秘 的連結' }).click()
      await expect(page.getByText('已複製「新秘」的連結').first()).toBeVisible()

      const copied = await page.evaluate(() => navigator.clipboard.readText())
      expect(copied).toMatch(/\/s\/[a-z2-9]{8}$/)

      const guest = await browser.newPage()
      await guest.goto(copied)
      await expect(guest).toHaveURL(/role=role-003&sig=/)
      await expect(guest.getByText('婚紗配件、備用鞋檢查')).toBeVisible()
      await guest.close()
    })

    test('確認移除時其他角色的操作收起，畫面上只有一組確認', async ({ page }) => {
      await page.getByRole('button', { name: /工作人員角色/ }).click()
      await page.getByRole('button', { name: '移除 新秘' }).click()

      const dialog = page.getByRole('dialog')
      await expect(dialog.getByRole('button', { name: '確認移除' })).toHaveCount(1)
      await expect(dialog.getByRole('button', { name: /^移除 / })).toHaveCount(0)

      await dialog.getByRole('button', { name: '取消' }).click()
      await expect(dialog.getByRole('button', { name: /^移除 / })).toHaveCount(4)
    })
  })

  test.describe('「調整順序」選單：顯示開關', () => {
    test('取消勾選後表格少一欄，按鈕顯示隱藏數；重整後保留，「全部顯示」一次還原', async ({ page }) => {
      const header = page.getByRole('columnheader', { name: ROLE })
      await expect(header).toBeVisible()

      await openColumnMenu(page)
      await page.getByRole('checkbox', { name: ROLE }).click()
      await page.getByRole('checkbox', { name: '接待' }).click()
      await expect(header).toHaveCount(0)
      await expect(page.getByTestId(`rundown-cell-role-${ROLE_ID}`)).toHaveCount(0)

      await page.reload({ waitUntil: 'networkidle' })
      await expect(page.getByRole('button', { name: /調整順序.*隱藏 2/ })).toBeVisible()
      await expect(header).toHaveCount(0)

      await openColumnMenu(page)
      await page.getByRole('button', { name: '全部顯示' }).click()
      await expect(header).toBeVisible()
      await expect(page.getByRole('columnheader', { name: '接待' })).toBeVisible()
    })

    test('隱藏欄的內容照樣儲存', async ({ page }) => {
      const task = '確認音控與燈光進場時間'
      await page.getByTestId(`rundown-cell-role-${ROLE_ID}`).first().fill(task)
      await openColumnMenu(page)
      await page.getByRole('checkbox', { name: ROLE }).click()
      await page.keyboard.press('Escape')

      const apiCall = waitForApiCall(page, /\/rundown-items(\?|$)/, 'PUT')
      await page.getByTestId('rundown-save').click()
      expect(JSON.stringify((await apiCall).postDataJSON())).toContain(task)
    })

    test('單一角色篩選時，即使該角色已隱藏仍顯示其欄', async ({ page }) => {
      await page.getByTestId(`rundown-cell-role-${ROLE_ID}`).first().fill('確認進場時間')
      await openColumnMenu(page)
      await page.getByRole('checkbox', { name: ROLE }).click()
      await page.keyboard.press('Escape')
      await selectOption(page, 'rundown-role-filter', ROLE)

      await expect(page.getByRole('columnheader', { name: ROLE })).toBeVisible()
    })
  })

  test.describe('「調整順序」選單：拖曳排序', () => {
    test('拖曳後表頭照新順序，重整後保留', async ({ page }) => {
      await openColumnMenu(page)
      const saved = page.waitForResponse(res => res.url().includes('/rundown-roles/order') && res.request().method() === 'PUT')
      await dragHandle(page, '平面攝影師', '接待')
      expect((await saved).ok()).toBe(true)

      await page.reload({ waitUntil: 'networkidle' })
      const heads = (await page.getByRole('columnheader').allInnerTexts()).map(h => h.trim())
      expect(heads.filter(h => ['接待', '總場控', '新秘', '平面攝影師'].includes(h))).toEqual(['平面攝影師', '接待', '總場控', '新秘'])
    })

    test('工作人員總覽頁照角色順序列出同一時段的事項', async ({ page }) => {
      const items = await (await page.request.get(`${API}/rundown-items`)).json()
      await page.request.put(`${API}/rundown-items`, {
        data: { items: [{ rundownItemId: items[0].rundownItemId, time: '16:30', durationMinutes: 20, title: items[0].title, roleTasks: [{ roleId: 'role-003', task: '新秘的事' }, { roleId: 'role-004', task: '攝影的事' }] }] },
      })
      await page.request.put(`${API}/rundown-roles/order`, { data: { roleIds: ['role-004', 'role-003', 'role-002', 'role-001'] } })

      await page.goto(`/rundown/${WEDDING_ID}`, { waitUntil: 'networkidle' })
      const text = (await page.getByTestId('public-rundown').textContent()) ?? ''
      expect(text.indexOf('攝影的事')).toBeLessThan(text.indexOf('新秘的事'))
    })
  })

  test.describe('多行輸入', () => {
    test('備註打四行，格子長高；儲存重整後換行還在', async ({ page }) => {
      const note = page.getByTestId('rundown-cell-note').first()
      const before = (await note.boundingBox())!.height
      const value = '第一行\n第二行\n第三行\n第四行'
      await note.fill(value)
      expect((await note.boundingBox())!.height).toBeGreaterThan(before * 2)

      const saved = page.waitForResponse(res => /\/rundown-items(?:\?|$)/.test(res.url()) && res.request().method() === 'PUT')
      await page.getByTestId('rundown-save').click()
      await saved
      await page.reload({ waitUntil: 'networkidle' })
      await expect(page.getByTestId('rundown-cell-note').first()).toHaveValue(value)
    })
  })

  test.describe('凍結左欄', () => {
    test('表格捲到最右邊，主要事項仍在原位，最後一個角色欄也看得到', async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 900 })
      const title = page.getByTestId('rundown-cell-title').first()
      const before = (await title.boundingBox())!.x

      await page.getByRole('table').evaluate((table) => {
        const scroller = table.parentElement!
        scroller.scrollLeft = scroller.scrollWidth
      })

      await expect(page.getByRole('columnheader', { name: '平面攝影師' })).toBeInViewport()
      expect(Math.abs((await title.boundingBox())!.x - before)).toBeLessThan(1)
    })
  })

  test.describe('未儲存改動的防護', () => {
    test('有改動時點側欄會先詢問；取消留在原頁且改動還在，確認才離開', async ({ page }) => {
      const note = page.getByTestId('rundown-cell-note').first()
      await note.fill('還沒存的備註')

      await page.getByRole('link', { name: '賓客名單', exact: true }).click()
      const dialog = page.getByRole('dialog')
      await expect(dialog.getByText('離開這一頁？')).toBeVisible()

      await dialog.getByRole('button', { name: '取消' }).click()
      await expect(page).toHaveURL(RUNDOWN_URL_RE)
      await expect(note).toHaveValue('還沒存的備註')

      await page.getByRole('link', { name: '賓客名單', exact: true }).click()
      await page.getByRole('dialog').getByRole('button', { name: '離開' }).click()
      await expect(page).toHaveURL(GUESTS_URL_RE)
    })

    test('沒有改動時點側欄直接離開，不詢問', async ({ page }) => {
      await page.getByRole('link', { name: '賓客名單', exact: true }).click()
      await expect(page).toHaveURL(GUESTS_URL_RE)
    })

    test('刪除一列後按「復原」，該列回到表格', async ({ page }) => {
      await page.getByTestId('rundown-row-delete').first().click()
      await expect(page.getByTestId('rundown-cell-title')).toHaveCount(0)

      await page.getByRole('button', { name: '復原' }).first().click()
      await expect(page.getByTestId('rundown-cell-title').first()).toHaveValue(SEED_TITLE)
    })

    test('在格子裡按 Cmd/Ctrl+S 等同按「儲存流程表」', async ({ page }) => {
      const note = page.getByTestId('rundown-cell-note').first()
      await note.fill('用快捷鍵存的備註')

      // 快捷鍵照瀏覽器回報的系統決定：Mac 是 ⌘S、其他是 Ctrl+S。
      // 不用 ControlOrMeta：它看的是跑測試的主機，測試瀏覽器宣稱的系統（Desktop Chrome＝Windows）可能不同
      const modifier = await page.evaluate(() => (navigator.userAgent.includes('Macintosh') ? 'Meta' : 'Control'))
      const apiCall = waitForApiCall(page, /\/rundown-items(\?|$)/, 'PUT')
      await page.keyboard.press(`${modifier}+s`)
      expect(JSON.stringify((await apiCall).postDataJSON())).toContain('用快捷鍵存的備註')
    })
  })

  test.describe('匯出流程表', () => {
    test('沒有篩選時只有完整大表長圖與 Excel，檔名帶匯出時間', async ({ page }) => {
      for (const [label, ext] of [['完整大表 · 長圖 PNG', 'png'], ['完整大表 · Excel', 'xlsx']] as const) {
        await page.getByRole('button', { name: '匯出流程表' }).click()
        await expect(page.getByRole('menuitem')).toHaveCount(2)
        const download = page.waitForEvent('download')
        await page.getByRole('menuitem', { name: label }).click()
        expect((await download).suggestedFilename()).toMatch(EXPORT_NAME_RE[ext])
      }
    })

    test('篩選單一角色時，多一項只含該角色的長圖', async ({ page }) => {
      await selectOption(page, 'rundown-role-filter', '新秘')

      await page.getByRole('button', { name: '匯出流程表' }).click()
      const download = page.waitForEvent('download')
      await page.getByRole('menuitem', { name: '只含「新秘」· 長圖 PNG' }).click()
      expect((await download).suggestedFilename()).toMatch(ROLE_EXPORT_NAME_RE)
    })

    test('有未儲存的改動時匯出，提醒內容與已儲存的版本不同', async ({ page }) => {
      await page.getByTestId('rundown-cell-note').first().fill('還沒存的備註')

      await page.getByRole('button', { name: '匯出流程表' }).click()
      const download = page.waitForEvent('download')
      await page.getByRole('menuitem', { name: '完整大表 · 長圖 PNG' }).click()
      await download
      await expect(page.getByText('匯出內容包含尚未儲存的變更').first()).toBeVisible()
    })
  })
})
