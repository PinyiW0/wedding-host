import type { H3Event } from 'h3'
import type { GuestSeatedEvent, SeatGuestBody } from '../../../../../../../../app/types/api/seating'

import { and, eq } from 'drizzle-orm'
import { remainingPartyMembers } from '../../../../../../../../app/utils/seatingRules'
import { useDb } from '../../../../../../../db'

import { guests, seatingTables, seats } from '../../../../../../../db/schema'
import { assertSeatingCapacity, seatingDietLookup } from '../../../../../../../utils/seating-capacity'

export default defineEventHandler(async (event: H3Event): Promise<GuestSeatedEvent> => {
  const tableId = getRouterParam(event, 'tableId')!
  const weddingId = getRouterParam(event, 'weddingId')!
  const body = await readBody<SeatGuestBody>(event)

  const db = useDb()
  const [table] = await db.select().from(seatingTables).where(and(eq(seatingTables.weddingId, weddingId), eq(seatingTables.tableId, tableId)))
  if (!table) {
    throw createError({ statusCode: 404, statusMessage: '桌次不存在' })
  }
  const [guest] = await db.select().from(guests).where(and(eq(guests.weddingId, weddingId), eq(guests.guestId, body.guestId)))
  if (!guest || guest.deletedAt) {
    throw createError({ statusCode: 404, statusMessage: '賓客不存在' })
  }
  // 婉拒者不進排桌次（issue #96）：API 層也擋，避免繞過 UI 直接入座
  if (guest.rsvpAttending === 'declined') {
    throw createError({ statusCode: 409, statusMessage: '賓客已婉拒出席，無法安排座位' })
  }
  const existing = await db.select().from(seats).where(eq(seats.guestId, body.guestId))
  const pending = remainingPartyMembers(guest, existing)
  if (!pending.length)
    throw createError({ statusCode: 409, statusMessage: '賓客已有座位' })
  const tableSeats = await db.select().from(seats).where(eq(seats.tableId, tableId))
  const dietOf = await seatingDietLookup(db, weddingId)
  assertSeatingCapacity([...tableSeats, ...pending], table.capacity, dietOf)

  if (!Number.isSafeInteger(body.seatNumber) || body.seatNumber < 1)
    throw createError({ statusCode: 400, statusMessage: '座位號須為正整數' })
  const occupied = new Set(tableSeats.map(s => s.seatNumber))
  let seatNo = Math.max(1, body.seatNumber || 1)
  const nextFreeSeatNo = () => {
    while (occupied.has(seatNo))
      seatNo++
    occupied.add(seatNo)
    return seatNo
  }
  const newSeats = pending.map(member => ({ ...member, tableId, seatNumber: nextFreeSeatNo() }))
  await db.insert(seats).values(newSeats)
  await clearSeatReleasedMark(db, body.guestId)

  setResponseStatus(event, 201)
  return { tableId, guestId: body.guestId, seatNumber: body.seatNumber }
})
