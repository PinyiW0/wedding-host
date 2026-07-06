import type { H3Event } from 'h3'
import type { DashboardStats } from '../../../../../app/types/api/dashboard'

import { eq } from 'drizzle-orm'

import { useDb } from '../../../../db'
import { guests } from '../../../../db/schema'

// 儀表板聚合統計（issue #11）：單次撈出該婚禮全部賓客後於 JS 聚合
// （婚禮規模數百組以內，不需 SQL 聚合；規則與 guests 頁 stats bar 一致）
export default defineEventHandler(async (event: H3Event): Promise<DashboardStats> => {
  const weddingId = getRouterParam(event, 'weddingId')!
  const db = useDb()
  const rows = await db.select({
    rsvpAttending: guests.rsvpAttending,
    partySize: guests.partySize,
    childChairCount: guests.childChairCount,
    diet: guests.diet,
    checkedInAt: guests.checkedInAt,
    giftAmount: guests.giftAmount,
    status: guests.status,
    deletedAt: guests.deletedAt,
  }).from(guests).where(eq(guests.weddingId, weddingId))

  // 正式名單：未軟刪且非待審核（與 guests 列表端點的母集一致）
  const active = rows.filter(g => !g.deletedAt && g.status !== 'pending_review')
  const attendingRows = active.filter(g => g.rsvpAttending === 'attending')
  const attending = attendingRows.length
  const declined = active.filter(g => g.rsvpAttending === 'declined').length
  const giftRows = active.filter(g => g.giftAmount != null)

  return {
    rsvp: {
      totalGroups: active.length,
      attending,
      declined,
      // 未提交（null）與 absent 統一視為待回覆
      pending: active.length - attending - declined,
    },
    attendance: {
      headcount: attendingRows.reduce((sum, g) => sum + g.partySize, 0),
      adults: attendingRows.reduce((sum, g) => sum + g.partySize - g.childChairCount, 0),
      children: attendingRows.reduce((sum, g) => sum + g.childChairCount, 0),
      vegetarian: attendingRows.filter(g => g.diet === 'vegetarian').length,
    },
    checkIn: {
      checkedIn: active.filter(g => g.checkedInAt).length,
      expected: attending,
    },
    giftMoney: {
      totalAmount: giftRows.reduce((sum, g) => sum + (g.giftAmount ?? 0), 0),
      recordCount: giftRows.length,
    },
    pendingReviewCount: rows.filter(g => g.status === 'pending_review' && !g.deletedAt).length,
  }
})
