import type { H3Event } from 'h3'

import { and, eq } from 'drizzle-orm'

import { useDb } from '../../../../../../../db'
import { seatingTables, seats } from '../../../../../../../db/schema'
import { assertSeatingCapacity, seatingDietLookup } from '../../../../../../../utils/seating-capacity'

export default defineEventHandler(async (event: H3Event): Promise<void> => {
  const tableId = getRouterParam(event, 'tableId')!
  const guestId = getRouterParam(event, 'guestId')!
  const weddingId = getRouterParam(event, 'weddingId')!

  const db = useDb()
  const [table] = await db.select().from(seatingTables).where(and(eq(seatingTables.weddingId, weddingId), eq(seatingTables.tableId, tableId)))
  if (!table) {
    throw createError({ statusCode: 404, statusMessage: '桌次不存在' })
  }
  // 指定 seatNumber 只取消該成員；未指定時保留整組取消（供整桌重置）。
  const querySeat = getQuery(event).seatNumber
  const seatNumber = querySeat === undefined ? undefined : Number(querySeat)
  if (seatNumber !== undefined && (!Number.isSafeInteger(seatNumber) || seatNumber < 1))
    throw createError({ statusCode: 400, statusMessage: '座位號須為正整數' })
  const tableSeats = await db.select().from(seats).where(eq(seats.tableId, tableId))
  const matches = (s: typeof seats.$inferSelect) => s.guestId === guestId && (seatNumber === undefined || s.seatNumber === seatNumber)
  if (!tableSeats.some(matches))
    throw createError({ statusCode: 404, statusMessage: '賓客不在此桌' })
  const dietOf = await seatingDietLookup(db, weddingId)
  assertSeatingCapacity(tableSeats.filter(s => !matches(s)), table.capacity, dietOf)
  await db.delete(seats).where(and(
    eq(seats.tableId, tableId),
    eq(seats.guestId, guestId),
    seatNumber === undefined ? undefined : eq(seats.seatNumber, seatNumber),
  ))
  await clearSeatReleasedMark(db, guestId)

  setResponseStatus(event, 204)
})
