import type { H3Event } from 'h3'
import type { GuestRestoredEvent } from '../../../../../../../app/types/api/guests'

import { and, eq } from 'drizzle-orm'

import { useDb } from '../../../../../../db'
import { guests } from '../../../../../../db/schema'

export default defineEventHandler(async (event: H3Event): Promise<GuestRestoredEvent> => {
  const guestId = getRouterParam(event, 'guestId')!
  const weddingId = getRouterParam(event, 'weddingId')!
  const db = useDb()
  const [guest] = await db.select().from(guests).where(and(eq(guests.weddingId, weddingId), eq(guests.guestId, guestId)))
  if (!guest) {
    throw createError({ statusCode: 404, statusMessage: '賓客不存在' })
  }
  if (!guest.deletedAt) {
    throw createError({ statusCode: 409, statusMessage: '賓客未被移除' })
  }
  await db.update(guests).set({ deletedAt: null }).where(eq(guests.guestId, guestId))

  return { guestId: guest.guestId }
})
