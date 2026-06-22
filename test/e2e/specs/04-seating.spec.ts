import { expect, test } from '@playwright/test'

import {
  findEntity,
  getFeedbackElement,
  login,
  maybeConfirm,
  resetMockData,
  selectOption,
  TestUsers,
  waitForApiCall,
} from '../helpers'

// 對應 spec/e2e-flows/04-seating.flow.md
// （桌次 CRUD + 場地佈局 + 座位安排 + 禮俗設定 / 警告）
// Feature Background：已登入為管理員（Admin）；已選定 wedding-001
// mock seed：
//   tables：table-001(主桌/12座/100,200，由後台設定)、table-002(男方家屬桌)、table-003(女方家屬桌)
//   seats：預設無人入座
//   venueLayout：wedding-001 已有舞台設定
//   etiquetteSettings：wedding-001 五開關（部分開部分關）
//   etiquetteWarnings：warning-001(gender-separation/未忽略)、warning-002(elder-near-main/未忽略)

const SEATING_URL = '/weddings/wedding-001/seating'

test.beforeEach(async ({ page }) => {
  await resetMockData(page)
  await login(page, TestUsers.admin.account, TestUsers.admin.password)
})

// =====================================================================
// 桌次 CRUD
// =====================================================================
test.describe('桌次管理（Admin 端）', () => {
  test.describe('規則：成功新增桌次', () => {
    test('成功新增桌次', async ({ page }) => {
      // Given：進入座位安排頁
      await page.goto(SEATING_URL, { waitUntil: 'networkidle' })

      // When：觸發新增桌次並填寫名稱 / 座位數 / 位置
      await page.getByRole('button', { name: /新增桌次|新增/ }).click()
      await page.getByLabel(/桌次名稱|名稱/).fill('主桌2')
      await page.getByLabel(/座位數|容量/).fill('10')
      await page.getByLabel(/^X|位置 X|橫向/).fill('100')
      await page.getByLabel(/^Y|位置 Y|縱向/).fill('200')

      // 主要 outcome：API spy 驗證 POST .../tables，payload 含核心欄位
      const apiCall = waitForApiCall(page, /\/tables(\?|$)/, 'POST')
      await page.getByRole('button', { name: /新增|建立|送出|確定/ }).click()
      const request = await apiCall
      expect(request.postDataJSON()).toMatchObject({
        tableName: '主桌2',
        capacity: 10,
        positionX: 100,
        positionY: 200,
      })

      // Then：列表 / 平面圖新增可識別的「主桌2」實體，能讀到座位數 10
      const entity = findEntity(page, /主桌2/)
      await expect(entity).toBeVisible()
      await expect(entity.getByText(/10/)).toBeVisible()
    })
  })

  test.describe('規則：成功更新桌次', () => {
    test('成功更新桌次', async ({ page }) => {
      // Given：table-001（主桌 / 10 座）已存在
      await page.goto(SEATING_URL, { waitUntil: 'networkidle' })

      // When：在 table-001 範圍觸發編輯並修改欄位
      await findEntity(page, /主桌/).getByRole('button', { name: /編輯/ }).click()
      await page.getByLabel(/桌次名稱|名稱/).fill('貴賓桌')
      await page.getByLabel(/座位數|容量/).fill('12')
      await page.getByLabel(/^X|位置 X|橫向/).fill('150')
      await page.getByLabel(/^Y|位置 Y|縱向/).fill('250')

      // 主要 outcome：API spy 驗證 PATCH .../tables/table-001
      const apiCall = waitForApiCall(page, /\/tables\/table-001(\?|$)/, 'PATCH')
      await page.getByRole('button', { name: /儲存|更新|送出|確定/ }).click()
      const request = await apiCall
      expect(request.postDataJSON()).toMatchObject({
        tableName: '貴賓桌',
        capacity: 12,
        positionX: 150,
        positionY: 250,
      })

      // Then：能讀到新名稱「貴賓桌」
      await expect(findEntity(page, /貴賓桌/)).toBeVisible()
    })
  })

  test.describe('規則：更新不存在的桌次', () => {
    test('桌次不存在', async ({ page }) => {
      // 性質：API 邊界保護
      const res = await page.request.patch(
        '/api/v1/weddings/wedding-001/tables/table-999',
        { data: { tableName: '不存在' } },
      )
      expect(res.status()).toBe(404)
      expect(JSON.stringify(await res.json())).toContain('桌次不存在')
    })
  })

  test.describe('規則：成功移除桌次', () => {
    test('成功移除桌次', async ({ page }) => {
      // Given：table-001（主桌）存在且無人入座
      await page.goto(SEATING_URL, { waitUntil: 'networkidle' })

      // When：在 table-001 範圍觸發移除並完成確認
      const apiCall = waitForApiCall(page, /\/tables\/table-001(\?|$)/, 'DELETE')
      await findEntity(page, /主桌/).getByRole('button', { name: /移除|刪除/ }).click()
      await maybeConfirm(page)

      // Then：DELETE 端點被呼叫，主桌不再可見
      await apiCall
      await expect(getFeedbackElement(page)).toBeVisible()
      await expect(findEntity(page, /^主桌/)).not.toBeVisible()
    })
  })

  test.describe('規則：移除不存在的桌次', () => {
    test('桌次不存在', async ({ page }) => {
      // 性質：API 邊界保護
      const res = await page.request.delete(
        '/api/v1/weddings/wedding-001/tables/table-999',
      )
      expect(res.status()).toBe(404)
      expect(JSON.stringify(await res.json())).toContain('桌次不存在')
    })
  })

  test.describe('規則：桌次上還有賓客', () => {
    test('桌次上還有賓客時拒絕移除', async ({ page }) => {
      // Given：table-001 已有 guest-001 入座（先用 API 安排）
      const seat = await page.request.post(
        '/api/v1/weddings/wedding-001/tables/table-001/seats',
        { data: { guestId: 'guest-001', seatNumber: 1 } },
      )
      expect(seat.ok()).toBeTruthy()
      await page.goto(SEATING_URL, { waitUntil: 'networkidle' })

      // When：在 table-001 範圍觸發移除並（若有）確認
      await findEntity(page, /主桌/).getByRole('button', { name: /移除|刪除/ }).click()
      await maybeConfirm(page)

      // Then：使用者看到錯誤訊息；主桌仍存在
      await expect(page.getByText(/桌次上還有賓客，無法移除/)).toBeVisible()
      // 關閉確認框後（modal 開啟時背景對 a11y 樹隱藏），主桌仍存在
      await page.getByTestId('confirm-cancel').click()
      await expect(findEntity(page, /主桌/)).toBeVisible()
    })
  })
})

// =====================================================================
// 座位安排
// =====================================================================
test.describe('座位安排（Admin 端）', () => {
  test.describe('規則：成功安排座位', () => {
    test('成功安排座位', async ({ page }) => {
      // Given：table-001（主桌 / 10 座）存在且有空位
      await page.goto(SEATING_URL, { waitUntil: 'networkidle' })

      // When：以表單將 guest-001 安排至 table-001 的座位 1
      await page.getByRole('button', { name: /安排座位|安排/ }).first().click()
      await selectOption(page, 'seat-guest-select', /陳大明/)
      await selectOption(page, 'seat-table-select', /主桌/)
      await page.getByLabel(/座位號/).fill('1')

      // 主要 outcome：API spy 驗證 POST .../tables/table-001/seats
      const apiCall = waitForApiCall(page, /\/tables\/table-001\/seats(\?|$)/, 'POST')
      await page.getByRole('button', { name: /安排|送出|確定/ }).click()
      const request = await apiCall
      expect(request.postDataJSON()).toMatchObject({
        guestId: 'guest-001',
        seatNumber: 1,
      })

      // Then：guest-001 顯示為已入座於 table-001
      const tableEntity = findEntity(page, /主桌/)
      await expect(tableEntity.getByText(/陳大明/)).toBeVisible()
    })
  })

  test.describe('規則：安排座位時桌次不存在', () => {
    test('桌次不存在', async ({ page }) => {
      // 性質：API 邊界保護
      const res = await page.request.post(
        '/api/v1/weddings/wedding-001/tables/table-999/seats',
        { data: { guestId: 'guest-001', seatNumber: 1 } },
      )
      expect(res.status()).toBe(404)
      expect(JSON.stringify(await res.json())).toContain('桌次不存在')
    })
  })

  test.describe('規則：桌次已滿', () => {
    test('桌次已滿時拒絕安排', async ({ page }) => {
      // Given：table-001（capacity 12）已坐滿 12 位賓客（guest-001 ~ guest-012）
      for (let i = 1; i <= 12; i++) {
        const guestId = `guest-${String(i).padStart(3, '0')}`
        const res = await page.request.post(
          '/api/v1/weddings/wedding-001/tables/table-001/seats',
          { data: { guestId, seatNumber: i } },
        )
        expect(res.ok()).toBeTruthy()
      }
      await page.goto(SEATING_URL, { waitUntil: 'networkidle' })

      // When：嘗試將 guest-013（趙建國）安排至已滿的 table-001
      await page.getByRole('button', { name: /安排座位|安排/ }).first().click()
      await selectOption(page, 'seat-guest-select', /趙建國/)
      await selectOption(page, 'seat-table-select', /主桌/)
      await page.getByLabel(/座位號/).fill('13')
      await page.getByRole('button', { name: /安排|送出|確定/ }).click()

      // Then：使用者看到錯誤訊息
      await expect(page.getByText(/桌次已滿，無法再安排座位/)).toBeVisible()
    })
  })

  test.describe('規則：賓客已有座位', () => {
    test('賓客已有座位時拒絕安排', async ({ page }) => {
      // Given：guest-001（陳大明）已在 table-001 入座
      const seat = await page.request.post(
        '/api/v1/weddings/wedding-001/tables/table-001/seats',
        { data: { guestId: 'guest-001', seatNumber: 1 } },
      )
      expect(seat.ok()).toBeTruthy()
      await page.goto(SEATING_URL, { waitUntil: 'networkidle' })

      // When：嘗試再次將 guest-001 安排至 table-001 的另一座位
      await page.getByRole('button', { name: /安排座位|安排/ }).first().click()
      await selectOption(page, 'seat-guest-select', /陳大明/)
      await selectOption(page, 'seat-table-select', /主桌/)
      await page.getByLabel(/座位號/).fill('2')
      await page.getByRole('button', { name: /安排|送出|確定/ }).click()

      // Then：使用者看到錯誤訊息
      await expect(page.getByText(/賓客已有座位/)).toBeVisible()
    })
  })

  test.describe('規則：成功取消座位', () => {
    test('成功取消座位', async ({ page }) => {
      // Given：guest-001 已在 table-001（座位 3）入座
      const seat = await page.request.post(
        '/api/v1/weddings/wedding-001/tables/table-001/seats',
        { data: { guestId: 'guest-001', seatNumber: 3 } },
      )
      expect(seat.ok()).toBeTruthy()
      await page.goto(SEATING_URL, { waitUntil: 'networkidle' })

      // When：在 table-001 範圍對 guest-001 觸發取消座位
      const apiCall = waitForApiCall(
        page,
        /\/tables\/table-001\/seats\/guest-001(\?|$)/,
        'DELETE',
      )
      await findEntity(page, /主桌/)
        .getByRole('button', { name: /取消座位|取消入座|移除座位/ })
        .first()
        .click()
      // 取消座位確認框：直接點確認按鈕（confirm-label「取消座位」不符 maybeConfirm 動詞 regex）
      await page.getByTestId('confirm-ok').click()

      // Then：unseat 端點被呼叫，guest-001 不再顯示於 table-001
      await apiCall
      await expect(getFeedbackElement(page)).toBeVisible()
      await expect(findEntity(page, /主桌/).getByText(/陳大明/)).not.toBeVisible()
    })
  })

  test.describe('規則：取消座位時桌次不存在', () => {
    test('桌次不存在', async ({ page }) => {
      // 性質：API 邊界保護
      const res = await page.request.delete(
        '/api/v1/weddings/wedding-001/tables/table-999/seats/guest-001',
      )
      expect(res.status()).toBe(404)
      expect(JSON.stringify(await res.json())).toContain('桌次不存在')
    })
  })

  test.describe('規則：賓客不在此桌', () => {
    test('賓客不在此桌', async ({ page }) => {
      // 性質：API 邊界保護（table-001 存在但 guest-999 未入座）
      const res = await page.request.delete(
        '/api/v1/weddings/wedding-001/tables/table-001/seats/guest-999',
      )
      expect(res.status()).toBe(404)
      expect(JSON.stringify(await res.json())).toContain('賓客不在此桌')
    })
  })
})

// =====================================================================
// 場地佈局
// =====================================================================
test.describe('場地佈局（Admin 端）', () => {
  test.describe('規則：成功設定場地佈局', () => {
    test('成功設定場地佈局', async ({ page }) => {
      // Given：wedding-001 已建立
      await page.goto(SEATING_URL, { waitUntil: 'networkidle' })

      // When：觸發設定場地佈局 / 舞台並設定尺寸與位置
      await page.getByRole('button', { name: /設定場地佈局|設定佈局|場地佈局|舞台/ }).click()
      await page.getByLabel(/舞台寬度|寬度/).fill('300')
      await page.getByLabel(/舞台高度|高度/).fill('150')
      await page.getByLabel(/舞台位置 X|舞台 X|^X/).fill('500')
      await page.getByLabel(/舞台位置 Y|舞台 Y|^Y/).fill('100')

      // 主要 outcome：API spy 驗證 PUT .../venue-layout
      const apiCall = waitForApiCall(page, /\/venue-layout(\?|$)/, 'PUT')
      await page.getByRole('button', { name: /儲存|送出|確定|設定/ }).click()
      const request = await apiCall
      expect(request.postDataJSON()).toMatchObject({
        stageWidth: 300,
        stageHeight: 150,
        stagePositionX: 500,
        stagePositionY: 100,
      })

      // Then：使用者能感知舞台已設定
      await expect(getFeedbackElement(page)).toBeVisible()
    })
  })

  test.describe('規則：設定場地佈局時婚禮不存在', () => {
    test('婚禮不存在', async ({ page }) => {
      // 性質：API 邊界保護
      const res = await page.request.put(
        '/api/v1/weddings/wedding-999/venue-layout',
        { data: { stageWidth: 300, stageHeight: 150, stagePositionX: 500, stagePositionY: 100 } },
      )
      expect(res.status()).toBe(404)
      expect(JSON.stringify(await res.json())).toContain('婚禮不存在')
    })
  })
})

// =====================================================================
// 禮俗設定
// =====================================================================
test.describe('禮俗設定（Admin 端）', () => {
  test.describe('規則：成功更新禮俗設定', () => {
    test('成功更新禮俗設定', async ({ page }) => {
      // Given：wedding-001 已建立
      await page.goto(SEATING_URL, { waitUntil: 'networkidle' })

      // When：進入禮俗設定入口並切換開關
      await page.getByRole('button', { name: /禮俗設定|禮俗建議|設定禮俗/ }).click()

      // 主要 outcome：API spy 驗證 PUT .../etiquette-settings，payload 含五個布林開關
      const apiCall = waitForApiCall(page, /\/etiquette-settings(\?|$)/, 'PUT')
      await page.getByRole('button', { name: /儲存|送出|確定|更新/ }).click()
      const request = await apiCall
      const payload = request.postDataJSON()
      expect(payload).toMatchObject({
        elderNearMain: expect.any(Boolean),
        conflictWarning: expect.any(Boolean),
        genderSeparation: expect.any(Boolean),
        mainTableNearStage: expect.any(Boolean),
        sameCategoryTogether: expect.any(Boolean),
      })

      // Then：使用者能感知設定已儲存
      await expect(getFeedbackElement(page)).toBeVisible()
    })
  })

  test.describe('規則：更新禮俗設定時婚禮不存在', () => {
    test('婚禮不存在', async ({ page }) => {
      // 性質：API 邊界保護
      const res = await page.request.put(
        '/api/v1/weddings/wedding-999/etiquette-settings',
        {
          data: {
            elderNearMain: true,
            conflictWarning: true,
            genderSeparation: true,
            mainTableNearStage: true,
            sameCategoryTogether: false,
          },
        },
      )
      expect(res.status()).toBe(404)
      expect(JSON.stringify(await res.json())).toContain('婚禮不存在')
    })
  })
})

// =====================================================================
// 禮俗警告覆寫
// =====================================================================
test.describe('禮俗警告（Admin 端）', () => {
  test.describe('規則：成功覆寫禮俗警告', () => {
    test('成功覆寫禮俗警告', async ({ page }) => {
      // Given：wedding-001 已建立，存在未處理的禮俗警告 warning-001
      await page.goto(SEATING_URL, { waitUntil: 'networkidle' })

      // When：在 warning-001 範圍觸發忽略 / 覆寫此警告
      const warningEntity = page.getByRole('alert', { name: /男女分桌/ })
      await expect(warningEntity).toBeVisible()
      const apiCall = waitForApiCall(
        page,
        /\/etiquette-warnings\/warning-001\/dismiss(\?|$)/,
        'POST',
      )
      await warningEntity.getByRole('button', { name: /忽略|覆寫/ }).click()
      await maybeConfirm(page)
      const request = await apiCall
      expect(request.postDataJSON()).toMatchObject({
        warningType: 'gender-separation',
      })

      // Then：warning-001 不再以未處理狀態顯示
      await apiCall
      await expect(getFeedbackElement(page)).toBeVisible()
    })
  })

  test.describe('規則：覆寫禮俗警告時婚禮不存在', () => {
    test('婚禮不存在', async ({ page }) => {
      // 性質：API 邊界保護
      const res = await page.request.post(
        '/api/v1/weddings/wedding-999/etiquette-warnings/warning-001/dismiss',
        { data: { warningType: 'gender-separation' } },
      )
      expect(res.status()).toBe(404)
      expect(JSON.stringify(await res.json())).toContain('婚禮不存在')
    })
  })
})
