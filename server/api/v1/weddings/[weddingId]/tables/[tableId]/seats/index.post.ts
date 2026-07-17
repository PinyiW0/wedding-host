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
  // 婉拒者不進排桌次（issue #96）：API 層也擋，避免繞過 UI 直接入座
  if (guest.rsvpAttending === 'declined') {
    throw createError({ statusCode: 409, statusMessage: '賓客已婉拒出席，無法安排座位' })
  }
  const partySize = guest.partySize
  const childChairCount = guest.childChairCount
  const normalHeads = Math.max(0, partySize - childChairCount)
  const existingNormalRows = await db.select().from(seats).where(and(eq(seats.tableId, tableId), eq(seats.seatType, 'normal')))
  if (existingNormalRows.length + normalHeads > table.capacity) {
    throw createError({ statusCode: 409, statusMessage: '桌次已滿，無法再安排座位' })
  }

  // 將一組賓客展開為多筆座位：正常席 N 筆 + 兒童椅 M 筆
  // 座號自指定起點往上找空號填入（填補中途空出的座號，避免座號無限膨脹、座位環增生）
  const tableSeats = await db.select().from(seats).where(eq(seats.tableId, tableId))
  const occupied = new Set(tableSeats.map(s => s.seatNumber))
  let seatNo = Math.max(1, body.seatNumber || 1)
  const nextFreeSeatNo = () => {
    while (occupied.has(seatNo))
      seatNo++
    occupied.add(seatNo)
    return seatNo
  }
  const newSeats: typeof seats.$inferInsert[] = []
  for (let i = 1; i <= normalHeads; i++) {
    newSeats.push({ tableId, guestId: body.guestId, seatNumber: nextFreeSeatNo(), seatType: 'normal', partyIndex: i })
  }
  for (let i = 1; i <= childChairCount; i++) {
    newSeats.push({ tableId, guestId: body.guestId, seatNumber: nextFreeSeatNo(), seatType: 'childChair', partyIndex: i })
  }
  if (newSeats.length) {
    await db.insert(seats).values(newSeats)
  }

  setResponseStatus(event, 201)
  return { tableId, guestId: body.guestId, seatNumber: body.seatNumber }
})
