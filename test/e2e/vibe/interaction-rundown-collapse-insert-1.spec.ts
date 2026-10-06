// Source: app/pages/weddings/[weddingId]/rundown.vue + server rundown-items PUT（issue #192）
// Pattern: 折疊（工作人員角色區塊收合＋記住選擇）+ interaction（指定列上下插入）
//
// 矩陣表是主要工作區：角色區塊可收成一行把高度讓出來；
// 中間補一段時直接在該列上下插入，新列預帶相鄰時間（儲存後依開始時間重排，沒時間的列會被排到最上面）。
// 同時間（含未定時段）的列，儲存時連同畫面順序一起落地，插入位置才留得住。
// 矩陣表上方只留一列工具列：填寫說明收進資訊圖示，「新增一列」放在重置與儲存之間、加完捲到新列。

import { expect, test } from '@playwright/test'

import { findEntity, login, resetMockData, selectOption, TestUsers, waitForApiCall } from '../helpers'

const WEDDING_ID = 'wedding-001'
const RUNDOWN_PATH = `/weddings/${WEDDING_ID}/rundown`
const ITEMS_API = `/api/v1/weddings/${WEDDING_ID}/rundown-items`

// seed：rundownitem-001「新娘物品點交」16:30 / 20 分（訖 16:50），為唯一一列
const SEED_TITLE = '新娘物品點交'

test.describe('vibe：當天流程角色區塊收合與指定列插入', () => {
  test.beforeEach(async ({ page }) => {
    await resetMockData(page)
    await login(page, TestUsers.admin.account, TestUsers.admin.password)
  })

  test.describe('工作人員角色區塊收合', () => {
    test('從未操作過時預設展開，角色膠囊可見', async ({ page }) => {
      await page.goto(RUNDOWN_PATH, { waitUntil: 'networkidle' })

      await expect(page.getByRole('button', { name: '收合工作人員角色' })).toHaveAttribute('aria-expanded', 'true')
      await expect(findEntity(page, /總場控/)).toBeVisible()
    })

    test('收合後只佔一行，顯示角色數量與展開鈕', async ({ page }) => {
      // Given：展開狀態的區塊高度
      await page.goto(RUNDOWN_PATH, { waitUntil: 'networkidle' })
      const region = page.getByRole('region', { name: '工作人員角色' })
      const expandedHeight = (await region.boundingBox())!.height

      // When：收合
      await page.getByRole('button', { name: '收合工作人員角色' }).click()

      // Then：膠囊收起，剩一行（標題＋數量＋按鈕）
      await expect(page.getByRole('article', { name: '總場控' })).toBeHidden()
      await expect(region).toContainText('4 個')
      await expect(page.getByRole('button', { name: '展開工作人員角色' })).toHaveAttribute('aria-expanded', 'false')
      const collapsedHeight = (await region.boundingBox())!.height
      expect(collapsedHeight).toBeLessThanOrEqual(40)
      expect(collapsedHeight).toBeLessThan(expandedHeight)
    })

    test('收合／展開的選擇重整後保留', async ({ page }) => {
      await page.goto(RUNDOWN_PATH, { waitUntil: 'networkidle' })

      // When：收合後重整
      await page.getByRole('button', { name: '收合工作人員角色' }).click()
      await expect(page.getByRole('button', { name: '展開工作人員角色' })).toBeVisible()
      await page.reload({ waitUntil: 'networkidle' })

      // Then：仍是收合
      await expect(page.getByRole('button', { name: '展開工作人員角色' })).toBeVisible()
      await expect(page.getByRole('article', { name: '總場控' })).toBeHidden()

      // When：展開後重整
      await page.getByRole('button', { name: '展開工作人員角色' }).click()
      await expect(page.getByRole('button', { name: '收合工作人員角色' })).toBeVisible()
      await page.reload({ waitUntil: 'networkidle' })

      // Then：仍是展開
      await expect(findEntity(page, /總場控/)).toBeVisible()
    })
  })

  test.describe('指定列上下插入', () => {
    test('往下插入：新列在該列正下方，開始時間預帶該列的結束時間', async ({ page }) => {
      await page.goto(RUNDOWN_PATH, { waitUntil: 'networkidle' })

      await page.getByRole('button', { name: /^往下插入一列/ }).nth(0).click()

      await expect(page.getByTestId('rundown-cell-title')).toHaveCount(2)
      await expect(page.getByTestId('rundown-cell-title').nth(0)).toHaveValue(SEED_TITLE)
      await expect(page.getByTestId('rundown-cell-title').nth(1)).toHaveValue('')
      await expect(page.getByTestId('rundown-cell-time').nth(1)).toHaveValue('16:50')
    })

    test('往上插入：新列在該列正上方，開始時間預帶該列的開始時間', async ({ page }) => {
      await page.goto(RUNDOWN_PATH, { waitUntil: 'networkidle' })

      await page.getByRole('button', { name: /^往上插入一列/ }).nth(0).click()

      await expect(page.getByTestId('rundown-cell-title')).toHaveCount(2)
      await expect(page.getByTestId('rundown-cell-title').nth(0)).toHaveValue('')
      await expect(page.getByTestId('rundown-cell-time').nth(0)).toHaveValue('16:30')
      await expect(page.getByTestId('rundown-cell-title').nth(1)).toHaveValue(SEED_TITLE)
    })

    test('該列沒有時間時，插入的新列也不帶時間', async ({ page }) => {
      // Given：唯一一列為未定時段
      await page.request.put(ITEMS_API, { data: { items: [{ title: '婚前一天物品準備' }] } })
      await page.goto(RUNDOWN_PATH, { waitUntil: 'networkidle' })

      await page.getByRole('button', { name: /^往下插入一列/ }).nth(0).click()
      await page.getByRole('button', { name: /^往上插入一列/ }).nth(0).click()

      await expect(page.getByTestId('rundown-cell-title')).toHaveCount(3)
      await expect(page.getByTestId('rundown-cell-title').nth(1)).toHaveValue('婚前一天物品準備')
      await expect(page.getByTestId('rundown-cell-time').nth(0)).toHaveValue('')
      await expect(page.getByTestId('rundown-cell-time').nth(2)).toHaveValue('')
    })

    test('插入的新列儲存後留在插入位置', async ({ page }) => {
      await page.goto(RUNDOWN_PATH, { waitUntil: 'networkidle' })

      // When：往下插入、填主要事項後儲存
      await page.getByRole('button', { name: /^往下插入一列/ }).nth(0).click()
      await page.getByTestId('rundown-cell-title').nth(1).fill('婚宴場地佈置確認')
      const apiCall = waitForApiCall(page, /\/rundown-items(\?|$)/, 'PUT')
      await page.getByTestId('rundown-save').click()
      const request = await apiCall

      // Then：payload 第二筆是預帶時間的新列（無 rundownItemId）；儲存重排後仍在 seed 列下方
      const items = request.postDataJSON().items
      expect(items[1]).toMatchObject({ time: '16:50', title: '婚宴場地佈置確認' })
      expect(items[1].rundownItemId).toBeUndefined()
      await expect(page.getByText('流程表已儲存').first()).toBeVisible()
      await expect(page.getByTestId('rundown-cell-title').nth(0)).toHaveValue(SEED_TITLE)
      await expect(page.getByTestId('rundown-cell-title').nth(1)).toHaveValue('婚宴場地佈置確認')
    })

    test('往上插入的新列不改時間直接儲存，重整後仍在原列上方', async ({ page }) => {
      await page.goto(RUNDOWN_PATH, { waitUntil: 'networkidle' })

      // When：往上插入（預帶與 seed 列相同的 16:30）、只填主要事項就儲存
      await page.getByRole('button', { name: /^往上插入一列/ }).nth(0).click()
      await page.getByTestId('rundown-cell-title').nth(0).fill('新娘房鑰匙交接')
      // 等 PUT 回應完成才 reload，避免搶在寫入前重讀
      const saved = page.waitForResponse(res => /\/rundown-items(?:\?|$)/.test(res.url()) && res.request().method() === 'PUT')
      await page.getByTestId('rundown-save').click()
      await saved

      // Then：同時間的兩列照儲存當下的畫面順序呈現，重整後不變
      await expect(page.getByTestId('rundown-cell-title').nth(0)).toHaveValue('新娘房鑰匙交接')
      await expect(page.getByTestId('rundown-cell-title').nth(1)).toHaveValue(SEED_TITLE)
      await page.reload({ waitUntil: 'networkidle' })
      await expect(page.getByTestId('rundown-cell-title').nth(0)).toHaveValue('新娘房鑰匙交接')
      await expect(page.getByTestId('rundown-cell-time').nth(0)).toHaveValue('16:30')
      await expect(page.getByTestId('rundown-cell-title').nth(1)).toHaveValue(SEED_TITLE)
    })

    test('未定時段的列，儲存後維持畫面順序', async ({ page }) => {
      // Given：唯一一列為未定時段
      await page.request.put(ITEMS_API, { data: { items: [{ title: '婚前一天物品準備' }] } })
      await page.goto(RUNDOWN_PATH, { waitUntil: 'networkidle' })

      // When：往上插入一列（同樣沒有時間）後儲存
      await page.getByRole('button', { name: /^往上插入一列/ }).nth(0).click()
      await page.getByTestId('rundown-cell-title').nth(0).fill('確認喜餅到貨')
      const saved = page.waitForResponse(res => /\/rundown-items(?:\?|$)/.test(res.url()) && res.request().method() === 'PUT')
      await page.getByTestId('rundown-save').click()
      await saved
      await page.reload({ waitUntil: 'networkidle' })

      // Then：新列仍在上方
      await expect(page.getByTestId('rundown-cell-title').nth(0)).toHaveValue('確認喜餅到貨')
      await expect(page.getByTestId('rundown-cell-title').nth(1)).toHaveValue('婚前一天物品準備')
    })

    test('「新增一列」仍加在表格最底，不預帶時間', async ({ page }) => {
      // Given：先往上插入一列，表格共兩列
      await page.goto(RUNDOWN_PATH, { waitUntil: 'networkidle' })
      await page.getByRole('button', { name: /^往上插入一列/ }).nth(0).click()
      await expect(page.getByTestId('rundown-cell-title')).toHaveCount(2)

      await page.getByRole('button', { name: /新增一列/ }).click()

      await expect(page.getByTestId('rundown-cell-title')).toHaveCount(3)
      await expect(page.getByTestId('rundown-cell-title').nth(1)).toHaveValue(SEED_TITLE)
      await expect(page.getByTestId('rundown-cell-title').nth(2)).toHaveValue('')
      await expect(page.getByTestId('rundown-cell-time').nth(2)).toHaveValue('')
    })

    test('篩選單一角色時不顯示插入鈕', async ({ page }) => {
      // Given：兩列各屬不同角色
      await page.request.put(ITEMS_API, {
        data: {
          items: [
            { time: '15:00', durationMinutes: 30, title: '新秘妝髮準備', roleTasks: [{ roleId: 'role-003', task: '妝髮定型' }] },
            { time: '15:30', durationMinutes: 30, title: '禮金桌準備', roleTasks: [{ roleId: 'role-001', task: '禮金點收' }] },
          ],
        },
      })
      await page.goto(RUNDOWN_PATH, { waitUntil: 'networkidle' })
      await expect(page.getByRole('button', { name: /插入一列/ })).toHaveCount(4)

      // When：篩選「新秘」
      await selectOption(page, 'rundown-role-filter', '新秘')

      // Then：只剩新秘列，且列上沒有插入鈕
      await expect(page.getByTestId('rundown-cell-title')).toHaveCount(1)
      await expect(page.getByRole('button', { name: /插入一列/ })).toHaveCount(0)
    })
  })

  test.describe('矩陣表工具列', () => {
    test('填寫說明平常不顯示，停留資訊圖示才出現', async ({ page }) => {
      await page.goto(RUNDOWN_PATH, { waitUntil: 'networkidle' })
      const help = page.getByText(/勾選「賓客」欄的時段才會出現在賓客版流程頁/)
      await expect(help).toHaveCount(0)

      await page.getByRole('button', { name: '流程矩陣表填寫說明' }).hover()

      await expect(help.first()).toBeVisible()
    })

    test('「新增一列」位於重置與儲存之間', async ({ page }) => {
      await page.goto(RUNDOWN_PATH, { waitUntil: 'networkidle' })

      const reset = (await page.getByTestId('rundown-reset').boundingBox())!
      const add = (await page.getByRole('button', { name: /新增一列/ }).boundingBox())!
      const save = (await page.getByTestId('rundown-save').boundingBox())!

      expect(add.x).toBeGreaterThan(reset.x)
      expect(add.x).toBeLessThan(save.x)
    })

    test('列數多時按「新增一列」，表格捲到新列', async ({ page }) => {
      // Given：帶入範本後共 9 列，超出表格可視高度
      await page.goto(RUNDOWN_PATH, { waitUntil: 'networkidle' })
      await page.getByRole('button', { name: /帶入.*範本/ }).click()
      await page.getByRole('dialog').getByRole('button', { name: /帶入/ }).click()
      await expect(page.getByTestId('rundown-cell-title')).toHaveCount(9)
      await expect(page.getByTestId('rundown-cell-title').nth(8)).not.toBeInViewport()

      await page.getByRole('button', { name: /新增一列/ }).click()

      // Then：新列加在最底，且已捲進可視範圍
      await expect(page.getByTestId('rundown-cell-title')).toHaveCount(10)
      await expect(page.getByTestId('rundown-cell-title').nth(9)).toBeInViewport()
    })
  })

  test.describe('矩陣表工具列（觸控裝置）', () => {
    test.use({ hasTouch: true })

    test('沒有滑鼠停留時，點一下資訊圖示也會顯示填寫說明', async ({ page }) => {
      await page.goto(RUNDOWN_PATH, { waitUntil: 'networkidle' })
      const help = page.getByText(/勾選「賓客」欄的時段才會出現在賓客版流程頁/)
      await expect(help).toHaveCount(0)

      await page.getByRole('button', { name: '流程矩陣表填寫說明' }).tap()

      await expect(help.first()).toBeVisible()
    })
  })
})
