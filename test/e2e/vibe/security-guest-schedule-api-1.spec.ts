// Source: issue #190 — server/api/v1/weddings/[weddingId]/guest-schedule.get.ts（賓客版流程端點，無 UI 新增）
// Pattern: security-guard——回應投影白名單。賓客版頁面只顯示時間／事項／場地，
//   若端點退回「整列都送」，畫面測試照樣綠燈，所以直接驗 API 回應的欄位與列。
//   gate 於 open 模式跑：page.request 無 token 退回預設管理員，即模擬管理端登入態寫入流程表。

import { expect, test } from '@playwright/test'

import { resetMockData } from '../helpers'

const WEDDING = 'wedding-001'
const ITEMS_API = `/api/v1/weddings/${WEDDING}/rundown-items`
const SCHEDULE_API = `/api/v1/weddings/${WEDDING}/guest-schedule`

// 賓客版回應只允許這六個欄位（rundownItemId 為列表 key）
const PUBLIC_KEYS = ['durationMinutes', 'highlight', 'location', 'rundownItemId', 'time', 'title']

test.describe('vibe：賓客版流程 API 只回賓客可見時段的公開欄位（issue #190）', () => {
  test.beforeEach(async ({ page }) => {
    await resetMockData(page)
  })

  test('未公開時段不回傳；公開時段只帶六個公開欄位，工作人員欄位不外流', async ({ page }) => {
    // Given：一列只給工作人員、一列對賓客公開，兩列都填滿物品／備註／角色事項
    const put = await page.request.put(ITEMS_API, {
      data: {
        items: [
          {
            time: '16:30',
            durationMinutes: 20,
            title: '工作人員集合（內部）',
            location: '後台',
            supplies: '對講機',
            note: '總召電話',
            guestVisible: false,
            roleTasks: [{ roleId: 'role-003', task: '新秘內部事項', supplies: '別針' }],
          },
          {
            time: '17:30',
            durationMinutes: 30,
            title: '賓客入場',
            location: '宴會廳入口',
            supplies: '簽名綢',
            note: '入口內部備註',
            highlight: true,
            guestVisible: true,
            roleTasks: [{ roleId: 'role-001', task: '接待內部事項', supplies: '禮金簿' }],
          },
        ],
      },
    })
    expect(put.status()).toBe(200)

    // When：讀賓客版流程
    const res = await page.request.get(SCHEDULE_API)
    expect(res.status()).toBe(200)
    const body = await res.json()

    // Then：只剩公開那一列，欄位恰好是六個公開欄位
    expect(body).toHaveLength(1)
    expect(body[0]).toMatchObject({ time: '17:30', durationMinutes: 30, title: '賓客入場', location: '宴會廳入口', highlight: true })
    expect(Object.keys(body[0]).sort()).toEqual(PUBLIC_KEYS)

    // And：回應文字裡查不到任何工作人員內容
    const raw = JSON.stringify(body)
    for (const secret of ['工作人員集合（內部）', '對講機', '總召電話', '新秘內部事項', '別針', '簽名綢', '入口內部備註', '接待內部事項', '禮金簿'])
      expect(raw).not.toContain(secret)
  })

  test('沒有任何公開時段 → 回空陣列', async ({ page }) => {
    await page.request.put(ITEMS_API, {
      data: { items: [{ time: '12:00', durationMinutes: 30, title: '場地佈置', guestVisible: false }] },
    })

    const res = await page.request.get(SCHEDULE_API)
    expect(res.status()).toBe(200)
    expect(await res.json()).toEqual([])
  })
})
