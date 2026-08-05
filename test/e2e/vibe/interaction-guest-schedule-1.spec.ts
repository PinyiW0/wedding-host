// Source: app/pages/schedule/[weddingId].vue + 後台流程表「賓客」欄 + useGuestNav（issue #142）
// Pattern: new-region（賓客版流程頁）+ interaction（後台勾選決定對外可見）
//
// 分工：/rundown 是工作人員版（全欄位），/schedule 是賓客版（只有時間、事項、場地），
// 兩者讀同一份 rundown-items，差別在 guestVisible 過濾與欄位裁切。

import { expect, test } from '@playwright/test'

import { findEntity, login, resetMockData, TestUsers, waitForApiCall } from '../helpers'

const WEDDING_ID = 'wedding-001'
const RUNDOWN_PATH = `/weddings/${WEDDING_ID}/rundown`
const SCHEDULE_PATH = `/schedule/${WEDDING_ID}`
const ITEMS_API = `/api/v1/weddings/${WEDDING_ID}/rundown-items`

// 兩列：一列對賓客公開、一列僅工作人員可見（seed 的內部段落語意）
const MIXED_ITEMS = {
  items: [
    {
      time: '18:30',
      durationMinutes: 30,
      title: '迎賓・收禮金',
      location: '宴會廳入口',
      supplies: '禮金簿、簽名綢',
      note: '禮金桌兩人輪值',
      roleTasks: [{ roleId: 'role-001', task: '簽到、禮金點收' }],
      guestVisible: true,
    },
    {
      time: '16:30',
      durationMinutes: 20,
      title: '新娘物品點交',
      location: '新娘房',
      supplies: '婚紗配件、備用鞋',
      guestVisible: false,
    },
  ],
}

test.describe('vibe：賓客版當日流程', () => {
  test.beforeEach(async ({ page }) => {
    await resetMockData(page)
  })

  test.describe('後台勾選賓客可見', () => {
    test.beforeEach(async ({ page }) => {
      await login(page, TestUsers.admin.account, TestUsers.admin.password)
    })

    test('勾選後儲存，PUT payload 帶 guestVisible', async ({ page }) => {
      // Given：進入流程表，seed 為唯一一列（預設不對賓客公開）
      await page.goto(RUNDOWN_PATH, { waitUntil: 'networkidle' })
      await expect(page.getByTestId('vibe-rundown-row-guest').nth(0)).toHaveAttribute('aria-pressed', 'false')

      // When：勾選該列的「賓客」欄後儲存
      await page.getByTestId('vibe-rundown-row-guest').nth(0).click()
      const apiCall = waitForApiCall(page, /\/rundown-items(\?|$)/, 'PUT')
      await page.getByTestId('rundown-save').click()
      const request = await apiCall

      // Then：payload 該列帶 guestVisible: true
      const items = request.postDataJSON().items
      expect(items[0]).toMatchObject({ title: '新娘物品點交', guestVisible: true })
    })

    test('儲存後重整，勾選狀態保留', async ({ page }) => {
      await page.goto(RUNDOWN_PATH, { waitUntil: 'networkidle' })
      await page.getByTestId('vibe-rundown-row-guest').nth(0).click()

      // 等 PUT 回應完成才 reload，避免搶在寫入前重讀
      const saved = page.waitForResponse(res =>
        /\/rundown-items(?:\?|$)/.test(res.url()) && res.request().method() === 'PUT' && res.status() === 200)
      await page.getByTestId('rundown-save').click()
      await saved

      await page.reload({ waitUntil: 'networkidle' })
      await expect(page.getByTestId('vibe-rundown-row-guest').nth(0)).toHaveAttribute('aria-pressed', 'true')
    })

    test('拖曳換列：賓客可見狀態跟著內容一起搬', async ({ page }) => {
      // Given：三列，只有最後一列（14:00）對賓客公開
      await page.request.put(ITEMS_API, {
        data: {
          items: [
            { time: '12:00', durationMinutes: 30, title: '工作人員集合', guestVisible: false },
            { time: '13:00', durationMinutes: 30, title: '場地佈置', guestVisible: false },
            { time: '14:00', durationMinutes: 30, title: '賓客入場', guestVisible: true },
          ],
        },
      })
      await page.goto(RUNDOWN_PATH, { waitUntil: 'networkidle' })

      const toggles = page.getByTestId('vibe-rundown-row-guest')
      await expect(toggles.nth(0)).toHaveAttribute('aria-pressed', 'false')
      await expect(toggles.nth(2)).toHaveAttribute('aria-pressed', 'true')

      // When：把第三列拖到第一列（拖曳搬的是內容，時間格不動）
      const handles = page.getByTestId('rundown-row-drag')
      const from = (await handles.nth(2).boundingBox())!
      const to = (await handles.nth(0).boundingBox())!
      await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2)
      await page.mouse.down()
      await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 10 })
      await page.mouse.up()

      // Then：內容與賓客可見狀態一起搬到第一列，原位置回到未公開
      await expect(page.getByTestId('rundown-cell-title').nth(0)).toHaveValue('賓客入場')
      await expect(toggles.nth(0)).toHaveAttribute('aria-pressed', 'true')
      await expect(toggles.nth(2)).toHaveAttribute('aria-pressed', 'false')
    })

    test('「預覽賓客版」連到賓客版流程頁', async ({ page }) => {
      await page.goto(RUNDOWN_PATH, { waitUntil: 'networkidle' })

      const preview = page.getByTestId('vibe-rundown-preview-guest')
      await expect(preview).toHaveAttribute('href', `/schedule/${WEDDING_ID}`)
      await expect(preview).toHaveAttribute('target', '_blank')
    })

    test('帶入宴客段範本：賓客在場的段落預設已勾選，籌備與換裝段沒有', async ({ page }) => {
      await page.goto(RUNDOWN_PATH, { waitUntil: 'networkidle' })

      await page.getByTestId('rundown-apply-template').click()
      await page.getByLabel(/開始時間/).fill('18:00')
      await page.getByRole('dialog').getByRole('button', { name: /帶入|套用/ }).click()

      // seed 1 列 + 範本 8 段；範本段落順序見 app/utils/rundownTemplate.ts
      await expect(page.getByTestId('rundown-cell-title')).toHaveCount(9)
      const guestToggles = page.getByTestId('vibe-rundown-row-guest')
      await expect(guestToggles.nth(1)).toHaveAttribute('aria-pressed', 'false') // 彩排・設備確認
      await expect(guestToggles.nth(2)).toHaveAttribute('aria-pressed', 'true') // 迎賓・收禮金
      await expect(guestToggles.nth(5)).toHaveAttribute('aria-pressed', 'false') // 退場換裝
      await expect(guestToggles.nth(8)).toHaveAttribute('aria-pressed', 'true') // 送客・合照
    })
  })

  test.describe('賓客版公開頁（免登入）', () => {
    test('只呈現勾選為賓客可見的時段', async ({ page }) => {
      await page.request.put(ITEMS_API, { data: MIXED_ITEMS })

      await page.goto(SCHEDULE_PATH, { waitUntil: 'networkidle' })

      await expect(page.getByTestId('public-schedule')).toBeVisible()
      await expect(findEntity(page, /迎賓・收禮金/)).toBeVisible()
      await expect(findEntity(page, /迎賓・收禮金/)).toContainText('18:30')
      await expect(findEntity(page, /迎賓・收禮金/)).toContainText('宴會廳入口')
      // 未勾選的內部段落不外流
      await expect(page.getByText('新娘物品點交')).toHaveCount(0)
    })

    test('不呈現工作人員欄位（物品／備註／角色個別事項）', async ({ page }) => {
      await page.request.put(ITEMS_API, { data: MIXED_ITEMS })

      await page.goto(SCHEDULE_PATH, { waitUntil: 'networkidle' })

      await expect(page.getByText('禮金簿、簽名綢')).toHaveCount(0)
      await expect(page.getByText('禮金桌兩人輪值')).toHaveCount(0)
      await expect(page.getByText('簽到、禮金點收')).toHaveCount(0)
    })

    test('沒有任何對賓客公開的時段時顯示空狀態', async ({ page }) => {
      // seed 唯一一列預設不公開
      await page.goto(SCHEDULE_PATH, { waitUntil: 'networkidle' })

      await expect(page.getByTestId('public-schedule')).toBeVisible()
      await expect(page.getByText('流程準備中')).toBeVisible()
    })

    test('賓客導覽列的流程入口導向賓客版而非工作人員版', async ({ page }) => {
      await page.goto(`/rundown/${WEDDING_ID}`, { waitUntil: 'networkidle' })

      await page.getByTestId('vibe-guest-nav').getByTestId('vibe-guest-nav-item-rundown').click()
      await page.waitForURL(`**/schedule/${WEDDING_ID}**`)

      await expect(page.getByTestId('public-schedule')).toBeVisible()
    })
  })
})
