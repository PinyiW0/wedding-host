import type { H3Event } from 'h3'
import type { OverrideRsvpBody, RsvpOverriddenEvent } from '../../../../../../../app/types/api/rsvp'

import { and, eq, isNull } from 'drizzle-orm'

import { useDb } from '../../../../../../db'
import { guests } from '../../../../../../db/schema'

export default defineEventHandler(async (event: H3Event): Promise<RsvpOverriddenEvent> => {
  const guestId = getRouterParam(event, 'guestId')!
  const body = await readBody<OverrideRsvpBody>(event)

  const db = useDb()
  const [guest] = await db.select().from(guests).where(and(eq(guests.guestId, guestId), isNull(guests.deletedAt)))
  if (!guest) {
    throw createError({ statusCode: 404, statusMessage: '賓客不存在' })
  }
  await db.update(guests).set({ rsvpAttending: body.attending }).where(eq(guests.guestId, guest.guestId))

  return { guestId: guest.guestId, attending: body.attending, reason: body.reason }
})
