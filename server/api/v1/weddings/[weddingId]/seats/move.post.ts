import type { H3Event } from 'h3'
import type { MoveSeatBody, SeatMovedEvent } from '../../../../../../app/types/api/seating'

import { and, eq, inArray, sql } from 'drizzle-orm'

import { useDb } from '../../../../../db'
import { seatingTables, seats } from '../../../../../db/schema'
import { assertSeatingCapacity, seatingDietLookup } from '../../../../../utils/seating-capacity'

// 單席移動／互換：以「席位」為粒度，一組賓客的大人、兒童椅席可各自移動
// 目標座號有人＝互換兩席；沒人＝移入；未帶目標座號＝接續目標桌下一個空號
export default defineEventHandler(async (event: H3Event): Promise<SeatMovedEvent> => {
  const weddingId = getRouterParam(event, 'weddingId')!
  const body = await readBody<MoveSeatBody>(event)

  if (!Number.isSafeInteger(body.fromSeatNumber) || body.fromSeatNumber < 1
    || (body.toSeatNumber != null && (!Number.isSafeInteger(body.toSeatNumber) || body.toSeatNumber < 1))) {
    throw createError({ statusCode: 400, statusMessage: '座位號須為正整數' })
  }

  const db = useDb()
  const tableIds = [...new Set([body.fromTableId, body.toTableId])]
  const tables = await db.select().from(seatingTables).where(and(eq(seatingTables.weddingId, weddingId), inArray(seatingTables.tableId, tableIds)))
  if (tables.length !== tableIds.length) {
    throw createError({ statusCode: 404, statusMessage: '桌次不存在' })
  }
  const toTable = tables.find(t => t.tableId === body.toTableId)!

  const [source] = await db.select().from(seats).where(and(eq(seats.tableId, body.fromTableId), eq(seats.seatNumber, body.fromSeatNumber)))
  if (!source) {
    throw createError({ statusCode: 404, statusMessage: '席位不存在' })
  }

  // 拖回自己原位：不動
  if (body.fromTableId === body.toTableId && body.toSeatNumber === body.fromSeatNumber) {
    return { ...body, toSeatNumber: body.fromSeatNumber, swapped: false }
  }

  const targetSeats = await db.select().from(seats).where(eq(seats.tableId, body.toTableId))
  const target = body.toSeatNumber != null
    ? targetSeats.find(s => s.seatNumber === body.toSeatNumber) ?? null
    : null
  let toSeatNumber = body.toSeatNumber
  if (toSeatNumber == null) {
    const occupied = new Set(targetSeats.map(s => s.seatNumber))
    toSeatNumber = 1
    while (occupied.has(toSeatNumber))
      toSeatNumber++
  }

  // 驗證完成後的兩桌；換出最後一位葷食者也可能令來源桌變成全素超額。
  if (body.fromTableId !== body.toTableId) {
    const dietOf = await seatingDietLookup(db, weddingId)
    const sourceSeats = await db.select().from(seats).where(eq(seats.tableId, body.fromTableId))
    const afterSource = sourceSeats.filter(s => s.seq !== source.seq)
    if (target)
      afterSource.push(target)
    const afterTarget = [...targetSeats.filter(s => s.seq !== target?.seq), source]
    assertSeatingCapacity(afterSource, tables.find(t => t.tableId === body.fromTableId)!.capacity, dietOf)
    assertSeatingCapacity(afterTarget, toTable.capacity, dietOf)
  }

  // 一條 UPDATE 完成交換，避免第二次寫入失敗留下重複座位；支援 neon-http。
  if (target) {
    await db.update(seats).set({
      tableId: sql`case when ${seats.seq} = ${source.seq} then ${body.toTableId} else ${body.fromTableId} end`,
      seatNumber: sql`case when ${seats.seq} = ${source.seq} then ${toSeatNumber}::integer else ${body.fromSeatNumber}::integer end`,
    }).where(inArray(seats.seq, [source.seq, target.seq]))
  }
  else {
    await db.update(seats)
      .set({ tableId: body.toTableId, seatNumber: toSeatNumber })
      .where(eq(seats.seq, source.seq))
  }

  return {
    fromTableId: body.fromTableId,
    fromSeatNumber: body.fromSeatNumber,
    toTableId: body.toTableId,
    toSeatNumber,
    swapped: !!target,
  }
})
