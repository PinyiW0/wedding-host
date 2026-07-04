import type { H3Event } from 'h3'
import type { GuestCheckedInEvent } from '../../../../../../../app/types/api/reception'

import { and, eq, isNull } from 'drizzle-orm'

import { useDb } from '../../../../../../db'
import { guests } from '../../../../../../db/schema'

export default defineEventHandler(async (event: H3Event): Promise<GuestCheckedInEvent> => {
  const guestId = getRouterParam(event, 'guestId')!

  const db = useDb()
  const [guest] = await db.select().from(guests).where(and(eq(guests.guestId, guestId), isNull(guests.deletedAt)))
  if (!guest) {
    throw createError({ statusCode: 404, statusMessage: '賓客不存在' })
  }
  if (guest.checkedInAt) {
    throw createError({ statusCode: 409, statusMessage: '賓客已報到' })
  }
  const checkedInAt = new Date().toISOString()
  await db.update(guests).set({ checkedInAt }).where(eq(guests.guestId, guest.guestId))

  setResponseStatus(event, 201)
  return { guestId: guest.guestId, checkedInAt }
})
