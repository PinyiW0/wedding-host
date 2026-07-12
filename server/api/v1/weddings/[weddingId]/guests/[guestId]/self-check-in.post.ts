import type { H3Event } from 'h3'
import type { GuestSelfCheckedInEvent, SelfCheckInBody } from '../../../../../../../app/types/api/reception'

import { and, eq, isNull } from 'drizzle-orm'

import { useDb } from '../../../../../../db'
import { guests, seatingTables, seats } from '../../../../../../db/schema'

export default defineEventHandler(async (event: H3Event): Promise<GuestSelfCheckedInEvent> => {
  const guestId = getRouterParam(event, 'guestId')!
  const weddingId = getRouterParam(event, 'weddingId')!
  const body = await readBody<SelfCheckInBody>(event)

  const db = useDb()
  const [guest] = await db.select().from(guests).where(and(eq(guests.weddingId, weddingId), eq(guests.guestId, guestId), isNull(guests.deletedAt)))
  if (!guest) {
    throw createError({ statusCode: 404, statusMessage: '賓客不存在' })
  }
  if (guest.checkedInAt) {
    throw createError({ statusCode: 409, statusMessage: '賓客已報到' })
  }
  const checkedInAt = new Date().toISOString()
  await db.update(guests).set({ checkedInAt }).where(eq(guests.guestId, guest.guestId))

  // 桌次：實際入座（seats）優先，退回名單上的預排桌名，讓賓客報到後知道坐哪
  const [seat] = await db.select({ tableName: seatingTables.tableName })
    .from(seats)
    .innerJoin(seatingTables, eq(seats.tableId, seatingTables.tableId))
    .where(and(eq(seats.guestId, guestId), eq(seatingTables.weddingId, weddingId)))
    .limit(1)

  setResponseStatus(event, 201)
  return {
    guestId: guest.guestId,
    name: body?.name ?? guest.name,
    checkedInAt,
    tableName: seat?.tableName ?? guest.tableName ?? null,
  }
})
