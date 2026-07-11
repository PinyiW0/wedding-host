import type { H3Event } from 'h3'
import type { BindGuestLineBody, GuestLineBoundEvent } from '../../../../../../../app/types/api/guests'

import { and, eq } from 'drizzle-orm'

import { useDb } from '../../../../../../db'
import { guests } from '../../../../../../db/schema'

export default defineEventHandler(async (event: H3Event): Promise<GuestLineBoundEvent> => {
  const guestId = getRouterParam(event, 'guestId')!
  const weddingId = getRouterParam(event, 'weddingId')!
  const body = await readBody<BindGuestLineBody>(event)

  const db = useDb()
  const [guest] = await db.select().from(guests).where(and(eq(guests.weddingId, weddingId), eq(guests.guestId, guestId)))
  if (!guest) {
    throw createError({ statusCode: 404, statusMessage: '賓客不存在' })
  }
  if (guest.lineUserId) {
    throw createError({ statusCode: 409, statusMessage: '已綁定 LINE' })
  }
  if (!body?.lineUserId) {
    throw createError({ statusCode: 400, statusMessage: '缺少 LINE 使用者識別' })
  }
  await db.update(guests).set({ lineUserId: body.lineUserId }).where(eq(guests.guestId, guest.guestId))

  setResponseStatus(event, 201)
  return { guestId: guest.guestId, lineUserId: body.lineUserId }
})
