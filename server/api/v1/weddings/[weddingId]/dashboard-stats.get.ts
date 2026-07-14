import type { H3Event } from 'h3'
import type { DashboardStats } from '../../../../../app/types/api/dashboard'

import { eq, sql } from 'drizzle-orm'

import { useDb } from '../../../../db'
import { guests } from '../../../../db/schema'

// 儀表板聚合統計（issue #11 / #71）：改用單一 SQL 聚合（FILTER 子句）取代撈全表 JS 聚合，
// 規則與 guests 頁 stats bar 一致。母集語意：
//   active＝未軟刪且非待審核（status 為 null 視為正式賓客）
export default defineEventHandler(async (event: H3Event): Promise<DashboardStats> => {
  const weddingId = getRouterParam(event, 'weddingId')!
  const db = useDb()

  const active = sql`${guests.deletedAt} is null and (${guests.status} is null or ${guests.status} <> 'pending_review')`
  const attending = sql`(${active}) and ${guests.rsvpAttending} = 'attending'`

  const [agg] = await db.select({
    totalGroups: sql<number>`count(*) filter (where ${active})`,
    attending: sql<number>`count(*) filter (where ${attending})`,
    declined: sql<number>`count(*) filter (where (${active}) and ${guests.rsvpAttending} = 'declined')`,
    headcount: sql<number>`coalesce(sum(${guests.partySize}) filter (where ${attending}), 0)`,
    children: sql<number>`coalesce(sum(${guests.childChairCount}) filter (where ${attending}), 0)`,
    vegetarian: sql<number>`count(*) filter (where (${attending}) and ${guests.diet} = 'vegetarian')`,
    checkedIn: sql<number>`count(*) filter (where (${active}) and ${guests.checkedInAt} is not null)`,
    giftTotal: sql<number>`coalesce(sum(${guests.giftAmount}) filter (where (${active}) and ${guests.giftAmount} is not null), 0)`,
    giftCount: sql<number>`count(*) filter (where (${active}) and ${guests.giftAmount} is not null)`,
    pendingReview: sql<number>`count(*) filter (where ${guests.deletedAt} is null and ${guests.status} = 'pending_review')`,
  }).from(guests).where(eq(guests.weddingId, weddingId))

  // count/sum 於 pg 回傳 bigint（driver 給字串），一律 Number() 收斂為數字
  const n = (v: unknown): number => Number(v ?? 0)
  const totalGroups = n(agg?.totalGroups)
  const attendingCount = n(agg?.attending)
  const declined = n(agg?.declined)
  const headcount = n(agg?.headcount)
  const children = n(agg?.children)

  return {
    rsvp: {
      totalGroups,
      attending: attendingCount,
      declined,
      // 未提交（null）與 absent 統一視為待回覆
      pending: totalGroups - attendingCount - declined,
    },
    attendance: {
      headcount,
      adults: headcount - children,
      children,
      vegetarian: n(agg?.vegetarian),
    },
    checkIn: {
      checkedIn: n(agg?.checkedIn),
      expected: attendingCount,
    },
    giftMoney: {
      totalAmount: n(agg?.giftTotal),
      recordCount: n(agg?.giftCount),
    },
    pendingReviewCount: n(agg?.pendingReview),
  }
})
