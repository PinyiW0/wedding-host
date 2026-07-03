import { expect, test } from '@playwright/test'

import {
  findEntity,
  login,
  maybeConfirm,
  resetMockData,
  selectOption,
  TestUsers,
  waitForApiCall,
} from '../helpers'

// 對應 spec/e2e-flows/17-rundown.flow.md（當天流程表：角色 CRUD + 矩陣表整表儲存 + 前端範本帶入 + 角色篩選 + 公開頁）
// mock seed（皆屬 wedding-001）：
//   角色 role-001 接待 / role-002 總場控 / role-003 新秘 / role-004 平面攝影師
//   項目 rundownitem-001「新娘物品點交」16:30 / 20 分 / 新娘房 / roleTasks:[{role-003, 婚紗配件、備用鞋檢查}]（標題避開範本字樣）
//
// 矩陣表 UI 合約（草稿列 cell testid，以 .nth(rowIndex) 定位；GET 排序 time null 置頂、其餘 time 升冪，seed 僅一列 index 0）：
//   rundown-cell-time（開始 time input）/ rundown-cell-end（結束 time input，時長＝訖−起）/ rundown-cell-title /
//   rundown-cell-location / rundown-cell-supplies / rundown-cell-note / rundown-cell-role-{roleId}（角色欄 input）/
//   rundown-row-delete（列刪除鈕）；「新增一列」鈕 name /新增一列|新增流程/；單一儲存鈕 rundown-save（整表 PUT）

const RUNDOWN_PATH = '/weddings/wedding-001/rundown'
const ITEMS_API = '/api/v1/weddings/wedding-001/rundown-items'

test.describe('當天流程表（Admin 端）', () => {
  test.beforeEach(async ({ page }) => {
    await resetMockData(page)
    await login(page, TestUsers.admin.account, TestUsers.admin.password)
  })

  test.describe('規則：成功新增流程角色', () => {
    test('成功新增流程角色', async ({ page }) => {
      // Given：預設四角色 seed 可見
      await page.goto(RUNDOWN_PATH, { waitUntil: 'networkidle' })
      await expect(findEntity(page, /總場控/)).toBeVisible()

      // When：新增「動態攝影」
      await page.getByRole('button', { name: /新增角色/ }).click()
      await page.getByLabel(/角色名稱/).fill('動態攝影')

      // 主要 outcome：API spy 驗證 POST .../rundown-roles
      const apiCall = waitForApiCall(page, /\/rundown-roles(\?|$)/, 'POST')
      await page.getByRole('button', { name: /新增|建立|送出|確定/ }).click()
      const request = await apiCall
      expect(request.postDataJSON()).toMatchObject({ name: '動態攝影' })

      // Then：角色可見
      await expect(findEntity(page, /動態攝影/)).toBeVisible()
    })
  })

  test.describe('規則：成功更新流程角色', () => {
    test('成功更新流程角色', async ({ page }) => {
      // Given：role-004（平面攝影師）已存在
      await page.goto(RUNDOWN_PATH, { waitUntil: 'networkidle' })

      // When：改名為「平面攝影」
      await findEntity(page, /平面攝影師/).getByRole('button', { name: /編輯|改名/ }).click()
      await page.getByLabel(/角色名稱/).fill('平面攝影')

      const apiCall = waitForApiCall(page, /\/rundown-roles\/role-004(\?|$)/, 'PATCH')
      await page.getByRole('button', { name: /儲存|更新|送出|確定/ }).click()
      const request = await apiCall
      expect(request.postDataJSON()).toMatchObject({ name: '平面攝影' })

      // Then：新名稱可見
      await expect(findEntity(page, /平面攝影/)).toBeVisible()
    })
  })

  test.describe('規則：更新不存在的流程角色', () => {
    test('流程角色不存在', async ({ page }) => {
      const res = await page.request.patch(
        '/api/v1/weddings/wedding-001/rundown-roles/role-999',
        { data: { name: '新名稱' } },
      )
      expect(res.status()).toBe(404)
      expect(JSON.stringify(await res.json())).toContain('流程角色不存在')
    })
  })

  test.describe('規則：成功移除流程角色（含級聯清理）', () => {
    test('成功移除流程角色', async ({ page }) => {
      // Given：role-003（新秘）被 rundownitem-001 的 roleTasks 引用
      await page.goto(RUNDOWN_PATH, { waitUntil: 'networkidle' })

      // When：移除角色
      const apiCall = waitForApiCall(page, /\/rundown-roles\/role-003(\?|$)/, 'DELETE')
      await findEntity(page, /新秘/).getByRole('button', { name: /移除|刪除/ }).click()
      await maybeConfirm(page)
      await apiCall

      // Then：角色不再可見；項目 roleTasks 不再含該角色（級聯清理，API 邊界驗證）
      await expect(findEntity(page, /新秘/)).not.toBeVisible()
      const itemsRes = await page.request.get(ITEMS_API)
      const items = await itemsRes.json()
      const seedItem = items.find((i: { rundownItemId: string }) => i.rundownItemId === 'rundownitem-001')
      const roleIds = seedItem.roleTasks.map((rt: { roleId: string }) => rt.roleId)
      expect(roleIds).not.toContain('role-003')
    })
  })

  test.describe('規則：移除不存在的流程角色', () => {
    test('流程角色不存在', async ({ page }) => {
      const res = await page.request.delete(
        '/api/v1/weddings/wedding-001/rundown-roles/role-999',
      )
      expect(res.status()).toBe(404)
      expect(JSON.stringify(await res.json())).toContain('流程角色不存在')
    })
  })

  test.describe('規則：表格內編輯並整表儲存', () => {
    test('修改既有列後以單一儲存鈕整表 PUT', async ({ page }) => {
      // Given：進入流程表頁，seed 列為草稿 index 0
      await page.goto(RUNDOWN_PATH, { waitUntil: 'networkidle' })

      // When：表格內直接改主要事項 / 場地 / 新秘角色欄
      await page.getByTestId('rundown-cell-title').nth(0).fill('新娘物品最終點交')
      await page.getByTestId('rundown-cell-location').nth(0).fill('新娘準備室')
      await page.getByTestId('rundown-cell-role-role-003').nth(0).fill('協助最終檢查')

      // 主要 outcome：API spy 驗證 PUT .../rundown-items（既有列帶原 rundownItemId）
      const apiCall = waitForApiCall(page, /\/rundown-items(\?|$)/, 'PUT')
      await page.getByTestId('rundown-save').click()
      const request = await apiCall
      expect(request.postDataJSON().items[0]).toMatchObject({
        rundownItemId: 'rundownitem-001',
        title: '新娘物品最終點交',
        location: '新娘準備室',
        roleTasks: [{ roleId: 'role-003', task: '協助最終檢查' }],
      })

      // Then：儲存後草稿呈現新值
      await expect(page.getByTestId('rundown-cell-title').nth(0)).toHaveValue('新娘物品最終點交')
    })
  })

  test.describe('規則：新增列並儲存', () => {
    test('新列無 rundownItemId，時長由起訖時間推算', async ({ page }) => {
      // Given：進入流程表頁（seed 佔 index 0，新列為 index 1）
      await page.goto(RUNDOWN_PATH, { waitUntil: 'networkidle' })

      // When：新增一列，填起訖時間與主要事項
      await page.getByRole('button', { name: /新增一列|新增流程/ }).click()
      await page.getByTestId('rundown-cell-time').nth(1).fill('17:30')
      await page.getByTestId('rundown-cell-end').nth(1).fill('17:50')
      await page.getByTestId('rundown-cell-title').nth(1).fill('婚宴場地佈置確認')

      const apiCall = waitForApiCall(page, /\/rundown-items(\?|$)/, 'PUT')
      await page.getByTestId('rundown-save').click()
      const request = await apiCall

      // Then：payload 含一筆無 rundownItemId 的新列（durationMinutes＝17:50−17:30＝20，後端配發 id）
      const newRow = request.postDataJSON().items
        .find((i: { rundownItemId?: string }) => !i.rundownItemId)
      expect(newRow).toMatchObject({ time: '17:30', durationMinutes: 20, title: '婚宴場地佈置確認' })
    })
  })

  test.describe('規則：刪除列並儲存（未帶回列＝刪除）', () => {
    test('刪除既有列後儲存', async ({ page }) => {
      // Given：進入流程表頁，seed 為唯一一列
      await page.goto(RUNDOWN_PATH, { waitUntil: 'networkidle' })

      // When：刪除 seed 列後儲存
      await page.getByTestId('rundown-row-delete').nth(0).click()
      const apiCall = waitForApiCall(page, /\/rundown-items(\?|$)/, 'PUT')
      await page.getByTestId('rundown-save').click()
      const request = await apiCall

      // Then：payload 不含該列（未帶回＝刪除為合約）；儲存後草稿無該列
      const titles = request.postDataJSON().items.map((i: { title: string }) => i.title)
      expect(titles).not.toContain('新娘物品點交')
      await expect(page.getByTestId('rundown-cell-title')).toHaveCount(0)
    })
  })

  test.describe('規則：範本預覽與帶入草稿', () => {
    test('modal 預覽推算時間，帶入僅進草稿，儲存才 PUT', async ({ page }) => {
      // Given：進入流程表頁
      await page.goto(RUNDOWN_PATH, { waitUntil: 'networkidle' })

      // When：開範本 modal，填開始時間 18:00
      await page.getByRole('button', { name: /帶入.*範本|宴客段範本/ }).click()
      await page.getByLabel(/開始時間/).fill('18:00')

      // Then：預覽容器顯示推算結果（第一段 18:00 彩排、末段 21:05 送客・合照，推算公式為合約）
      const preview = page.getByTestId('rundown-template-preview')
      await expect(preview).toContainText('彩排')
      await expect(preview).toContainText('18:00')
      await expect(preview).toContainText('送客・合照')
      await expect(preview).toContainText('21:05')

      // When：按帶入 → 僅進草稿（seed 1＋範本 8＝9 列）
      await page.getByRole('dialog').getByRole('button', { name: /帶入|套用/ }).click()
      await expect(page.getByTestId('rundown-cell-title')).toHaveCount(9)

      // When：再按儲存才整表 PUT
      const apiCall = waitForApiCall(page, /\/rundown-items(\?|$)/, 'PUT')
      await page.getByTestId('rundown-save').click()
      const request = await apiCall

      // Then：整表 9 筆，含推算後的首末段
      const items = request.postDataJSON().items
      expect(items).toHaveLength(9)
      expect(items).toEqual(expect.arrayContaining([
        expect.objectContaining({ time: '18:00', title: '彩排・設備確認' }),
        expect.objectContaining({ time: '21:05', title: '送客・合照' }),
      ]))
    })
  })

  test.describe('規則：依角色篩選', () => {
    test('僅顯示 roleTasks 含該角色的列', async ({ page }) => {
      // Given：整表 PUT 兩列取代 seed（新秘列 / 接待列）
      await page.request.put(ITEMS_API, {
        data: {
          items: [
            { time: '15:00', durationMinutes: 30, title: '新秘妝髮準備', roleTasks: [{ roleId: 'role-003', task: '妝髮定型' }] },
            { time: '15:30', durationMinutes: 30, title: '禮金桌準備', roleTasks: [{ roleId: 'role-001', task: '禮金點收' }] },
          ],
        },
      })
      await page.goto(RUNDOWN_PATH, { waitUntil: 'networkidle' })

      // When：篩選「新秘」（'__all__' 哨兵＝全部）
      await selectOption(page, 'rundown-role-filter', /新秘/)

      // Then：草稿僅渲染新秘參與列；接待列不渲染
      await expect(page.getByTestId('rundown-cell-title')).toHaveCount(1)
      await expect(page.getByTestId('rundown-cell-title').nth(0)).toHaveValue('新秘妝髮準備')
    })
  })

  test.describe('規則：時間格式錯誤（API 邊界）', () => {
    test('time 非 HH:MM 被拒絕', async ({ page }) => {
      const res = await page.request.put(ITEMS_API, {
        data: { items: [{ title: 'x', time: '五點' }] },
      })
      expect(res.status()).toBe(400)
      expect(JSON.stringify(await res.json())).toContain('時間格式錯誤')
    })
  })
})

test.describe('公開流程表（免登入）', () => {
  test.beforeEach(async ({ page }) => {
    await resetMockData(page)
  })

  test.describe('規則：成功呈現公開流程表', () => {
    test('未登入可讀 seed 項目（含時間與場地）', async ({ page }) => {
      await page.goto('/rundown/wedding-001', { waitUntil: 'networkidle' })
      await expect(page.getByTestId('public-rundown')).toBeVisible()
      await expect(findEntity(page, /新娘物品點交/)).toBeVisible()
      await expect(findEntity(page, /新娘物品點交/)).toContainText('16:30')
      await expect(findEntity(page, /新娘物品點交/)).toContainText('新娘房')
    })
  })

  test.describe('規則：依角色參數篩選', () => {
    test('帶 role 參數僅顯示該角色時段與其個別事項', async ({ page }) => {
      // Given：整表 PUT——保留 seed 列（帶原 id）＋加一列接待列
      await page.request.put('/api/v1/weddings/wedding-001/rundown-items', {
        data: {
          items: [
            {
              rundownItemId: 'rundownitem-001',
              time: '16:30',
              durationMinutes: 20,
              title: '新娘物品點交',
              location: '新娘房',
              supplies: '婚紗配件、備用鞋',
              roleTasks: [{ roleId: 'role-003', task: '婚紗配件、備用鞋檢查' }],
            },
            { time: '11:00', durationMinutes: 30, title: '禮金桌準備', roleTasks: [{ roleId: 'role-001', task: '禮金點收' }] },
          ],
        },
      })

      // When：帶 role=role-003（新秘）進入公開頁
      await page.goto('/rundown/wedding-001?role=role-003', { waitUntil: 'networkidle' })

      // Then：僅 roleTasks 含新秘的項目可見，且該角色個別事項文字可讀
      await expect(findEntity(page, /新娘物品點交/)).toBeVisible()
      await expect(findEntity(page, /新娘物品點交/)).toContainText('婚紗配件、備用鞋檢查')
      await expect(findEntity(page, /禮金桌準備/)).not.toBeVisible()
    })
  })
})
