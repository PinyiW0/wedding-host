import type { H3Event } from 'h3'
import type { OverrideRsvpBody, RsvpOverriddenEvent } from '../../../../../../../app/types/api/rsvp'

import { and, eq, isNull } from 'drizzle-orm'

import { useDb } from '../../../../../../db'
import { guests, seats } from '../../../../../../db/schema'

export default defineEventHandler(async (event: H3Event): Promise<RsvpOverriddenEvent> => {
  const guestId = getRouterParam(event, 'guestId')!
  const weddingId = getRouterParam(event, 'weddingId')!
  const body = await readBody<OverrideRsvpBody>(event)

  const db = useDb()
  const [guest] = await db.select().from(guests).where(and(eq(guests.weddingId, weddingId), eq(guests.guestId, guestId), isNull(guests.deletedAt)))
  if (!guest) {
    throw createError({ statusCode: 404, statusMessage: '賓客不存在' })
  }
  // 出席狀態 enum 驗證（issue #70 / M4）：非法值會落庫並污染 dashboard 統計
  assertEnum(body.attending, ['attending', 'declined', 'absent'], '出席狀態')
  await db.update(guests).set({ rsvpAttending: body.attending }).where(eq(guests.guestId, guest.guestId))

  // 婉拒者不進排桌次（issue #96）：管理員代改為婉拒時同樣釋放既有座位
  if (body.attending === 'declined')
    await db.delete(seats).where(eq(seats.guestId, guest.guestId))

  return { guestId: guest.guestId, attending: body.attending, reason: body.reason }
})
