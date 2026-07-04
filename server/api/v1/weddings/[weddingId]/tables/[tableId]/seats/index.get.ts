import type { H3Event } from 'h3'
import type { SeatListItem } from '../../../../../../../../app/types/api/seating'

import { asc, eq } from 'drizzle-orm'

import { useDb } from '../../../../../../../db'
import { seats } from '../../../../../../../db/schema'

export default defineEventHandler(async (event: H3Event): Promise<SeatListItem[]> => {
  const tableId = getRouterParam(event, 'tableId')!
  const db = useDb()
  const rows = await db.select().from(seats).where(eq(seats.tableId, tableId)).orderBy(asc(seats.seq))
  return rows.map(s => ({
    guestId: s.guestId,
    tableId: s.tableId,
    seatNumber: s.seatNumber,
    seatType: s.seatType,
    partyIndex: s.partyIndex,
  }))
})
