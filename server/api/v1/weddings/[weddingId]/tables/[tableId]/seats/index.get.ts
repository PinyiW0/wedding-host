import type { H3Event } from 'h3'
import type { SeatListItem } from '../../../../../../../../app/types/api/seating'

import { and, asc, eq } from 'drizzle-orm'

import { useDb } from '../../../../../../../db'
import { seatingTables, seats } from '../../../../../../../db/schema'

export default defineEventHandler(async (event: H3Event): Promise<SeatListItem[]> => {
  const tableId = getRouterParam(event, 'tableId')!
  const weddingId = getRouterParam(event, 'weddingId')!
  const db = useDb()
  const [table] = await db.select().from(seatingTables).where(and(eq(seatingTables.weddingId, weddingId), eq(seatingTables.tableId, tableId)))
  if (!table) {
    throw createError({ statusCode: 404, statusMessage: '桌次不存在' })
  }
  const rows = await db.select().from(seats).where(eq(seats.tableId, tableId)).orderBy(asc(seats.seq))
  return rows.map(s => ({
    guestId: s.guestId,
    tableId: s.tableId,
    seatNumber: s.seatNumber,
    seatType: s.seatType,
    partyIndex: s.partyIndex,
  }))
})
