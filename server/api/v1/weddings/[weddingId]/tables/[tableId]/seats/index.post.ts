import type { H3Event } from 'h3'
import type { GuestSeatedEvent, SeatGuestBody } from '../../../../../../../../app/types/api/seating'

import { and, eq } from 'drizzle-orm'

import { useDb } from '../../../../../../../db'
import { guests, seatingTables, seats } from '../../../../../../../db/schema'

export default defineEventHandler(async (event: H3Event): Promise<GuestSeatedEvent> => {
  const tableId = getRouterParam(event, 'tableId')!
  const weddingId = getRouterParam(event, 'weddingId')!
  const body = await readBody<SeatGuestBody>(event)

  const db = useDb()
  const [table] = await db.select().from(seatingTables).where(and(eq(seatingTables.weddingId, weddingId), eq(seatingTables.tableId, tableId)))
  if (!table) {
    throw createError({ statusCode: 404, statusMessage: '桌次不存在' })
  }
  const [alreadySeated] = await db.select().from(seats).where(eq(seats.guestId, body.guestId))
  if (alreadySeated) {
    throw createError({ statusCode: 409, statusMessage: '賓客已有座位' })
  }
  // 容量規則（人頭）：正常席人頭 = partySize − childChairCount，至多坐滿 capacity；
  // 兒童椅嬰兒不佔正常席、該桌額外加位（不受 capacity 限制）
  const [guest] = await db.select().from(guests).where(and(eq(guests.weddingId, weddingId), eq(guests.guestId, body.guestId)))
  if (!guest) {
    throw createError({ statusCode: 404, statusMessage: '賓客不存在' })
  }
  const partySize = guest.partySize
  const childChairCount = guest.childChairCount
  const normalHeads = Math.max(0, partySize - childChairCount)
  const existingNormalRows = await db.select().from(seats).where(and(eq(seats.tableId, tableId), eq(seats.seatType, 'normal')))
  if (existingNormalRows.length + normalHeads > table.capacity) {
    throw createError({ statusCode: 409, statusMessage: '桌次已滿，無法再安排座位' })
  }

  // 將一組賓客展開為多筆座位：正常席 N 筆 + 兒童椅 M 筆，座號接續該桌現有最大座號
  const tableSeats = await db.select().from(seats).where(eq(seats.tableId, tableId))
  const maxSeat = tableSeats.reduce((m, s) => Math.max(m, s.seatNumber), 0)
  let seatNo = Math.max(body.seatNumber || 1, maxSeat + 1)
  const newSeats: typeof seats.$inferInsert[] = []
  for (let i = 1; i <= normalHeads; i++) {
    newSeats.push({ tableId, guestId: body.guestId, seatNumber: seatNo, seatType: 'normal', partyIndex: i })
    seatNo++
  }
  for (let i = 1; i <= childChairCount; i++) {
    newSeats.push({ tableId, guestId: body.guestId, seatNumber: seatNo, seatType: 'childChair', partyIndex: i })
    seatNo++
  }
  if (newSeats.length) {
    await db.insert(seats).values(newSeats)
  }

  setResponseStatus(event, 201)
  return { tableId, guestId: body.guestId, seatNumber: body.seatNumber }
})
