import type { H3Event } from 'h3'

import { eq } from 'drizzle-orm'

import { useDb } from '../../../../../../db'
import { guests } from '../../../../../../db/schema'

export default defineEventHandler(async (event: H3Event): Promise<void> => {
  const guestId = getRouterParam(event, 'guestId')!
  const db = useDb()
  const [guest] = await db.select().from(guests).where(eq(guests.guestId, guestId))
  if (!guest) {
    throw createError({ statusCode: 404, statusMessage: '賓客不存在' })
  }
  if (guest.deletedAt) {
    throw createError({ statusCode: 409, statusMessage: '賓客已移除' })
  }
  await db.update(guests).set({ deletedAt: new Date().toISOString() }).where(eq(guests.guestId, guestId))

  setResponseStatus(event, 204)
})
