import type { H3Event } from 'h3'
import type { MoveSeatBody, SeatMovedEvent } from '../../../../../../app/types/api/seating'

import { and, eq, inArray } from 'drizzle-orm'

import { useDb } from '../../../../../db'
import { seatingTables, seats } from '../../../../../db/schema'

// 單席移動／互換：以「席位」為粒度，一組賓客的大人、兒童椅席可各自移動
// 目標座號有人＝互換兩席；沒人＝移入；未帶目標座號＝接續目標桌下一個空號
export default defineEventHandler(async (event: H3Event): Promise<SeatMovedEvent> => {
  const weddingId = getRouterParam(event, 'weddingId')!
  const body = await readBody<MoveSeatBody>(event)

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

  // 容量檢查（人頭）：正常席跨桌移入多佔 1 人頭；互換若換出的也是正常席則守恆
  if (body.fromTableId !== body.toTableId) {
    const targetNormal = targetSeats.filter(s => s.seatType === 'normal').length
    const inbound = source.seatType === 'normal' ? 1 : 0
    const outbound = target?.seatType === 'normal' ? 1 : 0
    if (targetNormal + inbound - outbound > toTable.capacity) {
      throw createError({ statusCode: 409, statusMessage: '桌次已滿，無法再安排座位' })
    }
  }

  await db.update(seats)
    .set({ tableId: body.toTableId, seatNumber: toSeatNumber })
    .where(eq(seats.seq, source.seq))
  if (target) {
    await db.update(seats)
      .set({ tableId: body.fromTableId, seatNumber: body.fromSeatNumber })
      .where(eq(seats.seq, target.seq))
  }

  return {
    fromTableId: body.fromTableId,
    fromSeatNumber: body.fromSeatNumber,
    toTableId: body.toTableId,
    toSeatNumber,
    swapped: !!target,
  }
})
