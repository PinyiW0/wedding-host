import type { H3Event } from 'h3'
import type { PendingGuestConfirmedEvent } from '../../../../../../../app/types/api/pending-guests'

import { and, eq, isNull } from 'drizzle-orm'

import { useDb } from '../../../../../../db'
import { guests } from '../../../../../../db/schema'

// 建為新賓客：將待確認賓客轉為正式名單
export default defineEventHandler(async (event: H3Event): Promise<PendingGuestConfirmedEvent> => {
  const guestId = getRouterParam(event, 'guestId')!
  const weddingId = getRouterParam(event, 'weddingId')!

  const db = useDb()
  const [pending] = await db.select().from(guests).where(and(
    eq(guests.weddingId, weddingId),
    eq(guests.guestId, guestId),
    eq(guests.status, 'pending_review'),
    isNull(guests.deletedAt),
  ))
  if (!pending) {
    throw createError({ statusCode: 404, statusMessage: '待確認賓客不存在' })
  }

  await db.update(guests).set({ status: 'confirmed' }).where(eq(guests.guestId, guestId))
  return { guestId: pending.guestId }
})
