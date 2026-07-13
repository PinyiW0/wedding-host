import type { H3Event } from 'h3'
import type { SeatListItem } from '../../../../../../app/types/api/seating'

import { asc, eq } from 'drizzle-orm'

import { useDb } from '../../../../../db'
import { seatingTables, seats } from '../../../../../db/schema'

// 一次回整場婚禮的座位（取代前端逐桌 N 請求）；
// seats 本身無 weddingId，join seatingTables 以路徑 weddingId 圈範圍（防跨婚禮越權）
export default defineEventHandler(async (event: H3Event): Promise<SeatListItem[]> => {
  const weddingId = getRouterParam(event, 'weddingId')!
  const db = useDb()
  const rows = await db.select({
    guestId: seats.guestId,
    tableId: seats.tableId,
    seatNumber: seats.seatNumber,
    seatType: seats.seatType,
    partyIndex: seats.partyIndex,
  }).from(seats).innerJoin(seatingTables, eq(seats.tableId, seatingTables.tableId)).where(eq(seatingTables.weddingId, weddingId)).orderBy(asc(seats.seq))
  return rows
})
